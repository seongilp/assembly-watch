import type { BillProposers } from "#shared/types";
import baked from "../../assets/bill-proposers.json";

const BAKED = baked as Record<string, BillProposers>;

/**
 * 의안 공동발의자 명단 — 빌드 베이크(bill-proposers.json) 우선, 미베이크 의안만
 * likms coactor 팝업 HTML 라이브 파싱 폴백(캐시 24h). 인앱 정당별 명단 표시용.
 */
export default defineCachedEventHandler(
  async (event): Promise<BillProposers> => {
    const billId = getRouterParam(event, "billId");
    if (!billId) throw createError({ statusCode: 400, statusMessage: "billId 필요" });

    const hit = BAKED[billId];
    if (hit) return hit;

    const url = `https://likms.assembly.go.kr/bill/coactorListPopup.do?billId=${encodeURIComponent(billId)}`;
    let html = "";
    try {
      html = await $fetch<string>(url, {
        headers: { "User-Agent": "Mozilla/5.0 (UijeongWatch)" },
        responseType: "text",
      });
    } catch {
      return { rep: "", total: 0, byParty: [] };
    }

    // <li> ... <p>이름</p><p>한자</p><p class="jdang">정당</p>
    const re = /<p>([^<]+)<\/p>\s*<p>[^<]*<\/p>\s*<p class="jdang">([^<]+)<\/p>/g;
    const list: { name: string; party: string }[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) {
      const name = m[1].trim();
      const party = m[2].trim();
      if (name) list.push({ name, party: party || "무소속" });
    }

    const map = new Map<string, string[]>();
    for (const p of list) {
      if (!map.has(p.party)) map.set(p.party, []);
      map.get(p.party)!.push(p.name);
    }
    const byParty = [...map.entries()]
      .map(([party, names]) => ({ party, count: names.length, names }))
      .sort((a, b) => b.count - a.count);

    return { rep: list[0]?.name ?? "", total: list.length, byParty };
  },
  { maxAge: 60 * 60 * 24, name: "bill-proposers", getKey: (e) => getRouterParam(e, "billId") ?? "x" },
);
