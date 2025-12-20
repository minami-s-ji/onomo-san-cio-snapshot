const fs = require("fs");
const cheerio = require("cheerio");

// Notion の L1 公開URL（あなたのURLのままでOK）
const L1_URL =
  "https://relieved-animantarx-a06.notion.site/L1-CIO-2cd840b3d8eb80cbb93deffcb4d825e1";

async function run() {
  const res = await fetch(L1_URL);
  if (!res.ok) throw new Error(`Failed to fetch L1: ${res.status}`);

  const html = await res.text();

  // 1) HTMLをパース
  const $ = cheerio.load(html);

  // 2) 余計なものを除去
  $("script, style, noscript, svg").remove();

  // 3) 本文っぽい領域を優先して抽出（取れなければ body 全体）
  // NotionのDOMは変わり得るので、複数候補でフォールバックする
  const candidates = [
    "main",
    "article",
    ".notion-page-content",
    ".notion-scroller",
    "body",
  ];

  let text = "";
  for (const sel of candidates) {
    const t = $(sel).text();
    if (t && t.trim().length > 200) {
      text = t;
      break;
    }
  }
  if (!text) text = $("body").text();

  // 4) テキストを整形（空白/改行を適度に）
  const cleaned = text
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  // 5) docs/L1.html の <pre id="content">...</pre> を差し替え
  const template = fs.readFileSync("docs/L1.html", "utf-8");
  const updated = template.replace(
    /<pre id="content">[\s\S]*?<\/pre>/,
    `<pre id="content">${escapeHtml(cleaned)}</pre>`
  );

  fs.writeFileSync("docs/L1.html", updated, "utf-8");
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
