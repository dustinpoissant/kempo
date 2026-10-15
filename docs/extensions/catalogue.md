# The extension catalogue

The **Available Extensions** list in the admin is built from two places:

1. packages already in your project's `node_modules` that have a `kempo-config.json`, and
2. the **extension catalogue** at <https://extensions.kempo.dev>, a public list of extensions built from
   each extension's own repository (its `package.json`, `kempo-config.json` and README).

An extension from the catalogue that is not downloaded yet shows as available too. **Install** downloads
it with `npm install <name>@<version>` (which also adds it to your `package.json`) and then installs it
the usual way. The **Details** button shows who wrote it, what it requires and adds, and its README.

Today the catalogue lists first-party extensions only, all free.

## How your site reads it

Only your site's **server** talks to the catalogue; the admin in the browser only calls your site's own
API.

- The answer is cached in `.cache/extensions-catalog.json` in the project folder for **5 minutes** and
  revalidated with an `ETag`.
- If the catalogue cannot be reached, the last good copy is used however old it is, and the Extensions
  page says so. A site that has never reached it falls back to the short list that ships with kempo.
- What it returns is checked before use: only known fields are kept, links must be `http(s)`, and the
  size is capped. It is never executed.

To use a different catalogue, or none, set the `system:extensions_catalog_url` setting. An empty value
turns the catalogue off (only packages already in `node_modules` are offered). It is not one of the
seeded default settings, so create it only if you want to change it.

## Things to know

- **Installing from the admin changes the running site's files.** On a container deployment that
  rebuilds its image from your repository, an extension downloaded from the admin is gone at the next
  deploy unless it is also in your repository's `package.json` (and lock file).
- Install runs `npm` on the server, so the process needs write access to the project folder and
  network access to the npm registry. Package names and versions are validated before `npm` is run, and
  only a name that is in the catalogue is ever downloaded.
- Downloading is not trust. An extension is code that runs with your site's permissions; the catalogue
  lists first-party extensions only for now.

## API

All need `system:extensions:read` (the install route needs `system:extensions:install`).

| Request | Answer |
| --- | --- |
| `GET /kempo/api/extensions/available` | installed-on-disk plus catalogue extensions, each with `needsDownload`, `installable`, `requires`, and a `catalog` block (`from`: `fresh`, `network`, `stale` or `seed`; `problem`) |
| `GET /kempo/api/extensions/known` | the catalogue, without READMEs |
| `GET /kempo/api/extensions/known?name=<name>` | one catalogue entry with its README |
| `POST /kempo/api/extensions` `{ name }` | downloads (if needed) and installs |
