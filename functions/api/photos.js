// Cloudflare Pages Function — shared trip photos backed by R2.
// REQUIRED: R2 bucket bound as PHOTOS (dashboard: Pages project → Settings → Bindings).
//   GET  /api/photos?slot=map        → { photos: [{key, slot, name, ts}] }
//   POST /api/photos                 → multipart {slot, file} OR json {slot, url}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function cleanSlot(s) {
  return String(s || "shared").replace(/[^a-z0-9-]/gi, "").toLowerCase().slice(0, 40) || "shared";
}

export async function onRequestGet({ request, env }) {
  if (!env.PHOTOS) return json({ error: "R2 binding PHOTOS not configured", photos: null }, 500);
  const slot = new URL(request.url).searchParams.get("slot");
  const out = [];
  let cursor;
  do {
    const page = await env.PHOTOS.list({ prefix: slot ? cleanSlot(slot) + "/" : undefined, cursor, limit: 500 });
    for (const o of page.objects) {
      const md = o.customMetadata || {};
      out.push({
        key: o.key,
        slot: md.slot || o.key.split("/")[0],
        name: md.name || o.key.split("/").pop(),
        ts: Number(md.ts || 0),
      });
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  out.sort((a, b) => a.ts - b.ts);
  return json({ photos: out });
}

export async function onRequestPost({ request, env }) {
  if (!env.PHOTOS) return json({ error: "R2 binding PHOTOS not configured" }, 500);
  const ctype = request.headers.get("content-type") || "";
  let slot = "shared", blob = null, name = "photo";

  if (ctype.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    slot = cleanSlot(body.slot);
    if (!body.url || !/^https?:\/\//i.test(body.url)) return json({ error: "url required" }, 400);
    const fetched = await fetch(body.url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!fetched.ok) return json({ error: "could not fetch url" }, 400);
    blob = await fetched.blob();
    name = String(body.url.split("/").pop().split("?")[0] || "photo").slice(0, 120);
    if (!blob.type || !blob.type.startsWith("image/")) return json({ error: "url is not an image" }, 400);
  } else {
    let form;
    try { form = await request.formData(); } catch { return json({ error: "bad form body" }, 400); }
    slot = cleanSlot(form.get("slot"));
    const file = form.get("file");
    if (!(file instanceof Blob) || file.size === 0) return json({ error: "file required" }, 400);
    if (file.type && !file.type.startsWith("image/")) return json({ error: "file must be an image" }, 400);
    if (file.size > 15 * 1024 * 1024) return json({ error: "max 15MB per photo" }, 413);
    blob = file;
    name = String(file.name || "photo").slice(0, 120);
  }

  const ext = ((name.split(".").pop() || "jpg").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "jpg").toLowerCase();
  const key = `${slot}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await env.PHOTOS.put(key, blob, {
    httpMetadata: { contentType: blob.type || "image/jpeg" },
    customMetadata: { slot, name, ts: String(Date.now()) },
  });
  return json({ ok: true, key, url: `/api/photo?key=${encodeURIComponent(key)}` });
}
