// Link checker for the built site: every local (root-relative) href/src/srcset target in _site must exist.
// Also fails on leftovers of the old WordPress site (old domain, wp-includes/js, jquery).
// Usage: node scripts/check-links.mjs   (after `npm run build`)
import fs from "node:fs";
import path from "node:path";

const SITE = path.resolve("_site");
const broken = new Map(); // target -> Set(pages)
const leftovers = [];
let checked = 0;
let pageCount = 0;

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]
  );
}

function exists(urlPath) {
  let p;
  try { p = decodeURIComponent(urlPath); } catch { p = urlPath; }
  const file = path.join(SITE, ...p.split("/").filter(Boolean));
  if (!file.startsWith(SITE)) return false;
  if (fs.existsSync(file) && fs.statSync(file).isFile()) return true;
  return fs.existsSync(path.join(file, "index.html"));
}

for (const file of walk(SITE).filter((f) => f.endsWith(".html"))) {
  pageCount++;
  const html = fs.readFileSync(file, "utf8");
  const page = "/" + path.relative(SITE, file).split(path.sep).join("/");

  if (/xn--verdensmlihverdagsliv-z2b\.dk/i.test(html)) leftovers.push(`${page}: old domain`);
  if (/wp-includes\/js|jquery/i.test(html)) leftovers.push(`${page}: wp-includes/js or jquery`);

  const targets = [];
  for (const m of html.matchAll(/\b(?:href|src)=["']([^"']*)["']/g)) targets.push(m[1]);
  for (const m of html.matchAll(/\bsrcset=["']([^"']*)["']/g))
    for (const part of m[1].split(",")) targets.push(part.trim().split(/\s+/)[0]);

  for (const t of targets) {
    if (!t.startsWith("/") || t.startsWith("//")) continue; // external, mailto:, anchors
    const clean = t.split(/[?#]/)[0];
    checked++;
    if (!exists(clean)) {
      if (!broken.has(clean)) broken.set(clean, new Set());
      broken.get(clean).add(page);
    }
  }
}

console.log(`Scanned ${pageCount} HTML files, ${checked} local references.`);
if (leftovers.length) console.log("Leftovers of the old site:\n  " + leftovers.join("\n  "));
else console.log("No old-domain / wp-includes/js / jquery references.");
if (broken.size) {
  console.log(`\n${broken.size} broken local reference(s):`);
  for (const [t, pages] of broken) console.log(`  ${t}\n      in: ${[...pages].slice(0, 5).join(", ")}${pages.size > 5 ? ", …" : ""}`);
  process.exitCode = 1;
} else {
  console.log("All local references resolve.");
}
