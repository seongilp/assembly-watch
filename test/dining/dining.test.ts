import { describe, it, expect } from "vitest";
import { mapColumns } from "../../scripts/lib/dining.mjs";

describe("mapColumns", () => {
  it("기본 파일 헤더를 표준 키 인덱스로 매핑", () => {
    const header = ["연번","의원번호","의원명","당","당ID","지역명","연월일","내역","지출","성명","분류"];
    expect(mapColumns(header)).toEqual({
      member: 2, party: 3, region: 5, date: 6, desc: 7, amount: 8, merchant: 9, category: 10,
      address: -1, biz: -1,
    });
  });

  it("연도별 라벨 변형(지출액/사용처)도 매핑", () => {
    const header = ["총연번","의원번호","의원명","당","당ID","지역명","연월일","내역","지출액","사용처","분류"];
    const m = mapColumns(header);
    expect(m.amount).toBe(8);
    expect(m.merchant).toBe(9);
  });

  it("리치 파일(주소/업종) 헤더 매핑", () => {
    const header = ["연번","의원번호","의원명","당","당ID","지역명","연월일","내역","수입","수입누계","지출","지출누계","잔액","성명","사업자번호","주소","업종","전화","영수증","분류"];
    const m = mapColumns(header);
    expect(m.amount).toBe(10);
    expect(m.merchant).toBe(13);
    expect(m.address).toBe(15);
    expect(m.biz).toBe(16);
    expect(m.category).toBe(19);
  });
});
