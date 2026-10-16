# The extension marketplace

**Admin > Extensions > Browse extensions** is a storefront for the Kempo extension marketplace at
<https://kempo.dev>. You can search it, sort by installs or rating, open an extension to read
its README and see what it requires and adds, and install it. The marketplace today lists first-party
extensions only, all free.

## Finding and viewing extensions

**Browse extensions** lists what is **not installed yet** on this site, so it is always a list of things you could add. Installed extensions are on the Extensions page, where the store button on each row opens that extension's marketplace page: README, what it requires and adds, and your rating of it.

## Installing from it

An extension's page shows the **whole tree** it needs: the extensions it requires, and the ones those
require, in the order they will be installed. Clicking **Install** lists exactly that and asks you to
approve it. Approving downloads each missing package with `npm install <name>@<version>` (which also
adds it to your `package.json`) and then installs them, dependencies first. If something it needs is
not in the marketplace, or is listed but not published, the page says so and does not offer to install.

Packages already in your project's `node_modules` are listed on the Extensions page under
**Downloaded, Not Installed** and install without a download.

## What your site sends

Your site's **server** talks to the marketplace; your browser never does.

- Reads (lists, details) are cached in memory for 5 minutes. If the marketplace cannot be reached, the
  last copy is used; with none, the Browse page says so. Browsing is the only thing that stops working:
  installing an extension already in `node_modules` and everything else on the Extensions page is
  unaffected.
- When you install an extension through the admin, the site tells the marketplace, so it can show how
  many sites run it. When you rate one, that is sent too.
- The site identifies itself with a **random UUID** it generates the first time it is needed and keeps
  in the `system:install_id` setting. It is used so that uninstalling and reinstalling counts as one
  install, and so a site has one rating per extension. It contains nothing about you, your site's name
  or its address.

To use a different marketplace, or none, set the `system:extensions_catalog_url` setting to its API
address (default `https://kempo.dev/api/v1`). An empty value turns the marketplace off: the
Browse page then says so and nothing is sent. It is not one of the seeded default settings (seeding
rewrites those on every run), so create it only if you want to change it.

## Ratings

A site may rate an extension 1 to 5 from the extension's page once it has had it installed for a
minute, and may change it later. The marketplace keeps one rating per site per extension.

## Things to know

- **Installing from the admin changes the running site's files.** On a container deployment that
  rebuilds its image from your repository, an extension downloaded from the admin is gone at the next
  deploy unless it is also in your repository's `package.json` (and lock file).
- Install runs `npm` on the server, so the process needs write access to the project folder and
  network access to the npm registry. Package names and versions are validated before `npm` runs, and
  only a name the marketplace lists is ever downloaded.
- Downloading is not trust. An extension is code that runs with your site's permissions. The
  marketplace lists first-party extensions only for now.

## API

All need `system:extensions:read` (install and rating need `system:extensions:install`).

| Request | Answer |
| --- | --- |
| `GET /kempo/api/extensions/known?search=&sort=&limit=&offset=` | a page of cards from the marketplace that are not installed here (`sort`: `installs`, `rating`, `name`, `updated`); add `includeInstalled=true` to list everything |
| `GET /kempo/api/extensions/known?name=<name>` | one extension in full, with its dependency tree, whether it is installed here, and this site's own rating |
| `GET /kempo/api/extensions/available` | packages already downloaded into this site |
| `POST /kempo/api/extensions` `{ name, withDependencies }` | downloads (if needed) and installs; with `withDependencies` it installs the whole tree first |
| `PUT /kempo/api/extensions/rating` `{ name, rating }` | this site's rating of an installed extension |
