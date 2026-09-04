import type { PostSpec } from "./catalog";

const BASE_TAGS = ["국회", "국회의원", "정치", "의정감시", "22대국회"];
const SITE = "asm.zihado.com";

export function buildCaption(spec: PostSpec): string {
  const top3 = spec.items
    .slice(0, 3)
    .map((it, i) => `${i + 1}. ${it.name} (${it.party}) — ${it.value.toLocaleString("ko-KR")}${it.unit}`)
    .join("\n");
  const tags = [...BASE_TAGS, ...spec.hashtags].map((t) => `#${t}`).join(" ");
  return [
    `📊 ${spec.headline}`,
    spec.subtitle,
    "",
    top3,
    "",
    `전체 순위는 프로필 링크에서 👉 ${SITE}`,
    "",
    tags,
  ].join("\n");
}
