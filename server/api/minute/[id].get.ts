import type { MinuteSummary } from "#shared/types";

/**
 * 회의록 요약 — 국회 회의록 뷰어(type=summary) HTML 에서 상정 안건 + 발언 위원 추출.
 * GET /api/minute/:id
 */
export default defineCachedEventHandler(
  async (event): Promise<MinuteSummary> => {
    const id = getRouterParam(event, "id");
    const empty: MinuteSummary = { title: "", agenda: [], speakers: [], hwp: "", pdf: "" };
    if (!id || !/^\d+$/.test(id)) return empty;

    let html = "";
    try {
      html = await $fetch<string>(
        `https://record.assembly.go.kr/assembly/viewer/minutes/xml.do?id=${id}&type=summary`,
        { headers: { "User-Agent": "Mozilla/5.0 (UijeongWatch)" }, responseType: "text", timeout: 12000 },
      );
    } catch {
      return empty;
    }

    const decode = (t: string) =>
      t
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, " ")
        .trim();

    // 상정 안건
    const agenda: string[] = [];
    const angun = html.match(/<ul class="list_angun">([\s\S]*?)<\/ul>/);
    if (angun) {
      for (const m of angun[1].matchAll(/<a[^>]*>([\s\S]*?)<\/a>/g)) {
        const t = decode(m[1].replace(/<[^>]+>/g, ""));
        if (t) agenda.push(t);
      }
    }

    // 발언/참석 위원 (attender datalist)
    const speakers: string[] = [];
    const attender = html.match(/<datalist id="attender">([\s\S]*?)<\/datalist>/);
    if (attender) {
      for (const m of attender[1].matchAll(/<option value="([^"]+)"/g)) {
        const t = decode(m[1]);
        if (t && !speakers.includes(t)) speakers.push(t);
      }
    }

    const title = decode((html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "").replace("국회회의록 상세보기 팝업창", ""));

    return { title, agenda, speakers, hwp: "", pdf: "" };
  },
  {
    maxAge: 60 * 60 * 24,
    name: "minute-summary",
    getKey: (event) => getRouterParam(event, "id") ?? "none",
  },
);
