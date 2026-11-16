# Verdensmål i Hverdagsliv – static site

Static [Eleventy](https://www.11ty.dev/) 3 replica of the former WordPress site
(Twenty Sixteen theme). No CMS, no jQuery, no plugins.

## Run locally

```sh
npm install
npm start          # dev server with live reload, http://localhost:8080
npm run build      # writes the site to _site/
```

Checks after a build:

```sh
node scripts/check-links.mjs   # every local href/src resolves, no old-domain leftovers
node scripts/check-pages.mjs   # every page/post of the old WP API exists in _site
```

## Layout

- `src/pages/*.html` – one file per page (front matter + HTML body). `permalink` keeps the original WordPress URL.
- `src/posts/*.html` – blog posts (listed at `/blog/`, newest first).
- `src/_data/menu.json` – the navigation (header and footer), nested `title` / `url` / `children`.
- `src/_includes/` – layouts (`layouts/base.njk`, `page.njk`, `post.njk`), menu macro, sidebar and "Vil du gerne i gang selv?" widgets.
- `src/wp-content/uploads/` – images and documents, same URLs as on the old site.
- `src/assets/` – theme CSS, fonts, `js/navigation.js` (mobile menu / sub-menu toggles).
- `scripts/import-wp.mjs` – one-off WordPress migration, kept for reference only. The generated files are now the source of truth.

## Add or edit a page

1. Create `src/pages/my-page.html`:

   ```html
   ---
   title: "My page"
   permalink: "/my-page/"
   layout: "layouts/page.njk"
   description: "Optional meta description"
   ---
   <p>Page content as plain HTML.</p>
   ```

2. Add it to `src/_data/menu.json` (under the right parent, as `{ "title": "My page", "url": "/my-page/" }`).
3. Put images in `src/wp-content/uploads/…` (or anywhere you passthrough-copy) and link them with root-relative paths.

Set `subpages: true` in the front matter to append an automatic list of the page's menu children under the content.
A new blog post goes in `src/posts/` with `layout: "layouts/post.njk"` and a `date`.

## Deploy (GitHub Pages)

Every push to `main` builds the site and publishes it with `.github/workflows/pages.yml`
(repository **Settings → Pages → Source: GitHub Actions**). The repository must stay public, because the
organisation is on GitHub's free plan.

Azure Static Web Apps was tried first, but it rejects domains containing æ/ø/å, in both the Unicode and punycode forms.

## Custom domain

The domain is `verdensmålihverdagsliv.dk` (punycode `xn--verdensmlihverdagsliv-z2b.dk`), with DNS at Simply.com.
**Settings → Pages → Custom domain** is set to the apex domain (punycode form). Its DNS records:

| Type  | Name | Value |
| ----- | ---- | ----- |
| A     | @    | 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153 |
| AAAA  | @    | 2606:50c0:8000::153, 2606:50c0:8001::153, 2606:50c0:8002::153, 2606:50c0:8003::153 |
| CNAME | www  | verdensmaal.github.io |

GitHub issues the HTTPS certificate automatically once DNS resolves. `www` redirects to the apex.
