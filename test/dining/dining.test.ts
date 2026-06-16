import { describe, it, expect } from "vitest";
import { mapColumns } from "../../scripts/lib/dining.mjs";
import { FOOD_CATEGORIES, isFoodRow, parseAmount } from "../../scripts/lib/dining.mjs";
import { normalizeMerchant, inferCuisine } from "../../scripts/lib/dining.mjs";
import { guOf, originGu, inOwnDistrict } from "../../scripts/lib/dining.mjs";
import { aggregate } from "../../scripts/lib/dining.mjs";

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

describe("FOOD_CATEGORIES", () => {
  it("식당 분류 4종을 포함", () => {
    expect([...FOOD_CATEGORIES].sort()).toEqual(
      ["간담회_다과","간담회_식대","사무실_식대비","언론_기자식대등"].sort(),
    );
  });
});

describe("isFoodRow", () => {
  it("식당 분류면 true, 아니면 false", () => {
    expect(isFoodRow("간담회_식대")).toBe(true);
    expect(isFoodRow("교통_택시")).toBe(false);
    expect(isFoodRow(null)).toBe(false);
  });
});

describe("parseAmount", () => {
  it("숫자/문자/콤마/음수 처리", () => {
    expect(parseAmount(70000)).toBe(70000);
    expect(parseAmount("1,200원")).toBe(1200);
    expect(parseAmount("-4000")).toBe(-4000);
    expect(parseAmount(null)).toBe(0);
  });
});

describe("normalizeMerchant", () => {
  it("괄호 보조설명·공백 정리, 동일 상호 병합", () => {
    expect(normalizeMerchant("엘에스씨푸드(국회의사당)")).toBe("엘에스씨푸드");
    expect(normalizeMerchant("투썸플레이스서여의도점")).toBe("투썸플레이스");
    expect(normalizeMerchant("  달구지 ")).toBe("달구지");
  });
  it("빈 값/null 은 빈 문자열", () => {
    expect(normalizeMerchant(null)).toBe("");
  });
});

describe("inferCuisine", () => {
  it("업종 우선 분류", () => {
    expect(inferCuisine("아무이름", "기관구내식당업")).toBe("구내식당");
    expect(inferCuisine("아무이름", "카페")).toBe("카페·음료");
    expect(inferCuisine("아무이름", "한식")).toBe("한식");
  });
  it("업종 없으면 가게명 휴리스틱", () => {
    expect(inferCuisine("스타벅스", null)).toBe("카페·음료");
    expect(inferCuisine("○○숯불갈비", null)).toBe("고기·구이");
    expect(inferCuisine("정체불명상호", null)).toBe("기타");
  });
});

describe("guOf", () => {
  it("주소에서 '시도 구' 추출", () => {
    expect(guOf("서울특별시영등포구국회대로72길22")).toBe("서울 영등포구");
    expect(guOf("경기도성남시분당구판교로")).toBe("경기 성남시");
  });
  it("파싱 불가 시 null", () => {
    expect(guOf("주소불명")).toBe(null);
  });
});

describe("originGu", () => {
  it("의원 지역구에서 '시도 구' 추출, 비례는 null", () => {
    expect(originGu("서울 영등포구을")).toBe("서울 영등포구");
    expect(originGu("비례대표")).toBe(null);
  });
});

describe("inOwnDistrict", () => {
  it("식당 시군구가 지역구와 같으면 true", () => {
    expect(inOwnDistrict("서울 영등포구", "서울 영등포구")).toBe(true);
    expect(inOwnDistrict("서울 강남구", "서울 영등포구")).toBe(false);
    expect(inOwnDistrict(null, "서울 영등포구")).toBe(false);
  });
});

const rows = [
  // {member, party, origin, amount, merchant, cuisine, category, gu}
  { member:"강득구", party:"더불어민주당", origin:"경기 안양시", amount:96000, merchant:"한류관", cuisine:"한식", category:"간담회_식대", gu:"서울 영등포구" },
  { member:"강득구", party:"더불어민주당", origin:"경기 안양시", amount:45000, merchant:"하동관", cuisine:"한식", category:"사무실_식대비", gu:"경기 안양시" },
  { member:"강득구", party:"더불어민주당", origin:"경기 안양시", amount:-45000, merchant:"하동관", cuisine:"한식", category:"사무실_식대비", gu:"경기 안양시" }, // 상쇄
];
const members = new Map([
  ["강득구", { id:"X1", name:"강득구", party:"더불어민주당", origin:"경기 안양시", ageBucket:"50대", gender:"남", zodiac:"토끼", wealthBucket:"10억 미만", pyeongBucket:"30평대" }],
]);

describe("aggregate", () => {
  const out = aggregate(rows, members);
  it("음수행을 상쇄해 합계 계산", () => {
    const m = out.byMember.find((x) => x.name === "강득구");
    expect(m.amount).toBe(96000); // 45000 - 45000 상쇄
    expect(m.visits).toBe(1);     // 상쇄된 쌍 제외, 순방문 1
  });
  it("식당 랭킹 생성", () => {
    expect(out.restaurants.find((r) => r.name === "한류관").amount).toBe(96000);
  });
  it("지역구 비율: 강득구는 모두 지역구 밖(영등포)", () => {
    const d = out.district.onlyInDistrict.concat(out.district.neverInDistrict);
    expect(out.byMember.find((x)=>x.name==="강득구").districtRate).toBe(0);
  });
  it("breakdowns 는 매칭 의원 기준 생성", () => {
    expect(out.breakdowns.byParty.find((b) => b.key === "더불어민주당").n).toBe(1);
  });
});
