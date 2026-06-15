import { ImageResponse } from "workers-og";
import type { PostSpec, PostItem } from "./catalog";
import { partyColor } from "~/lib/party";

const FONT_BASE = "https://asm.zihado.com/fonts";
let fontCache: { regular: ArrayBuffer; bold: ArrayBuffer } | null = null;

async function loadFonts() {
  if (fontCache) return fontCache;
  const [regular, bold] = await Promise.all([
    fetch(`${FONT_BASE}/Pretendard-Regular.otf`).then((r) => r.arrayBuffer()),
    fetch(`${FONT_BASE}/Pretendard-Bold.otf`).then((r) => r.arrayBuffer()),
  ]);
  fontCache = { regular, bold };
  return fontCache;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function row(it: PostItem, i: number, max: number): string {
  const pct = Math.max(6, Math.round((it.value / max) * 100));
  const color = partyColor(it.party);
  return `
    <div style="display:flex;align-items:center;width:100%;margin-bottom:28px;">
      <div style="display:flex;width:64px;font-size:44px;font-weight:700;color:#8B95A1;">${i + 1}</div>
      <div style="display:flex;flex-direction:column;flex:1;">
        <div style="display:flex;align-items:center;">
          <div style="display:flex;font-size:46px;font-weight:700;color:#191F28;">${esc(it.name)}</div>
          <div style="display:flex;margin-left:16px;font-size:28px;font-weight:700;color:${color};">${esc(it.party)}</div>
        </div>
        <div style="display:flex;align-items:center;margin-top:12px;">
          <div style="display:flex;height:18px;width:${pct}%;background:${color};border-radius:9px;"></div>
          <div style="display:flex;margin-left:18px;font-size:34px;font-weight:700;color:#191F28;">${it.value.toLocaleString("ko-KR")}${esc(it.unit)}</div>
        </div>
      </div>
    </div>`;
}

function buildHtml(spec: PostSpec): string {
  const max = Math.max(...spec.items.map((i) => i.value), 1);
  const rows = spec.items.map((it, i) => row(it, i, max)).join("");
  return `
    <div style="display:flex;flex-direction:column;width:1080px;height:1080px;padding:80px;background:#FFFFFF;font-family:Pretendard;">
      <div style="display:flex;font-size:34px;font-weight:700;color:#3182F6;">의정감시 · 오늘의 국회</div>
      <div style="display:flex;margin-top:18px;font-size:68px;font-weight:700;color:#191F28;">${esc(spec.headline)}</div>
      <div style="display:flex;margin-top:14px;font-size:32px;color:#8B95A1;">${esc(spec.subtitle)}</div>
      <div style="display:flex;flex-direction:column;margin-top:56px;flex:1;">${rows}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;border-top:2px solid #F2F4F6;padding-top:28px;">
        <div style="display:flex;font-size:30px;font-weight:700;color:#191F28;">asm.zihado.com</div>
        <div style="display:flex;font-size:28px;color:#8B95A1;">@landman.official</div>
      </div>
    </div>`;
}

export async function renderPostResponse(spec: PostSpec): Promise<Response> {
  const fonts = await loadFonts();
  return new ImageResponse(buildHtml(spec), {
    width: 1080,
    height: 1080,
    fonts: [
      { name: "Pretendard", data: fonts.regular, weight: 400 },
      { name: "Pretendard", data: fonts.bold, weight: 700 },
    ],
  });
}
