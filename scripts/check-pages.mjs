// Compares the pages/posts of the live WordPress REST API with the built site: every item (except the
// deliberately dropped ones) must exist at its original path in _site.
// Usage: node scripts/check-pages.mjs [dir-with-pages.json-and-posts.json]
//   Without an argument the live API is queried.
import fs from "node:fs";
import path from "node:path";

const ORIGIN = "http://xn--verdensmlihverdagsliv-z2b.dk";
const DROPPED = new Set([2, 33, 1]); // Sample Page, A homepage section, Hello world!
const SITE = path.resolve("_site");

async function load(type, dir) {
  if (dir) return JSON.parse(fs.readFileSync(path.join(dir, `${type}.json`), "utf8"));
  const res = await fetch(`${ORIGIN}/wp-json/wp/v2/${type}?per_page=100`);
  if (!res.ok) throw new Error(`${res.status} fetching ${type}`);
  return res.json();
}

const dir = process.argv[2];
const items = [...(await load("pages", dir)), ...(await load("posts", dir))];
const missing = [];
let ok = 0;
let skipped = 0;
for (const item of items) {
  if (DROPPED.has(item.id)) { skipped++; continue; }
  const urlPath = new URL(item.link).pathname;
  const file = path.join(SITE, ...urlPath.split("/").filter(Boolean), "index.html");
  if (fs.existsSync(file)) ok++;
  else missing.push(`${item.id} ${urlPath}`);
}
console.log(`${items.length} API items: ${ok} present, ${skipped} intentionally dropped, ${missing.length} missing.`);
if (missing.length) { console.log(missing.join("\n")); process.exitCode = 1; }
