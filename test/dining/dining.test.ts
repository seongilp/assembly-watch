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
  it("'점'으로 끝나는 정상 상호를 삭제하지 않는다(C1 데이터손실 방지)", () => {
    expect(normalizeMerchant("마포돈까스전문점")).toBe("마포돈까스전문점");
    expect(normalizeMerchant("용산갈비집본점")).toBe("용산갈비집본점");
    expect(normalizeMerchant("신촌설렁탕직영점")).toBe("신촌설렁탕직영점");
    expect(normalizeMerchant("하동관")).toBe("하동관");
  });
  it("정규화 결과가 절대 빈 문자열이 되지 않는다(원본 보존)", () => {
    expect(normalizeMerchant("국회점")).not.toBe("");
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

describe("aggregate — 가게단위 cuisine/gu 전파", () => {
  // 같은 가게(달구지)에 업종-유래 행 1건 + 기타 행 여러 건. 주소는 한 행에만 존재.
  const propRows = [
    { member:"홍길동", party:"무소속", origin:"비례대표", amount:30000, merchant:"달구지", cuisine:"기타", category:"간담회_식대", gu:null },
    { member:"홍길동", party:"무소속", origin:"비례대표", amount:30000, merchant:"달구지", cuisine:"기타", category:"간담회_식대", gu:null },
    { member:"이순신", party:"무소속", origin:"비례대표", amount:30000, merchant:"달구지", cuisine:"고기·구이", category:"간담회_식대", gu:"서울 영등포구" },
  ];
  const out = aggregate(propRows, new Map());

  it("업종-유래 cuisine 이 같은 가게의 다른 연도 행에 전파됨", () => {
    const r = out.restaurants.find((x) => x.name === "달구지");
    expect(r.cuisine).toBe("고기·구이"); // 기타가 아니라 가장 구체적인 값
    expect(r.visits).toBe(3);
  });
  it("전체 cuisine 분포에서 모든 방문이 고기·구이로 집계(기타 0)", () => {
    expect(out.cuisine.find((c) => c.type === "고기·구이").visits).toBe(3);
    expect(out.cuisine.find((c) => c.type === "기타")).toBeUndefined();
  });
  it("주소 없는 옛 행도 가게의 knownGu 를 상속(addrCoverage=1)", () => {
    const r = out.restaurants.find((x) => x.name === "달구지");
    expect(r.gu).toBe("서울 영등포구");
    expect(out.district.addrCoverage).toBe(1); // 3행 모두 가게 gu 상속
  });
});

describe("aggregate — netRows 상쇄 명세(I1)", () => {
  it("고아 음수(매칭 양수 없음)는 폐기, 양수는 보존", () => {
    const r = [
      { member:"갑", party:"P", origin:"비례대표", amount:50000, merchant:"가게A", cuisine:"한식", category:"간담회_식대", gu:null },
      { member:"갑", party:"P", origin:"비례대표", amount:-99999, merchant:"가게A", cuisine:"한식", category:"간담회_식대", gu:null }, // 매칭 양수 없음 → 폐기
    ];
    const out = aggregate(r, new Map());
    const m = out.byMember.find((x) => x.name === "갑");
    expect(m.amount).toBe(50000); // 양수만 남음
    expect(m.visits).toBe(1);
  });
  it("부분 환불(금액 불일치)은 상쇄하지 않고 원 양수 보존", () => {
    const r = [
      { member:"을", party:"P", origin:"비례대표", amount:50000, merchant:"가게B", cuisine:"한식", category:"간담회_식대", gu:null },
      { member:"을", party:"P", origin:"비례대표", amount:-30000, merchant:"가게B", cuisine:"한식", category:"간담회_식대", gu:null }, // 50000 과 불일치 → 상쇄 안 됨
    ];
    const out = aggregate(r, new Map());
    const m = out.byMember.find((x) => x.name === "을");
    expect(m.amount).toBe(50000); // 부분환불은 무시(음수행 자체는 양수 집계서 제외)
    expect(m.visits).toBe(1);
  });
});

describe("bucketRows — 그룹 단골식당 topRestaurant(I2)", () => {
  const r = [
    { member:"가", party:"P", origin:"비례대표", amount:10000, merchant:"단골집", cuisine:"한식", category:"간담회_식대", gu:null },
    { member:"가", party:"P", origin:"비례대표", amount:10000, merchant:"단골집", cuisine:"한식", category:"간담회_식대", gu:null },
    { member:"가", party:"P", origin:"비례대표", amount:10000, merchant:"가끔집", cuisine:"한식", category:"간담회_식대", gu:null },
  ];
  const members = new Map([
    ["가", { id:"A1", name:"가", party:"P", origin:"비례대표", ageBucket:"50대", gender:"남", zodiac:"쥐", wealthBucket:"10억 미만", pyeongBucket:"20평대" }],
  ]);
  const out = aggregate(r, members);
  it("당별 행에 topRestaurant(최다 방문 가게) 포함", () => {
    const b = out.breakdowns.byParty.find((x) => x.key === "P");
    expect(b.topRestaurant).toBe("단골집");
    expect(b).toHaveProperty("topCuisine");
    expect(b).toHaveProperty("avgMeal");
  });
});

describe("aggregate — 식당별 대표주소 addr + 그룹 방문 분해(Task 7b)", () => {
  const r = [
    // 정당이 다른 두 의원이 같은 식당(여의도밥집) 방문. 한 행에만 주소 존재.
    { member:"민주의원", party:"더불어민주당", origin:"비례대표", amount:30000, merchant:"여의도밥집", cuisine:"기타", category:"간담회_식대", gu:null, addr:null },
    { member:"국힘의원", party:"국민의힘", origin:"비례대표", amount:30000, merchant:"여의도밥집", cuisine:"한식", category:"간담회_식대", gu:"서울 영등포구", addr:"서울특별시 영등포구 국회대로 1" },
    { member:"무명씨", party:"무소속", origin:"비례대표", amount:30000, merchant:"여의도밥집", cuisine:"기타", category:"간담회_식대", gu:null, addr:null }, // 매칭 안 됨 → groups 미반영, visits 는 포함
  ];
  const members = new Map([
    ["민주의원", { id:"D1", name:"민주의원", party:"더불어민주당", origin:"비례대표", ageBucket:"50대", gender:"남", zodiac:"쥐", wealthBucket:"10억 미만", pyeongBucket:"20평대" }],
    ["국힘의원", { id:"P1", name:"국힘의원", party:"국민의힘", origin:"비례대표", ageBucket:"60대", gender:"여", zodiac:"소", wealthBucket:"10~30억", pyeongBucket:"30평대" }],
  ]);
  const out = aggregate(r, members);
  const rest = out.restaurants.find((x) => x.name === "여의도밥집");

  it("식당에 대표주소(첫 비어있지 않은 addr) 전파", () => {
    expect(rest.addr).toBe("서울특별시 영등포구 국회대로 1");
  });
  it("gu 도 가게단위 전파(주소 없는 행 포함)", () => {
    expect(rest.gu).toBe("서울 영등포구");
    expect(rest.visits).toBe(3); // 매칭 여부 무관 총 방문
  });
  it("groups.party 에 매칭 의원의 두 정당이 카운트(미매칭 무명씨 제외)", () => {
    expect(rest.groups.party["더불어민주당"]).toBe(1);
    expect(rest.groups.party["국민의힘"]).toBe(1);
    expect(rest.groups.party["무소속"]).toBeUndefined(); // 미매칭은 groups 미반영
  });
  it("다른 차원(gender/zodiac/wealth/pyeong)도 분해", () => {
    expect(rest.groups.gender["남"]).toBe(1);
    expect(rest.groups.gender["여"]).toBe(1);
    expect(rest.groups.zodiac["쥐"]).toBe(1);
    expect(rest.groups.wealth["10~30억"]).toBe(1);
    expect(rest.groups.pyeong["20평대"]).toBe(1);
  });
});

describe("aggregate — 식당 안정 id + details(방문 의원·연도별 추이)", () => {
  const r = [
    // 인기순: 많이간집(4) > 가끔집(1). id 는 방문순 정렬 후 r0, r1.
    { member:"갑", party:"더불어민주당", origin:"비례대표", amount:10000, merchant:"많이간집", cuisine:"한식", category:"간담회_식대", gu:"서울 영등포구", addr:"서울 영등포구 1", year:2023 },
    { member:"갑", party:"더불어민주당", origin:"비례대표", amount:20000, merchant:"많이간집", cuisine:"한식", category:"간담회_식대", gu:"서울 영등포구", addr:"서울 영등포구 1", year:2024 },
    { member:"을", party:"국민의힘", origin:"비례대표", amount:30000, merchant:"많이간집", cuisine:"한식", category:"간담회_식대", gu:"서울 영등포구", addr:"서울 영등포구 1", year:2024 },
    { member:"무명", party:"개혁신당", origin:"비례대표", amount:5000, merchant:"많이간집", cuisine:"한식", category:"간담회_식대", gu:"서울 영등포구", addr:"서울 영등포구 1", year:2024 }, // 미매칭
    { member:"갑", party:"더불어민주당", origin:"비례대표", amount:7000, merchant:"가끔집", cuisine:"한식", category:"간담회_식대", gu:null, addr:null, year:2022 },
  ];
  const members = new Map([
    ["갑", { id:"G1", name:"갑", party:"더불어민주당", origin:"비례대표", ageBucket:"50대", gender:"남", zodiac:"쥐", wealthBucket:"10억 미만", pyeongBucket:"20평대" }],
    ["을", { id:"E1", name:"을", party:"국민의힘", origin:"비례대표", ageBucket:"60대", gender:"여", zodiac:"소", wealthBucket:"10~30억", pyeongBucket:"30평대" }],
  ]);
  const out = aggregate(r, members);

  it("방문순 정렬 후 안정 id(r0,r1) 부여", () => {
    expect(out.restaurants[0].name).toBe("많이간집");
    expect(out.restaurants[0].id).toBe("r0");
    expect(out.restaurants[1].id).toBe("r1");
  });
  it("details 가 id 로 키잉, rank=index+1", () => {
    const d = out.details["r0"];
    expect(d.name).toBe("많이간집");
    expect(d.rank).toBe(1);
    expect(d.visits).toBe(4);
    expect(d.amount).toBe(65000); // 10000+20000+30000+5000
    expect(d.gu).toBe("서울 영등포구");
  });
  it("members: 두 의원 방문 집계 + 미매칭은 id 빈문자열", () => {
    const d = out.details["r0"];
    // 방문수 desc: 갑(2) > 을(1) = 무명(1) → 동점은 name localeCompare
    const gap = d.members.find((m) => m.name === "갑");
    expect(gap).toMatchObject({ id: "G1", party: "더불어민주당", visits: 2, amount: 30000 });
    const eul = d.members.find((m) => m.name === "을");
    expect(eul).toMatchObject({ id: "E1", party: "국민의힘", visits: 1, amount: 30000 });
    const un = d.members.find((m) => m.name === "무명");
    expect(un).toMatchObject({ id: "", party: "개혁신당", visits: 1 });
    expect(d.members[0].name).toBe("갑"); // 최다 방문 선두
  });
  it("byYear: 연도별 합계, 오름차순", () => {
    const d = out.details["r0"];
    expect(d.byYear).toEqual([
      { year: 2023, visits: 1, amount: 10000 },
      { year: 2024, visits: 3, amount: 55000 },
    ]);
  });
  it("id 가 결정적(동일 입력 → 동일 매핑)", () => {
    const out2 = aggregate(r, members);
    expect(out2.restaurants.map((x) => `${x.id}:${x.name}`)).toEqual(out.restaurants.map((x) => `${x.id}:${x.name}`));
  });
});
