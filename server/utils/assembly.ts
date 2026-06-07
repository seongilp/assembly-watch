/**
 * 열린국회정보 Open API 공통 클라이언트 (Nitro 서버 전용)
 *
 * - User-Agent 헤더 필수 (없으면 400 Bad Request)
 * - 응답 봉투: { [apiCode]: [ { head:[{list_total_count},{RESULT}] }, { row:[...] } ] }
 * - 데이터 없음/에러 시 head 없이 { RESULT:{CODE,MESSAGE} } 만 반환
 */

const BASE_URL = "https://open.assembly.go.kr/portal/openapi";
const CURRENT_AGE = 22;

/** 검증된 API 코드 (2026-06 라이브 검증) */
export const API = {
  /** 현직 국회의원 인적사항 (AGE 불필요) */
  MEMBERS: "nwvrqwxyaytdsfvhu",
  /** 계류의안 (AGE 불필요) */
  BILLS_PENDING: "nwbqublzajtcqpdae",
  /** 처리의안 (AGE 필요) */
  BILLS_PROCESSED: "nzpltgfqabtcpsmai",
  /** 의원 발의법률안 (AGE 필요) */
  BILLS_PROPOSED: "nzmimeepazxkubdpn",
  /** 본회의 표결 - 의안별 요약 (AGE 필요) */
  VOTES_PLENARY: "nwbpacrgavhjryiph",
  /** 본회의 표결 - 의원별 명단 (AGE + BILL_ID 필요) */
  VOTES_ROLLCALL: "nojepdqqaweusdfbi",
  /** 위원회 현황 (AGE 불필요) */
  COMMITTEES: "nxrvzonlafugpqjuh",
  /** 국회 일정 통합 (AGE 불필요) */
  SCHEDULE: "ALLSCHEDULE",
} as const;

export const AGE = CURRENT_AGE;

export interface ApiResult<T = Record<string, unknown>> {
  totalCount: number;
  rows: T[];
  code: string;
  message: string;
}

interface FetchOptions {
  pIndex?: number;
  pSize?: number;
  [key: string]: string | number | undefined;
}

/**
 * 열린국회정보 API 호출 + 정규화
 */
export async function fetchAssembly<T = Record<string, unknown>>(
  apiCode: string,
  options: FetchOptions = {},
): Promise<ApiResult<T>> {
  const config = useRuntimeConfig();
  const key = config.assemblyApiKey;
  if (!key) {
    throw createError({
      statusCode: 500,
      statusMessage:
        "API_KEY 가 설정되지 않았습니다. .env 에 API_KEY 를 추가하세요.",
    });
  }

  const query: Record<string, string | number> = {
    KEY: key,
    Type: "json",
    pIndex: options.pIndex ?? 1,
    pSize: options.pSize ?? 100,
  };
  for (const [k, v] of Object.entries(options)) {
    if (k === "pIndex" || k === "pSize") continue;
    if (v !== undefined && v !== "") query[k] = v;
  }

  let raw: unknown;
  try {
    // 국회 API는 Content-Type: text/html 로 응답하므로 텍스트로 받아 직접 파싱
    const text = await $fetch<string>(`${BASE_URL}/${apiCode}`, {
      query,
      headers: { "User-Agent": "Mozilla/5.0 (UijeongWatch)" },
      timeout: 15000,
      responseType: "text",
    });
    raw = typeof text === "string" ? JSON.parse(text) : text;
  } catch (err) {
    throw createError({
      statusCode: 502,
      statusMessage: `국회 API 호출 실패: ${(err as Error).message}`,
    });
  }

  return normalize<T>(raw, apiCode);
}

function normalize<T>(raw: unknown, apiCode: string): ApiResult<T> {
  // 에러/무데이터: { RESULT: { CODE, MESSAGE } }
  if (raw && typeof raw === "object" && "RESULT" in raw) {
    const r = (raw as { RESULT: { CODE: string; MESSAGE: string } }).RESULT;
    return { totalCount: 0, rows: [], code: r.CODE, message: r.MESSAGE };
  }

  const envelope = (raw as Record<string, unknown>)?.[apiCode];
  if (!Array.isArray(envelope)) {
    return { totalCount: 0, rows: [], code: "EMPTY", message: "데이터 없음" };
  }

  const head = (envelope[0] as { head?: unknown[] })?.head;
  const rowBlock = (envelope[1] as { row?: T[] })?.row;
  const totalCount =
    (head?.[0] as { list_total_count?: number })?.list_total_count ?? 0;
  const result = (head?.[1] as { RESULT?: { CODE: string; MESSAGE: string } })
    ?.RESULT;

  return {
    totalCount,
    rows: Array.isArray(rowBlock) ? rowBlock : [],
    code: result?.CODE ?? "INFO-000",
    message: result?.MESSAGE ?? "정상",
  };
}
