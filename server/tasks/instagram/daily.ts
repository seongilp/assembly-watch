import { env } from "cloudflare:workers";
import { buildCatalog } from "../../utils/instagram/catalog";
import { buildCaption } from "../../utils/instagram/caption";
import { publishPhoto } from "../../utils/instagram/publish";
import { getPointer, getLastPosted, commitPosted } from "../../utils/instagram/state";
import { todayKST } from "../../utils/instagram/time";

export default defineTask({
  meta: { name: "instagram:daily", description: "매일 인스타 펀팩트 자동 게시" },
  async run() {
    const day = todayKST();
    if ((await getLastPosted()) === day) {
      return { result: `skip: ${day} 이미 게시됨` };
    }
    const catalog = buildCatalog();
    if (catalog.length === 0) throw new Error("catalog 비어있음");

    const pointer = await getPointer();
    const spec = catalog[pointer % catalog.length]!;

    const e = env as unknown as { IG_USER_ID?: string; IG_ACCESS_TOKEN?: string };
    if (!e.IG_USER_ID || !e.IG_ACCESS_TOKEN) {
      throw new Error("IG_USER_ID/IG_ACCESS_TOKEN 시크릿 미설정");
    }

    const mediaId = await publishPhoto({
      igUserId: e.IG_USER_ID,
      accessToken: e.IG_ACCESS_TOKEN,
      imageUrl: `https://asm.zihado.com/og/${spec.slug}.png`,
      caption: buildCaption(spec),
    });

    // 게시 성공 후에만 상태 갱신 (idempotent)
    await commitPosted(pointer + 1, day);
    return { result: `posted ${spec.slug} → media=${mediaId}` };
  },
});
