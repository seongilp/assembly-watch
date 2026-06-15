const GRAPH = "https://graph.facebook.com/v21.0";

/** 컨테이너 상태 폴링 한도 (단일 CDN 이미지면 보통 즉시 FINISHED) */
const MAX_STATUS_TRIES = 5;
const STATUS_DELAY_MS = 3000;

export interface PublishInput {
  igUserId: string;
  accessToken: string;
  imageUrl: string;
  caption: string;
}

interface GraphError {
  message?: string;
  code?: number;
  fbtrace_id?: string;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** 토큰·요청 파라미터가 새지 않도록 안전한 필드만 추려 에러 메시지로 만든다. */
function formatGraphError(status: number, error: GraphError | undefined): string {
  const e = error ?? {};
  return `Graph API 실패(${status}): ${e.message ?? "unknown"} [code=${e.code ?? "?"} trace=${e.fbtrace_id ?? "?"}]`;
}

async function post(url: string, params: Record<string, string>): Promise<string> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  const json = (await res.json()) as { id?: string; error?: GraphError };
  if (!res.ok || !json.id) {
    throw new Error(formatGraphError(res.status, json.error));
  }
  return json.id;
}

/** 컨테이너가 FINISHED 가 될 때까지 폴링. ERROR/EXPIRED 또는 한도 초과 시 throw.
 *  토큰은 URL 이 아닌 Authorization 헤더로 전달(로그 노출 방지). */
async function waitForContainerReady(creationId: string, accessToken: string): Promise<void> {
  for (let i = 0; i < MAX_STATUS_TRIES; i++) {
    const res = await fetch(`${GRAPH}/${creationId}?fields=status_code`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const json = (await res.json()) as { status_code?: string; error?: GraphError };
    if (!res.ok) throw new Error(formatGraphError(res.status, json.error));

    const status = json.status_code;
    if (status === "FINISHED") return;
    if (status === "ERROR" || status === "EXPIRED") {
      throw new Error(`미디어 컨테이너 상태 ${status}`);
    }
    if (i < MAX_STATUS_TRIES - 1) await sleep(STATUS_DELAY_MS);
  }
  throw new Error("미디어 컨테이너가 제한시간 내 준비되지 않음(IN_PROGRESS)");
}

/** 사진 1장 게시: 컨테이너 생성 → 준비 확인 → media_publish. 게시된 media id 반환. */
export async function publishPhoto(input: PublishInput): Promise<string> {
  const creationId = await post(`${GRAPH}/${input.igUserId}/media`, {
    image_url: input.imageUrl,
    caption: input.caption,
    access_token: input.accessToken,
  });

  await waitForContainerReady(creationId, input.accessToken);

  const mediaId = await post(`${GRAPH}/${input.igUserId}/media_publish`, {
    creation_id: creationId,
    access_token: input.accessToken,
  });
  return mediaId;
}
