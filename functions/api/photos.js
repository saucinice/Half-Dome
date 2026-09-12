// Cloudflare Pages Function — shared trip photos backed by KV.
// 100% free, no credit card. REQUIRED: KV namespace bound as PHOTOS_KV
// (dashboard: Pages project → Settings → Functions → KV namespace bindings).
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

function bufToB64(buf) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
  }
  return btoa(s);
}

export async function onRequestGet({ request, env }) {
  if (!env.PHOTOS_KV) return json({ error: "KV binding PHOTOS_KV not configured", photos: null }, 500);
  const raw = new URL(request.url).searchParams.get("slot");
  const prefix = raw ? cleanSlot(raw) + "/" : undefined;
  const list = await env.PHOTOS_KV.list({ prefix, limit: 1000 });
  const out = (list.keys || []).map((k) => {
    const md = k.metadata || {};
    return {
      key: k.name,
      slot: md.slot || k.name.split("/")[0],
      name: md.name || k.name.split("/").pop(),
      ts: Number(md.ts || 0),
    };
  });
  out.sort((a, b) => a.ts - b.ts);
  return json({ photos: out });
}

export async function onRequestPost({ request, env }) {
  if (!env.PHOTOS_KV) return json({ error: "KV binding PHOTOS_KV not configured" }, 500);
  const ctype = request.headers.get("content-type") || "";
  let slot = "shared", buf = null, type = "image/jpeg", name = "photo";

  if (ctype.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    slot = cleanSlot(body.slot);
    if (!body.url || !/^https?:\/\//i.test(body.url)) return json({ error: "url required" }, 400);
    const fetched = await fetch(body.url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!fetched.ok) return json({ error: "could not fetch url" }, 400);
    const blob = await fetched.blob();
    if (!blob.type || !blob.type.startsWith("image/")) return json({ error: "url is not an image" }, 400);
    buf = await blob.arrayBuffer();
    type = blob.type;
    name = String(body.url.split("/").pop().split("?")[0] || "photo").slice(0, 120);
  } else {
    let form;
    try { form = await request.formData(); } catch { return json({ error: "bad form body" }, 400); }
    slot = cleanSlot(form.get("slot"));
    const file = form.get("file");
    if (!(file instanceof Blob) || file.size === 0) return json({ error: "file required" }, 400);
    if (file.type && !file.type.startsWith("image/")) return json({ error: "file must be an image" }, 400);
    if (file.size > 12 * 1024 * 1024) return json({ error: "max 12MB per photo" }, 413);
    buf = await file.arrayBuffer();
    type = file.type || "image/jpeg";
    name = String(file.name || "photo").slice(0, 120);
  }

  const key = `${slot}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await env.PHOTOS_KV.put(
    key,
    JSON.stringify({ data: bufToB64(buf), type }),
    { metadata: { slot, name, ts: String(Date.now()) } }
  );
  return json({ ok: true, key, url: `/api/photo?key=${encodeURIComponent(key)}` });
}
