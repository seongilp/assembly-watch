import insightsData from "../../assets/insights.json";
import type { Insights, InsightMember } from "#shared/types";
import { normalizeParty } from "~/lib/party";

export interface PostItem {
  name: string;
  party: string;
  value: number;
  unit: string;
}

export interface PostSpec {
  slug: string;
  category: string;
  headline: string;
  subtitle: string;
  hashtags: string[];
  items: PostItem[];
}

type RankKey =
  | "terms" | "proposed" | "yes" | "no" | "blank" | "absent" | "attendanceLow";

interface DeckEntry {
  slug: string;
  key: RankKey;
  headline: string;
  subtitle: string;
  unit: string;
  hashtags: string[];
  valueOf: (m: InsightMember) => number;
}

/** 회전 덱. 순서·구성은 여기서만 바꾸면 된다. */
const DECK: DeckEntry[] = [
  { slug: "terms", key: "terms", headline: "최다선 의원 TOP 5", subtitle: "22대 국회 · 당선 횟수 기준", unit: "선", hashtags: ["다선", "중진의원"], valueOf: (m) => m.count ?? 0 },
  { slug: "proposed", key: "proposed", headline: "대표발의 최다 TOP 5", subtitle: "22대 국회 · 대표발의 법안 수", unit: "건", hashtags: ["법안발의", "입법활동"], valueOf: (m) => m.count ?? 0 },
  { slug: "yes", key: "yes", headline: "찬성표 최다 TOP 5", subtitle: "22대 본회의 표결 기준", unit: "표", hashtags: ["본회의", "표결"], valueOf: (m) => m.count ?? 0 },
  { slug: "no", key: "no", headline: "반대표 최다 TOP 5", subtitle: "22대 본회의 표결 기준", unit: "표", hashtags: ["본회의", "소신투표"], valueOf: (m) => m.count ?? 0 },
  { slug: "blank", key: "blank", headline: "기권표 최다 TOP 5", subtitle: "22대 본회의 표결 기준", unit: "표", hashtags: ["본회의", "기권"], valueOf: (m) => m.count ?? 0 },
  { slug: "absent", key: "absent", headline: "표결 불참 최다 TOP 5", subtitle: "22대 본회의 표결 기준", unit: "회", hashtags: ["본회의", "출석률"], valueOf: (m) => m.count ?? 0 },
  { slug: "attendanceLow", key: "attendanceLow", headline: "본회의 출석률 하위 TOP 5", subtitle: "22대 본회의 · 출석률(%)", unit: "%", hashtags: ["출석률", "성실의정"], valueOf: (m) => Math.round((m.rate ?? 0) * 10) / 10 },
];

export function buildCatalog(data: Insights = insightsData as unknown as Insights): PostSpec[] {
  return DECK.map((e): PostSpec => {
    const arr = (data[e.key] ?? []) as InsightMember[];
    const items: PostItem[] = arr.slice(0, 5).map((m) => ({
      name: m.name,
      party: normalizeParty(m.party),
      value: e.valueOf(m),
      unit: e.unit,
    }));
    return { slug: e.slug, category: e.key, headline: e.headline, subtitle: e.subtitle, hashtags: e.hashtags, items };
  }).filter((s) => s.items.length > 0);
}
