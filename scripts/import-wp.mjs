// One-off WordPress -> Eleventy migration. Fetches the REST API of the live site, writes
// src/pages/*.html and src/posts/*.html (front matter + WP content.rendered), and downloads
// all referenced assets. The generated files are the source of truth afterwards; this script
// is kept for reference only.
//
// Usage: node scripts/import-wp.mjs
import fs from "node:fs";
import path from "node:path";

const ORIGIN = "http://xn--verdensmlihverdagsliv-z2b.dk";
const OLD_DOMAIN_RE = /https?:\/\/(?:www\.)?(?:xn--verdensmlihverdagsliv-z2b\.dk|verdensmålihverdagsliv\.dk)/gi;
const DROP_IDS = new Set([2, 33, 1]); // Sample Page, A homepage section, Hello world!
const SUBPAGE_LIST_IDS = new Set([416, 242, 246]); // empty / "choose in the menu" pages
const SRC = path.resolve("src");

const decode = (s) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&nbsp;/g, " ").replace(/&hellip;/g, "…").replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}
async function getAll(type) {
  const all = [];
  for (let page = 1; ; page++) {
    const res = await fetch(`${ORIGIN}/wp-json/wp/v2/${type}?per_page=100&page=${page}`);
    if (!res.ok) break; // WP answers 400 past the last page
    const items = await res.json();
    all.push(...items);
    if (items.length < 100) break;
  }
  return all;
}

// ---------- assets ----------
const uploads = new Set(); // paths like /wp-content/uploads/2019/06/x.jpg (decoded)
const addUpload = (p) => {
  if (!p) return;
  p = p.replace(OLD_DOMAIN_RE, "").split(/[?#]/)[0];
  if (!p.startsWith("/wp-content/uploads/")) return;
  try { p = decodeURIComponent(p); } catch { /* keep as is */ }
  uploads.add(p);
};

async function download(urlPath, destRoot = SRC) {
  const dest = path.join(destRoot, ...urlPath.split("/").filter(Boolean));
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return "skip";
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const enc = (segFn) => ORIGIN + urlPath.split("/").map(segFn).join("/");
  const url = enc((seg) => encodeURIComponent(seg));
  // The live server stores non-ASCII upload names as mojibake (UTF-8 bytes read as Latin-1/cp1252),
  // so "gavejuletræ.jpg" is only reachable as "gavejuletr%C3%83%C2%A6.jpg". Used as a fallback; the
  // file is saved under the correct name so the URLs in the content work on the new site.
  const mojibake = (label) => (seg) => encodeURIComponent(new TextDecoder(label).decode(Buffer.from(seg, "utf8")));
  const candidates = [url];
  if ([...urlPath].some((ch) => ch.charCodeAt(0) > 127)) candidates.push(enc(mojibake("windows-1252")), enc(mojibake("latin1")));
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      let res;
      for (const c of candidates) { res = await fetch(c); if (res.ok) break; }
      if (!res.ok) return `fail ${res.status}`;
      fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
      return "ok";
    } catch (e) {
      if (attempt === 3) return `fail ${e.message}`;
    }
  }
}
async function pool(items, worker, size = 8) {
  const results = [];
  let i = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (i < items.length) { const idx = i++; results[idx] = await worker(items[idx]); }
  }));
  return results;
}

// Theme + block-library CSS (self-hosted under src/assets/).
async function fetchRemote(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}
async function downloadThemeAssets() {
  const T = "/wp-content/themes/twentysixteen";
  const out = path.join(SRC, "assets", "twentysixteen");
  const fontsCss = "fonts/merriweather-plus-montserrat-plus-inconsolata.css";
  const files = [
    [`${T}/style.css`, "style.css"],
    [`${T}/css/blocks.css`, "css/blocks.css"],
    [`${T}/genericons/genericons.css`, "genericons/genericons.css"],
    [`${T}/${fontsCss}`, fontsCss],
    ["/wp-includes/css/dist/block-library/style.min.css", "../block-library/style.min.css"],
    ["/wp-includes/css/dist/block-library/theme.min.css", "../block-library/theme.min.css"],
  ];
  for (const [remote, local] of files) await fetchRemote(ORIGIN + remote, path.join(out, local));
  // Everything referenced by url() in the font + genericons CSS (relative paths, so the layout under assets/ mirrors the theme).
  for (const [cssRemote, cssLocal] of [
    [`${T}/${fontsCss}`, fontsCss],
    [`${T}/genericons/genericons.css`, "genericons/genericons.css"],
  ]) {
    const css = fs.readFileSync(path.join(out, cssLocal), "utf8");
    const base = path.posix.dirname(cssRemote);
    const refs = new Set();
    for (const m of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
      if (m[1].startsWith("data:")) continue;
      refs.add(m[1].split(/[?#]/)[0]);
    }
    for (const ref of refs) {
      const remote = path.posix.normalize(path.posix.join(base, ref));
      let res = await fetch(ORIGIN + remote);
      if (!res.ok) {
        // The live IIS server has no woff/woff2 MIME mapping, so the theme's font files 404 there (visitors get
        // fallback fonts). The theme bundles @fontsource files under the same names: fetch them from npm instead.
        const m = remote.match(new RegExp("/fonts/([a-z]+)/([^/]+)$"));
        if (m) res = await fetch(`https://cdn.jsdelivr.net/npm/@fontsource/${m[1]}@5.0.8/files/${m[2]}`);
      }
      if (!res.ok) { console.warn("theme asset missing:", remote, res.status); continue; }
      const dest = path.join(out, path.dirname(cssLocal), ref);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    }
  }
}

// ---------- content cleanup ----------
function cleanContent(html, knownPaths) {
  let out = html;

  // Facebook emoji images -> real Unicode characters (codepoint(s) are in the file name).
  const emojiChar = (file) => String.fromCodePoint(...file.split("_").map((h) => parseInt(h, 16)));
  const emojiSrc = '<img[^>]*src="https?:\\/\\/static\\.xx\\.fbcdn\\.net\\/images\\/emoji\\.php\\/[^"]*?\\/([0-9a-f_]+)\\.png"[^>]*>';
  out = out.replace(new RegExp(`<figure class="wp-block-image">\\s*${emojiSrc}\\s*</figure>`, "gi"), (_, f) => `<p>${emojiChar(f)}</p>`);
  out = out.replace(new RegExp(emojiSrc, "gi"), (_, f) => emojiChar(f));

  // WP embed (earth7.carrytheearth.com): drop the iframe, keep the plain-link blockquote.
  out = out.replace(/<iframe[^>]*class="wp-embedded-content"[^>]*><\/iframe>\s*/gi, "");
  out = out.replace(/<blockquote class="wp-embedded-content"[^>]*>/gi, "<blockquote>");

  out = out.replace(/\sdata-packed="true"/g, "");
  out = out.replace(/ data-link="[^"]*"/g, ""); // gallery links to WP attachment pages

  // Links to WP attachment pages (?attachment_id=, /page/img_0214/) wrapping an image: link to the image file instead.
  out = out.replace(
    /<a\s([^>]*?)href="(https?:\/\/(?:www\.)?xn--verdensmlihverdagsliv-z2b\.dk[^"]*)"([^>]*)>(\s*<img[^>]*?src="([^"]+)"[^>]*>\s*)<\/a>/gi,
    (m, pre, href, post, inner, imgSrc) => {
      const p = href.replace(OLD_DOMAIN_RE, "");
      if (knownPaths.has(p) || p === "/") return m;
      const full = imgSrc.replace(/-\d+x\d+(\.\w+)$/, "$1"); // original size
      return `<a ${pre}href="${full}"${post}>${inner}</a>`;
    }
  );

  // Absolute links to the old domain -> root-relative.
  out = out.replace(OLD_DOMAIN_RE, "");
  out = out.replace(/href=""/g, 'href="/"');
  return out;
}

function collectUploads(html) {
  for (const m of html.matchAll(/(?:src|href|data-[\w-]+)=["']([^"']+)["']/g)) addUpload(m[1]);
  for (const m of html.matchAll(/srcset=["']([^"']+)["']/g))
    for (const part of m[1].split(",")) addUpload(part.trim().split(/\s+/)[0]);
}

function description(excerpt) {
  const text = decode(
    excerpt.replace(/<a[^>]*class="more-link"[^>]*>[\s\S]*?<\/a>/gi, "").replace(/<[^>]+>/g, " ")
  ).replace(/\s+/g, " ").replace(/…\s*$/, "").trim();
  if (!text) return "";
  return text.length > 200 ? text.slice(0, 197).replace(/\s+\S*$/, "") + "…" : text;
}

const yaml = (v) => JSON.stringify(v); // JSON strings are valid YAML

async function main() {
  console.log("Fetching API data…");
  const [pages, posts, media] = await Promise.all([getAll("pages"), getAll("posts"), getAll("media")]);
  const users = Object.fromEntries(
    (await getJson(`${ORIGIN}/wp-json/wp/v2/users`).catch(() => [])).map((u) => [u.id, u.name])
  );
  console.log(`pages ${pages.length}, posts ${posts.length}, media ${media.length}`);

  const pagePath = (item) => new URL(item.link).pathname;
  const knownPaths = new Set([...pages, ...posts].map(pagePath));

  // Media library: full size + every size variant.
  for (const m of media) {
    addUpload(m.source_url);
    for (const s of Object.values(m.media_details?.sizes ?? {})) addUpload(s.source_url);
  }
  // Logo (from the rendered homepage header).
  for (const p of ["2019/06/cropped-IphoneIkon-1.jpg", "2019/06/cropped-IphoneIkon-1-150x150.jpg", "2019/06/IphoneIkon-1.jpg"])
    uploads.add(`/wp-content/uploads/${p}`);

  const written = { pages: 0, posts: 0 };
  const writeContent = (file, fm, body) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const lines = Object.entries(fm).map(([k, v]) => `${k}: ${typeof v === "string" ? yaml(v) : v}`);
    fs.writeFileSync(file, `---\n${lines.join("\n")}\n---\n${body.trim()}\n`);
  };

  for (const p of pages) {
    if (DROP_IDS.has(p.id) || p.status !== "publish") continue;
    const urlPath = pagePath(p);
    const body = cleanContent(p.content.rendered, knownPaths);
    collectUploads(p.content.rendered);
    const fm = { title: decode(p.title.rendered), permalink: urlPath, layout: "layouts/page.njk", wpId: p.id };
    const desc = description(p.excerpt?.rendered ?? "");
    if (desc) fm.description = desc;
    if (p.id === 29) fm.home = true;
    if (p.id === 32) fm.blog = true;
    if (SUBPAGE_LIST_IDS.has(p.id)) fm.subpages = true;
    const rel = urlPath === "/" ? "index" : urlPath.replace(/^\/|\/$/g, "");
    writeContent(path.join(SRC, "pages", rel + ".html"), fm, body);
    written.pages++;
  }
  for (const p of posts) {
    if (DROP_IDS.has(p.id) || p.status !== "publish") continue;
    const urlPath = pagePath(p);
    const body = cleanContent(p.content.rendered, knownPaths);
    collectUploads(p.content.rendered);
    const fm = { title: decode(p.title.rendered), permalink: urlPath, layout: "layouts/post.njk", date: `${p.date_gmt}Z`, wpId: p.id };
    if (users[p.author]) fm.author = users[p.author];
    const desc = description(p.excerpt?.rendered ?? "");
    if (desc) fm.description = desc;
    writeContent(path.join(SRC, "posts", urlPath.replace(/^\/|\/$/g, "").replace(/\//g, "-") + ".html"), fm, body);
    written.posts++;
  }
  console.log("written", written);

  console.log("Downloading theme assets…");
  await downloadThemeAssets();

  console.log(`Downloading ${uploads.size} uploads…`);
  const list = [...uploads].sort();
  const results = await pool(list, download);
  const failed = list.filter((_, i) => results[i].startsWith("fail"));
  console.log(
    `done: ${results.filter((r) => r === "ok").length} downloaded, ${results.filter((r) => r === "skip").length} already present, ${failed.length} failed`
  );
  failed.forEach((f) => console.log("  FAILED", f, results[list.indexOf(f)]));
}
main().then(pruneMissingFontRefs).catch((e) => { console.error(e); process.exit(1); });

// (appended) Drop dangling woff fallbacks from the font CSS (fontsource has no "-all-" woff for Montserrat/Inconsolata).
function pruneMissingFontRefs() {
  const dir = path.join(SRC, "assets", "twentysixteen", "fonts");
  const file = path.join(dir, "merriweather-plus-montserrat-plus-inconsolata.css");
  const out = [];
  for (const line of fs.readFileSync(file, "utf8").split(String.fromCharCode(10))) {
    const start = line.indexOf("url('");
    const end = line.indexOf("')", start);
    if (line.includes("format('woff')") && start >= 0) {
      const ref = line.slice(start + 5, end).split("?")[0];
      if (!fs.existsSync(path.join(dir, ref))) {
        out[out.length - 1] = out[out.length - 1].replace(/,$/, ";"); // previous src line becomes the last one
        continue;
      }
    }
    out.push(line);
  }
  fs.writeFileSync(file, out.join(String.fromCharCode(10)));
}
