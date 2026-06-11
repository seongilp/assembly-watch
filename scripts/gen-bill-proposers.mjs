#!/usr/bin/env node
/**
 * 의안 공동발의자 명단 베이크 → server/assets/bill-proposers.json { [billId]: BillProposers }
 * bills-recent.json(계류 300 + 처리 300)의 모든 의안에 대해 likms coactor 팝업을
 * 빌드타임에 1회 파싱해 둔다. 런타임 /api/bill/[billId] 는 베이크를 먼저 보고,
 * 없는 의안만 라이브 폴백 → "발의의원" 클릭 즉시 표시.
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "server/assets/bills-recent.json");
const OUT = join(root, "server/assets/bill-proposers.json");
const CONC = 8;

// 의원발의가 아닌 것(위원장·정부 제출)은 coactor 팝업이 비어 있으므로 건너뛴다.
const isMemberBill = (b) => (b.proposerKind ? b.proposerKind === "의원" : /의원/.test(b.proposer || ""));

const RE = /<p>([^<]+)<\/p>\s*<p>[^<]*<\/p>\s*<p class="jdang">([^<]+)<\/p>/g;

async function fetchProposers(billId) {
  const url = `https://likms.assembly.go.kr/bill/coactorListPopup.do?billId=${encodeURIComponent(billId)}`;
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (UijeongWatch build)" } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const html = await r.text();
  const list = [];
  let m;
  RE.lastIndex = 0;
  while ((m = RE.exec(html))) {
    const name = m[1].trim();
    if (name) list.push({ name, party: m[2].trim() || "무소속" });
  }
  const map = new Map();
  for (const p of list) {
    if (!map.has(p.party)) map.set(p.party, []);
    map.get(p.party).push(p.name);
  }
  const byParty = [...map.entries()]
    .map(([party, names]) => ({ party, count: names.length, names }))
    .sort((a, b) => b.count - a.count);
  return { rep: list[0]?.name ?? "", total: list.length, byParty };
}

async function main() {
  if (!existsSync(SRC)) {
    console.warn("[gen-bill-proposers] bills-recent.json 없음 — 건너뜀");
    if (!existsSync(OUT)) save({});
    return;
  }
  const { pending = [], processed = [] } = JSON.parse(readFileSync(SRC, "utf8"));
  const targets = [...pending, ...processed].filter((b) => b.id && isMemberBill(b));
  // 동일 의안이 양쪽에 있을 수 있어 중복 제거
  const ids = [...new Set(targets.map((b) => b.id))];

  const out = {};
  let idx = 0, ok = 0, fail = 0;
  async function worker() {
    while (idx < ids.length) {
      const id = ids[idx++];
      try {
        out[id] = await fetchProposers(id);
        ok++;
      } catch {
        // 1회 재시도
        try {
          await new Promise((r) => setTimeout(r, 500));
          out[id] = await fetchProposers(id);
          ok++;
        } catch {
          fail++; // 베이크 누락 → 런타임 라이브 폴백이 처리
        }
      }
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  save(out);
  console.log(`[gen-bill-proposers] ${ok}건 베이크 (실패 ${fail} — 런타임 폴백)`);
}

function save(obj) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(obj));
}

main().catch((e) => console.warn("[gen-bill-proposers] 실패:", e.message));
