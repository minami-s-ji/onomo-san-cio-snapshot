import fs from "fs";
import fetch from "node-fetch";

// ★ Notion の L1 公開URLをここに入れる
const L1_URL = "https://relieved-animantarx-a06.notion.site/L1-CIO-2cd840b3d8eb80cbb93deffcb4d825e1";

async function run() {
  const res = await fetch(L1_URL);
  if (!res.ok) throw new Error(`Failed to fetch L1: ${res.status}`);

  const text = await res.text();
  const html = fs.readFileSync("docs/L1.html", "utf-8");

  const updated = html.replace(
    /<pre id="content">[\s\S]*?<\/pre>/,
    `<pre id="content">\n${escapeHtml(text)}\n</pre>`
  );

  fs.writeFileSync("docs/L1.html", updated);
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

run();
