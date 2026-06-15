import { buildCatalog } from "../../utils/instagram/catalog";
import { renderPostResponse } from "../../utils/instagram/render";

export default defineEventHandler(async (event) => {
  // 라우트는 /og/:slug (전체 세그먼트 파라미터). 요청 URL 은 /og/<slug>.png 이므로
  // 확장자를 떼어낸다. (:slug.png 혼합 세그먼트는 radix 라우터가 분리하지 못해 회피)
  const raw = getRouterParam(event, "slug") ?? "";
  const slug = raw.replace(/\.png$/, "");
  const spec = buildCatalog().find((s) => s.slug === slug);
  if (!spec) throw createError({ statusCode: 404, statusMessage: "unknown slug" });

  const res = await renderPostResponse(spec);
  const buf = await res.arrayBuffer();
  setHeader(event, "content-type", "image/png");
  setHeader(event, "cache-control", "public, max-age=86400");
  return new Uint8Array(buf);
});
