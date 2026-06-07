import members from "../assets/member-details.json";
import committees from "../assets/committees.json";

const BASE = "https://asm.zihado.com";

export default defineEventHandler((event) => {
  const urls: string[] = [
    "/",
    "/members",
    "/bills",
    "/votes",
    "/committees",
    "/schedule",
    "/insights",
  ];
  for (const id of Object.keys(members as Record<string, unknown>))
    urls.push(`/members/${id}`);
  for (const c of committees as { deptCd: string }[])
    if (c.deptCd) urls.push(`/committees/${c.deptCd}`);

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${BASE}${u}</loc></url>`).join("\n")}
</urlset>`;

  setHeader(event, "content-type", "application/xml; charset=utf-8");
  return body;
});
