// Cloudflare Pages Function — serve / delete one shared photo from KV.
//   GET    /api/photo?key=slot/id  → image bytes (cacheable offline)
//   DELETE /api/photo?key=slot/id  → remove

function b64ToBytes(b64) {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

export async function onRequestGet({ request, env }) {
  if (!env.PHOTOS_KV) return new Response("KV binding PHOTOS_KV not configured", { status: 500 });
  const key = new URL(request.url).searchParams.get("key") || "";
  if (!key || key.includes("..") || key.startsWith("/")) return new Response("bad key", { status: 400 });
  const raw = await env.PHOTOS_KV.get(key);
  if (!raw) return new Response("not found", { status: 404 });
  let rec;
  try { rec = JSON.parse(raw); } catch { return new Response("bad record", { status: 500 }); }
  return new Response(b64ToBytes(rec.data), {
    headers: {
      "Content-Type": rec.type || "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

export async function onRequestDelete({ request, env }) {
  if (!env.PHOTOS_KV) return new Response("KV binding PHOTOS_KV not configured", { status: 500 });
  const key = new URL(request.url).searchParams.get("key") || "";
  if (!key || key.includes("..") || key.startsWith("/")) return new Response("bad key", { status: 400 });
  await env.PHOTOS_KV.delete(key);
  return Response.json({ ok: true });
}
