// Cloudflare Pages Function — serve / delete one shared photo from R2.
//   GET    /api/photo?key=slot/file.jpg  → image bytes (cacheable offline)
//   DELETE /api/photo?key=slot/file.jpg  → remove

export async function onRequestGet({ request, env }) {
  if (!env.PHOTOS) return new Response("R2 binding PHOTOS not configured", { status: 500 });
  const key = new URL(request.url).searchParams.get("key") || "";
  if (!key || key.includes("..") || key.startsWith("/")) return new Response("bad key", { status: 400 });
  const obj = await env.PHOTOS.get(key);
  if (!obj) return new Response("not found", { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return new Response(obj.body, { headers });
}

export async function onRequestDelete({ request, env }) {
  if (!env.PHOTOS) return new Response("R2 binding PHOTOS not configured", { status: 500 });
  const key = new URL(request.url).searchParams.get("key") || "";
  if (!key || key.includes("..") || key.startsWith("/")) return new Response("bad key", { status: 400 });
  await env.PHOTOS.delete(key);
  return Response.json({ ok: true });
}
