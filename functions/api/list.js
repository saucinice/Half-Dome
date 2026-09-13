// Cloudflare Pages Function — tiny shared JSON lists backed by KV (free).
// Used for the restaurant list. Same PHOTOS_KV binding, no new setup.
//   GET /api/list?name=food          → { items, updatedAt }
//   PUT /api/list?name=food {items, updatedAt} → saved (last-write-wins)

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function cleanName(s) {
  return String(s || "food").replace(/[^a-z0-9-]/gi, "").toLowerCase().slice(0, 40) || "food";
}

export async function onRequestGet({ request, env }) {
  if (!env.PHOTOS_KV) return json({ error: "KV binding PHOTOS_KV not configured", items: null }, 500);
  const name = cleanName(new URL(request.url).searchParams.get("name"));
  const raw = await env.PHOTOS_KV.get("list/" + name);
  if (!raw) return json({ items: [], updatedAt: 0 });
  try {
    const d = JSON.parse(raw);
    return json({ items: Array.isArray(d.items) ? d.items : [], updatedAt: Number(d.updatedAt) || 0 });
  } catch {
    return json({ items: [], updatedAt: 0 });
  }
}

export async function onRequestPut({ request, env }) {
  if (!env.PHOTOS_KV) return json({ error: "KV binding PHOTOS_KV not configured" }, 500);
  const name = cleanName(new URL(request.url).searchParams.get("name"));
  let body;
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  if (!body || !Array.isArray(body.items) || body.items.length > 200) {
    return json({ error: "items must be an array (max 200)" }, 400);
  }
  const items = body.items.map((it) => ({
    t: String((it && it.t) || "").slice(0, 80),
    s: String((it && it.s) || "").slice(0, 160),
    url: String((it && it.url) || "").slice(0, 500),
  }));
  const updatedAt = Number(body.updatedAt) || Date.now();
  await env.PHOTOS_KV.put("list/" + name, JSON.stringify({ items, updatedAt }));
  return json({ ok: true, updatedAt });
}
