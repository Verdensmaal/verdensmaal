// One-off: extract the primary (header) menu from a saved copy of the live homepage into src/_data/menu.json.
// Usage: node scripts/extract-menu.mjs <path-to-index.html>
import fs from "node:fs";

const OLD = /^https?:\/\/(www\.)?xn--verdensmlihverdagsliv-z2b\.dk/i;
const decode = (s) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&nbsp;/g, "\u00a0").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

const html = fs.readFileSync(process.argv[2], "utf8");
const start = html.indexOf('<ul id="menu-top-menu"');
if (start < 0) throw new Error("primary menu not found");
const tokens = html.slice(start).matchAll(/<ul[^>]*>|<\/ul>|<\/li>|<li[^>]*>|<a href="([^"]*)">([\s\S]*?)<\/a>/g);

const root = { children: [] };
const stack = [root]; // stack of "current item" (item whose children list is being filled)
let depth = 0;
let lastItem = null;
for (const m of tokens) {
  const t = m[0];
  if (t.startsWith("<ul")) {
    depth++;
    if (depth > 1) stack.push(lastItem); // sub-menu: children go to the last item
  } else if (t === "</ul>") {
    depth--;
    if (depth >= 1) stack.pop();
    if (depth === 0) break;
  } else if (t.startsWith("<a ")) {
    const item = { title: decode(m[2].replace(/<[^>]+>/g, "")).trim(), url: m[1].replace(OLD, "") || "/", children: [] };
    stack[stack.length - 1].children.push(item);
    lastItem = item;
  }
}
const prune = (items) => items.map((i) => (i.children.length ? { ...i, children: prune(i.children) } : { title: i.title, url: i.url }));
fs.writeFileSync("src/_data/menu.json", JSON.stringify(prune(root.children), null, 2) + "\n");
console.log("top-level items:", root.children.length);
