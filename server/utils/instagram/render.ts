import { promises as fs } from "node:fs";
import { join, resolve } from "node:path";
import satori from "satori";
import { html as toVNode } from "satori-html";
import { Resvg } from "@resvg/resvg-js";
import type { PostSpec, PostItem } from "./catalog";
import { partyColor } from "~/lib/party";

// workers-og 는 Cloudflare Workers 전용 yoga wasm 을 싣고 있어 node-server 에서
// `Cannot find package 'a' imported from ...yoga.wasm` 으로 죽는다.
// 서빙이 홈서버(node)로 옮겨졌으므로 satori(레이아웃) + resvg(PNG 인코딩)로 렌더한다.

let fontCache: { regular: Buffer; bold: Buffer } | null = null;

/** 배포 정적 에셋 루트. standalone 실행 시 .output/server 기준 ../public. */
const publicDir = () => resolve(process.env.ASSETS_DIR ?? join(process.cwd(), "public"));

async function loadFonts() {
  if (fontCache) return fontCache;
  const dir = publicDir();
  const [regular, bold] = await Promise.all([
    fs.readFile(join(dir, "fonts/Pretendard-Regular.otf")),
    fs.readFile(join(dir, "fonts/Pretendard-Bold.otf")),
  ]);
  fontCache = { regular, bold };
  return fontCache;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// 1080² 안에서 헤더·푸터를 뺀 본문 높이는 약 600px. 5행이 그 안에 들어가도록
// 행 간격을 항목 수로 나눠 잡는다(고정 28px 이면 마지막 행이 푸터를 침범한다).
const ROW_BODY = 108; // 이름줄 + 막대줄 + 내부 여백
const rowGap = (n: number) => Math.max(6, Math.min(28, Math.floor((600 - n * ROW_BODY) / n)));

function row(it: PostItem, i: number, max: number, gap: number): string {
  // 최대 72%로 캡 → 값 라벨(예: "6선")이 같은 줄에 들어갈 여백 확보(줄바꿈 방지)
  const pct = Math.max(6, Math.round((it.value / max) * 72));
  const color = partyColor(it.party);
  return `
    <div style="display:flex;align-items:center;width:100%;margin-bottom:${gap}px;">
      <div style="display:flex;width:64px;font-size:44px;font-weight:700;color:#8B95A1;">${i + 1}</div>
      <div style="display:flex;flex-direction:column;flex:1;">
        <div style="display:flex;align-items:center;">
          <div style="display:flex;font-size:46px;font-weight:700;color:#191F28;">${esc(it.name)}</div>
          <div style="display:flex;margin-left:16px;font-size:28px;font-weight:700;color:${color};">${esc(it.party)}</div>
        </div>
        <div style="display:flex;align-items:center;margin-top:12px;">
          <div style="display:flex;height:18px;width:${pct}%;background:${color};border-radius:9px;"></div>
          <div style="display:flex;flex-shrink:0;white-space:nowrap;margin-left:18px;font-size:34px;font-weight:700;color:#191F28;">${it.value.toLocaleString("ko-KR")}${esc(it.unit)}</div>
        </div>
      </div>
    </div>`;
}

function buildHtml(spec: PostSpec): string {
  const max = Math.max(...spec.items.map((i) => i.value), 1);
  const gap = rowGap(Math.max(1, spec.items.length));
  const rows = spec.items.map((it, i) => row(it, i, max, gap)).join("");
  return `
    <div style="display:flex;flex-direction:column;width:1080px;height:1080px;padding:80px;background:#FFFFFF;font-family:Pretendard;">
      <div style="display:flex;font-size:34px;font-weight:700;color:#3182F6;">의정감시 · 오늘의 국회</div>
      <div style="display:flex;margin-top:18px;font-size:68px;font-weight:700;color:#191F28;">${esc(spec.headline)}</div>
      <div style="display:flex;margin-top:14px;font-size:32px;color:#8B95A1;">${esc(spec.subtitle)}</div>
      <div style="display:flex;flex-direction:column;margin-top:40px;flex:1;">${rows}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;border-top:2px solid #F2F4F6;padding-top:28px;">
        <div style="display:flex;font-size:30px;font-weight:700;color:#191F28;">asm.zihado.com</div>
        <div style="display:flex;font-size:28px;color:#8B95A1;">@landman.official</div>
      </div>
    </div>`;
}

/** 1080² PNG 바이트. satori 가 HTML → SVG, resvg 가 SVG → PNG. */
export async function renderPostPng(spec: PostSpec): Promise<Uint8Array> {
  const fonts = await loadFonts();
  const svg = await satori(toVNode(buildHtml(spec)) as never, {
    width: 1080,
    height: 1080,
    fonts: [
      { name: "Pretendard", data: fonts.regular, weight: 400, style: "normal" },
      { name: "Pretendard", data: fonts.bold, weight: 700, style: "normal" },
    ],
  });
  return new Resvg(svg, { fitTo: { mode: "width", value: 1080 } })
    .render()
    .asPng();
}
