/** 의원 사진 최적화 — 원본 1.2MB JPG → wsrv.nl 로 리사이즈+webp (~1.5KB) */
export function memberPhoto(url: string, sizePx: number): string {
  if (!url) return "";
  const w = Math.round(sizePx * 2); // retina
  const enc = encodeURIComponent(url);
  return `https://wsrv.nl/?url=${enc}&w=${w}&h=${w}&fit=cover&a=top&output=webp&q=72`;
}
