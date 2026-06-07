#!/usr/bin/env node
/**
 * 위원회 목록 베이크 → server/assets/committees.json
 * 프리렌더 라우트(/committees/[deptCd]) 구성 + 상세 엔드포인트에서 위원회 메타 조회용.
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, "server/assets/committees.json");

function key() {
  if (process.env.API_KEY) return process.env.API_KEY;
  try {
    return readFileSync(join(root, ".env"), "utf8").match(/^API_KEY=(.+)$/m)?.[1]?.trim() ?? "";
  } catch {
    return "";
  }
}

const s = (v) => (v == null ? "" : String(v).trim());

// 회의록 요약 뷰어 HTML → {agenda, speakers} (런타임 /api/minute 와 동일 로직)
async function scrapeSummary(id) {
  const empty = { agenda: [], speakers: [] };
  if (!/^\d+$/.test(String(id))) return empty;
  try {
    const r = await fetch(
      `https://record.assembly.go.kr/assembly/viewer/minutes/xml.do?id=${id}&type=summary`,
      { headers: { "User-Agent": "Mozilla/5.0 (UijeongWatch build)" } },
    );
    const html = await r.text();
    const dec = (t) =>
      t.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
    const agenda = [];
    const angun = html.match(/<ul class="list_angun">([\s\S]*?)<\/ul>/);
    if (angun) for (const m of angun[1].matchAll(/<a[^>]*>([\s\S]*?)<\/a>/g)) {
      const t = dec(m[1].replace(/<[^>]+>/g, ""));
      if (t) agenda.push(t);
    }
    const speakers = [];
    const att = html.match(/<datalist id="attender">([\s\S]*?)<\/datalist>/);
    if (att) for (const m of att[1].matchAll(/<option value="([^"]+)"/g)) {
      const t = dec(m[1]);
      if (t && !speakers.includes(t)) speakers.push(t);
    }
    return { agenda, speakers };
  } catch {
    return empty;
  }
}

async function main() {
  const KEY = key();
  if (!KEY) {
    if (!existsSync(OUT)) save([]);
    console.warn("[gen-committees] API_KEY 없음");
    return;
  }
  const res = await fetch(
    `https://open.assembly.go.kr/portal/openapi/nxrvzonlafugpqjuh?KEY=${KEY}&Type=json&pSize=400`,
    { headers: { "User-Agent": "Mozilla/5.0 (UijeongWatch build)" } },
  );
  const j = JSON.parse(await res.text());
  const rows = j?.nxrvzonlafugpqjuh?.[1]?.row ?? [];
  const seen = new Set();
  const list = [];
  for (const r of rows) {
    const deptCd = s(r.HR_DEPT_CD);
    const name = s(r.COMMITTEE_NAME);
    if (!deptCd || !name || seen.has(deptCd)) continue;
    seen.add(deptCd);
    list.push({ deptCd, name, div: s(r.CMT_DIV_NM), limit: r.LIMIT_CNT ?? null, minutes: [] });
  }

  // 상임위별 최근 회의록 3건 (목록 페이지 인라인 표시용)
  const year = new Date().getFullYear();
  const standing = list.filter((c) => c.div === "상임위원회");
  await Promise.all(
    standing.map(async (c) => {
      try {
        const fetchYear = async (y) => {
          const r = await fetch(
            `https://open.assembly.go.kr/portal/openapi/ncwgseseafwbuheph?KEY=${KEY}&Type=json&pSize=60&DAE_NUM=22&CONF_DATE=${y}&COMM_NAME=${encodeURIComponent(c.name)}`,
            { headers: { "User-Agent": "Mozilla/5.0 (UijeongWatch build)" } },
          );
          const j = JSON.parse(await r.text());
          return j?.ncwgseseafwbuheph?.[1]?.row ?? [];
        };
        const mrows = [...(await fetchYear(year)), ...(await fetchYear(year - 1))];
        const seenC = new Set();
        c.minutes = mrows
          .map((m) => ({
            id: (s(m.CONF_LINK_URL).match(/id=(\d+)/) || [])[1] ?? "",
            title: s(m.TITLE),
            date: s(m.CONF_DATE),
            pdf: s(m.PDF_LINK_URL),
            summary: s(m.CONF_LINK_URL),
            vod: s(m.VOD_LINK_URL),
            _k: s(m.CONF_ID) || s(m.TITLE),
          }))
          .filter((m) => (seenC.has(m._k) ? false : (seenC.add(m._k), true)))
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 3)
          .map(({ _k, ...m }) => m);
      } catch {
        c.minutes = [];
      }
    }),
  );

  // 요약 베이크는 record 뷰어가 IP·세션 상태형이라 동시 요청 시 안건이 뒤섞임
  // → 반드시 순차 스크래핑(한 번에 하나)으로 정확도 보장
  for (const c of standing) {
    for (const m of c.minutes ?? []) {
      if (!m.id) continue;
      const sum = await scrapeSummary(m.id);
      m.agenda = sum.agenda;
      m.speakers = sum.speakers;
    }
  }

  save(list);
  console.log(`[gen-committees] ${list.length}개 위원회 (상임 ${standing.length}, 회의록 베이크 완료)`);
}

function save(list) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(list));
}

main().catch((e) => {
  console.warn("[gen-committees] 실패:", e.message);
  if (!existsSync(OUT)) save([]);
});
