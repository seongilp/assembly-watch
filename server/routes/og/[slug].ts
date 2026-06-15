import { buildCatalog } from "../../utils/instagram/catalog";
import { renderPostResponse } from "../../utils/instagram/render";

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug");
  const spec = buildCatalog().find((s) => s.slug === slug);
  if (!spec) throw createError({ statusCode: 404, statusMessage: "unknown slug" });

  const res = await renderPostResponse(spec);
  const buf = await res.arrayBuffer();
  setHeader(event, "content-type", "image/png");
  setHeader(event, "cache-control", "public, max-age=86400");
  return new Uint8Array(buf);
});
