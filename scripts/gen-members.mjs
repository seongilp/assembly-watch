#!/usr/bin/env node
/**
 * 현직 국회의원 전체 명단(인적사항) 베이크 → server/assets/members.json
 *   [{ id, name, hanja, eng, party, origin, electType, committee, committees,
 *      reelection, sex, units, job, tel, email, homepage, birth, staff, secretary }]
 * 빌드 1회 fetch → /api/members, /api/members/:id 가 라이브 API 없이 동작(프리렌더 CI 가능).
 * 사진은 member-photos.json 으로 런타임 보강(여기선 제외).
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, "server/assets/members.json");
const MEMBERS = "nwvrqwxyaytdsfvhu";

function key() {
  if (process.env.API_KEY) return process.env.API_KEY;
  try {
    return readFileSync(join(root, ".env"), "utf8").match(/^API_KEY=(.+)$/m)?.[1]?.trim() ?? "";
  } catch {
    return "";
  }
}
const s = (v) => (v == null ? "" : String(v).trim());

async function call(code, params) {
  const q = new URLSearchParams({ KEY: key(), Type: "json", pIndex: "1", pSize: "350", ...params });
  const r = await fetch(`https://open.assembly.go.kr/portal/openapi/${code}?${q}`, {
    headers: { "User-Agent": "Mozilla/5.0 (UijeongWatch build)" },
  });
  const j = JSON.parse(await r.text());
  return j?.[code]?.[1]?.row ?? [];
}

// server/utils/map.ts 의 mapMember 와 동일한 필드(사진 제외)
function mapMember(r) {
  return {
    id: s(r.MONA_CD),
    name: s(r.HG_NM),
    hanja: s(r.HJ_NM),
    eng: s(r.ENG_NM),
    party: s(r.POLY_NM),
    origin: s(r.ORIG_NM),
    electType: s(r.ELECT_GBN_NM),
    committee: s(r.CMIT_NM),
    committees: s(r.CMITS),
    reelection: s(r.REELE_GBN_NM),
    sex: s(r.SEX_GBN_NM),
    units: s(r.UNITS),
    job: s(r.JOB_RES_NM),
    tel: s(r.TEL_NO),
    email: s(r.E_MAIL),
    homepage: s(r.HOMEPAGE),
    birth: s(r.BTH_DATE),
    staff: s(r.STAFF),
    secretary: s(r.SECRETARY),
  };
}

function save(data) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(data));
}

async function main() {
  if (!key()) {
    if (!existsSync(OUT)) save([]);
    console.warn("[gen-members] API_KEY 없음 — 기존 파일 유지");
    return;
  }
  const rows = await call(MEMBERS);
  const members = rows.map(mapMember).filter((m) => m.id);
  save(members);
  console.log(`[gen-members] ${members.length}명 베이크 → server/assets/members.json`);
}

main();
