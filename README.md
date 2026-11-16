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
- `staticwebapp.config.json` – Azure Static Web Apps routing (404 page, redirects of old WP paths).

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

## Deploy to Azure Static Web Apps (Free plan)

1. Azure portal: create a **Static Web App**, plan type **Free**, deployment source **GitHub**, pick this repository and branch `main`.
   Build preset **Custom**: app location `/`, output location `_site`. Azure then adds its own workflow and secret.
2. Alternatively use the included `.github/workflows/azure-static-web-apps.yml`: create the Static Web App with source "Other",
   copy its deployment token into the GitHub repository secret `AZURE_STATIC_WEB_APPS_API_TOKEN`, and push to `main`.
   Pull requests get a preview environment that is closed when the PR is closed.

## Custom domain

The domain is `verdensmålihverdagsliv.dk` (punycode `xn--verdensmlihverdagsliv-z2b.dk`). In the Static Web App open
**Custom domains → Add**:

- `www.xn--verdensmlihverdagsliv-z2b.dk`: add a **CNAME** record pointing to the app's `*.azurestaticapps.net` hostname.
- Apex (`xn--verdensmlihverdagsliv-z2b.dk`): choose "TXT record validation", add the TXT record Azure shows, then
  point the apex at the app (ALIAS/ANAME at the DNS provider, or the A record Azure displays after validation).

Use the punycode form when entering names in Azure/DNS. Lower the TTL before switching, and keep the old host running until the new site validates.
