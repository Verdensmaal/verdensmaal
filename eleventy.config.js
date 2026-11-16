// Eleventy configuration for the Verdensmål i Hverdagsliv static site.

// Walk the menu tree and flag the current item / its ancestors (like WP's current-menu-item).
function markMenu(items, url) {
  return items.map((item) => {
    const children = item.children ? markMenu(item.children, url) : [];
    const current = item.url === url;
    const ancestor = children.some((c) => c.current || c.ancestor);
    return { ...item, children, current, ancestor };
  });
}

function findItem(items, url) {
  for (const item of items) {
    if (item.url === url) return item;
    const hit = item.children && findItem(item.children, url);
    if (hit) return hit;
  }
  return null;
}

export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/wp-content");
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy({ "staticwebapp.config.json": "staticwebapp.config.json" });

  eleventyConfig.addFilter("menuState", (menu, url) => markMenu(menu, url));
  eleventyConfig.addFilter("menuChildren", (menu, url) => {
    const item = findItem(menu, url);
    return item && item.children ? item.children : [];
  });
  eleventyConfig.addFilter("dkDate", (date) => {
    const d = new Date(date);
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
  });
  eleventyConfig.addFilter("isoDate", (date) => new Date(date).toISOString());

  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" },
    // Content files are plain HTML: do not run them through a template engine.
    htmlTemplateEngine: false,
    markdownTemplateEngine: false,
  };
}
