const fs = require("fs");
const { Client } = require("@notionhq/client");

const layer = process.argv[2]; // L1-L5
const pageId = process.argv[3]; // Notion Page ID

if (!layer || !pageId) {
  console.error("Usage: node scripts/build_layer_api.js <LAYER> <PAGE_ID>");
  process.exit(1);
}

const notion = new Client({ auth: process.env.NOTION_TOKEN });

const OUT_FILE = `docs/${layer}.html`;
const TEMPLATE_FILE = "docs/_template.html";
const PRE_REGEX = /<pre id="content">[\s\S]*?<\/pre>/;

// 失敗しても「前回HTMLを保持」して Actions を落とさない（運用安定化）
const KEEP_PREVIOUS_ON_FAIL = true;

// レイヤ別の最低文字数（必要なら後で調整）
const MIN_CHARS_BY_LAYER = { L1: 200, L2: 200, L3: 200, L4: 1, L5: 200 };
const MIN_CHARS = MIN_CHARS_BY_LAYER[layer] ?? 1;

(async () => {
  if (!fs.existsSync(TEMPLATE_FILE)) throw new Error(`Template not found: ${TEMPLATE_FILE}`);

  const prevHtml = fs.existsSync(OUT_FILE) ? fs.readFileSync(OUT_FILE, "utf-8") : null;

  let cleaned = "";
  try {
    const text = await fetchAllBlocksPlainText(pageId);
    cleaned = normalizeText(text);
  } catch (e) {
    const msg = `${layer}: Notion API fetch failed: ${e?.message || e}`;
    if (KEEP_PREVIOUS_ON_FAIL && prevHtml) {
      console.log(`WARN: ${msg} -> keeping previous ${OUT_FILE}`);
      process.exit(0);
    }
    throw new Error(msg);
  }

  if (cleaned.length < MIN_CHARS) {
    const msg = `${layer}: Content too short (${cleaned.length}). Min required=${MIN_CHARS}.`;
    if (KEEP_PREVIOUS_ON_FAIL && prevHtml) {
      console.log(`WARN: ${msg} -> keeping previous ${OUT_FILE}`);
      process.exit(0);
    }
    throw new Error(msg);
  }

  const template = fs.readFileSync(TEMPLATE_FILE, "utf-8");
  if (!PRE_REGEX.test(template)) throw new Error('Template missing <pre id="content">');

  const updated = template.replace(PRE_REGEX, `<pre id="content">${escapeHtml(cleaned)}</pre>`);
  fs.writeFileSync(OUT_FILE, updated, "utf-8");
  console.log(`Updated ${layer}.html (chars=${cleaned.length})`);
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});

async function fetchAllBlocksPlainText(pageId) {
  const chunks = [];
  chunks.push(await listChildrenPlainText(pageId));
  return chunks.filter(Boolean).join("\n");
}

async function listChildrenPlainText(blockId) {
  const out = [];
  let cursor = undefined;

  while (true) {
    const resp = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: 100,
    });

    for (const b of resp.results) {
      out.push(extractTextFromBlock(b));
      if (b.has_children) out.push(await listChildrenPlainText(b.id));
    }

    if (!resp.has_more) break;
    cursor = resp.next_cursor;
  }

  return out.filter(Boolean).join("\n");
}

function extractTextFromBlock(block) {
  const obj = block?.[block.type];
  const rt = obj?.rich_text;
  if (!Array.isArray(rt)) return "";
  return rt.map((r) => r?.plain_text || "").join("");
}

function normalizeText(input) {
  return (input || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function escapeHtml(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
