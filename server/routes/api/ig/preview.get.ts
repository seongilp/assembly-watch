import { env } from "cloudflare:workers";
import { buildCatalog } from "../../../utils/instagram/catalog";
import { buildCaption } from "../../../utils/instagram/caption";
import { getPointer, getLastPosted } from "../../../utils/instagram/state";
import { todayKST } from "../../../utils/instagram/time";

export default defineEventHandler(async (event) => {
  // 토큰은 헤더로만 — URL query 는 observability/브라우저 히스토리/Referer 에 기록된다
  const auth = getHeader(event, "authorization") ?? "";
  const token = auth.startsWith("Bearer ")
    ? auth.slice(7).trim()
    : getHeader(event, "x-ig-preview-token");
  const expected = (env as unknown as { IG_PREVIEW_TOKEN?: string }).IG_PREVIEW_TOKEN;
  if (!expected || token !== expected) {
    throw createError({ statusCode: 401, statusMessage: "unauthorized" });
  }
  const catalog = buildCatalog();
  const pointer = await getPointer();
  const spec = catalog[pointer % catalog.length]!;
  return {
    day: todayKST(),
    lastPosted: await getLastPosted(),
    pointer,
    slug: spec.slug,
    imageUrl: `https://asm.zihado.com/og/${spec.slug}.png`,
    caption: buildCaption(spec),
  };
});
