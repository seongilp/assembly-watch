#!/usr/bin/env node
/**
 * 정치자금 식당 지출 베이크 → server/assets/dining.json
 * 원천: OhmyNews/KA-money (오마이뉴스·경향신문·뉴스타파, 2012~2024, 선거자금 제외). 출처표시 필수.
 * 입력: KA_MONEY_DIR(기본 ./.cache/ka-money) 의 *_KAPF*.xlsx
 * 주의: gen:data 비포함 — 수동 `pnpm gen:dining` 후 dining.json 커밋.
 */
import { writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
const XLSX = createRequire(import.meta.url)("xlsx");
import { mapColumns, isFoodRow, parseAmount, normalizeMerchant, inferCuisine, guOf, aggregate } from "./lib/dining.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = process.env.KA_MONEY_DIR || join(root, ".cache/ka-money");
const OUT = join(root, "server/assets/dining.json");
const SOURCE = { name: "오마이뉴스·경향신문·뉴스타파", url: "https://omn.kr/187rv" };

// gen-graph-data.mjs 와 동일 기준 유지(2020=쥐). 불일치 시 펀팩트 띠 분석이 어긋남.
const ZODIAC = ["쥐","소","호랑이","토끼","용","뱀","말","양","원숭이","닭","개","돼지"];
const zodiacOf = (birth) => { const y = parseInt(String(birth).slice(0, 4), 10); return Number.isFinite(y) ? ZODIAC[(((y - 2020) % 12) + 12) % 12] : null; };
const ageBucket = (birth) => { const y = parseInt(String(birth).slice(0, 4), 10); if (!Number.isFinite(y)) return null; const a = 2026 - y; return `${Math.floor(a / 10) * 10}대`; };
// graph-data.json 의 버킷({label, members:[{id,name,party}]})에서 name→label 맵을 만든다.
// 펀팩트 그래프와 동일한 분류를 재사용해 평수/재산 분포를 일관되게 유지.
function bucketNameMap(buckets) {
  const m = new Map();
  for (const b of buckets || []) for (const mem of b.members || []) m.set(mem.name, b.label);
  return m;
}

function buildMemberIndex() {
  const members = JSON.parse(readFileSync(join(root, "server/assets/members.json"), "utf8"));
  const arr = Array.isArray(members) ? members : members.rows ?? Object.values(members);
  const graph = existsSync(join(root, "server/assets/graph-data.json")) ? JSON.parse(readFileSync(join(root, "server/assets/graph-data.json"), "utf8")) : {};
  const pyeongByName = bucketNameMap(graph.pyeong?.buckets);       // ~197명
  const wealthByName = bucketNameMap(graph.wealthBands?.buckets);  // ~279명
  const nameCount = {};
  for (const m of arr) nameCount[m.name] = (nameCount[m.name] || 0) + 1;
  const idx = new Map();
  for (const m of arr) {
    if (nameCount[m.name] !== 1) continue; // 동명이인 제외
    idx.set(m.name, {
      id: m.id, name: m.name, party: (m.party || "").split("/")[0]?.trim() || "무소속", origin: m.origin,
      ageBucket: ageBucket(m.birth), gender: m.sex || null, zodiac: zodiacOf(m.birth),
      wealthBucket: wealthByName.get(m.name) ?? null, pyeongBucket: pyeongByName.get(m.name) ?? null,
    });
  }
  return idx;
}

function readRows(file) {
  const wb = XLSX.readFile(join(DIR, file), { cellDates: true });
  const ws = wb.Sheets["Data"] || wb.Sheets[wb.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
  if (!grid.length) return [];
  const col = mapColumns(grid[0]);
  const out = [];
  for (let i = 1; i < grid.length; i++) {
    const r = grid[i];
    const category = r[col.category];
    if (!isFoodRow(category)) continue;
    const merchant = normalizeMerchant(r[col.merchant]);
    if (!merchant) continue;
    const addr = col.address >= 0 ? r[col.address] : null;
    out.push({
      member: String(r[col.member] || "").trim(),
      party: String(r[col.party] || "").trim(),
      origin: String(r[col.region] || "").trim(),
      amount: parseAmount(r[col.amount]),
      merchant,
      cuisine: inferCuisine(merchant, col.biz >= 0 ? r[col.biz] : null),
      category: String(category).trim(),
      gu: col.address >= 0 ? guOf(addr) : null,
    });
  }
  return out;
}

function main() {
  if (!existsSync(DIR)) { console.warn(`[gen-dining] ${DIR} 없음 — KA-money xlsx 를 받아 두세요. 기존 dining.json 유지.`); return; }
  const files = readdirSync(DIR).filter((f) => /_KAPF.*\.xlsx$/i.test(f));
  // 같은 연도에 리치(_수입지출) 파일이 있으면 그것만 사용(주소·업종 포함)
  const richBase = new Set(files.filter((f) => /_수입지출/.test(f)).map((f) => f.replace("_수입지출", "")));
  const use = files.filter((f) => /_수입지출/.test(f) || !richBase.has(f));
  const years = new Set();
  let rows = [];
  for (const f of use) { const y = (f.match(/^(\d{4})/) || [])[1]; if (y) years.add(+y); rows = rows.concat(readRows(f)); }

  const members = buildMemberIndex();
  const agg = aggregate(rows, members, { restaurantTop: 200 });
  const out = {
    basis: "정치자금 지출보고서 2012~2024 (선거자금 제외)",
    source: SOURCE,
    generatedAt: new Date().toISOString().slice(0, 10),
    years: [...years].sort(),
    coverage: { rows: rows.length, matchedMembers: agg.byMember.filter((m) => m.matched).length, addrYears: [2023, 2024] },
    ...agg,
  };
  writeFileSync(OUT, JSON.stringify(out));
  console.log(`[gen-dining] ${rows.length} 식당행 → ${agg.restaurants.length} 식당, ${agg.byMember.length} 의원, 매칭 ${out.coverage.matchedMembers}`);
}
main();
