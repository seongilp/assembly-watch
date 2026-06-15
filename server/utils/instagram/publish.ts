const GRAPH = "https://graph.facebook.com/v21.0";

export interface PublishInput {
  igUserId: string;
  accessToken: string;
  imageUrl: string;
  caption: string;
}

async function post(url: string, params: Record<string, string>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  const json = (await res.json()) as { id?: string; error?: unknown };
  if (!res.ok || !json.id) {
    throw new Error(`Graph API 실패(${res.status}): ${JSON.stringify(json)}`);
  }
  return json.id;
}

/** 사진 1장 게시: 컨테이너 생성 → media_publish. 게시된 media id 반환. */
export async function publishPhoto(input: PublishInput): Promise<string> {
  const creationId = await post(`${GRAPH}/${input.igUserId}/media`, {
    image_url: input.imageUrl,
    caption: input.caption,
    access_token: input.accessToken,
  });
  const mediaId = await post(`${GRAPH}/${input.igUserId}/media_publish`, {
    creation_id: creationId,
    access_token: input.accessToken,
  });
  return mediaId;
}
