const fs = require("fs");
const cheerio = require("cheerio");

// Notion の L1 公開URL（あなたのURLのままでOK）
const L1_URL =
  "https://relieved-animantarx-a06.notion.site/L1-CIO-2cd840b3d8eb80cbb93deffcb4d825e1";

const OUT_FILE = "docs/L1.html";
const TEMPLATE_FILE = "docs/L1.html"; // 同じファイルをテンプレとして差し替える運用
const PRE_REGEX = /<pre id="content">[\s\S]*?<\/pre>/;

async function run() {
  // 1) Notion HTML取得
  const res = await fetch(L1_URL, {
    headers: {
      // たまに弾かれるのを避ける保険（効かない時もあるが害は少ない）
      "User-Agent":
        "Mozilla/5.0 (GitHubActions) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) throw new Error(`Failed to fetch L1: ${res.status}`);

  const notionHtml = await res.text();

  // 2) HTMLをパース
  const $ = cheerio.load(notionHtml);

  // 3) 余計なものを除去（重い/ノイズになりがち）
  $("script, style, noscript, svg, iframe, canvas").remove();

  // 4) 本文候補を優先順で探す（NotionのDOMは変わるのでフォールバック）
  const candidates = [
    "main",
    "article",
    '[role="main"]',
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
  if (!text) text = $("body").text() || "";

  // 5) テキスト整形（読みやすさ優先で“軽く”）
  const cleaned = normalizeText(text);

  // 6) docs/L1.html の <pre id="content">...</pre> を差し替え
  const template = fs.readFileSync(TEMPLATE_FILE, "utf-8");
  if (!PRE_REGEX.test(template)) {
    throw new Error(
      `Template does not contain <pre id="content">...</pre>: ${TEMPLATE_FILE}`
    );
  }

  const updated = template.replace(
    PRE_REGEX,
    `<pre id="content">${escapeHtml(cleaned)}</pre>`
  );

  fs.writeFileSync(OUT_FILE, updated, "utf-8");
  console.log(`Updated: ${OUT_FILE} (chars=${cleaned.length})`);
}

function normalizeText(input) {
  return (input || "")
    .replace(/\r/g, "")
    // 行末の余計な空白
    .replace(/[ \t]+\n/g, "\n")
    // 空行を最大2行に
    .replace(/\n{3,}/g, "\n\n")
    // 連続スペースを1つに
    .replace(/[ \t]{2,}/g, " ")
    // 前後の空白を落とす
    .trim();
}

function escapeHtml(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
