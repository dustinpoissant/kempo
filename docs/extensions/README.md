# Extensions

Extensions are npm packages that add features to a kempo site. They can provide new routes, admin pages, database tables, settings, permissions, groups, and event hooks — all managed through the admin panel.

## Installing Extensions

Extensions in the [extension catalogue](catalogue.md) (the first-party ones, today) are listed under **Admin > Extensions** and downloaded and installed with one click. Any other extension package is installed with npm first and then registered through the admin or the API:

```bash
npm install kempo-blog
```

Then go to **Admin > Extensions** and click **Install** next to `kempo-blog`, or call the API:

```bash
curl -X POST http://localhost:3000/kempo/api/extensions \
  -H "Content-Type: application/json" \
  -b "session_token=YOUR_TOKEN" \
  -d '{"name": "kempo-blog"}'
```

On install, kempo will automatically:
- Create any database tables declared by the extension
- Register any permissions, settings, and groups
- Register any event hooks
- Run the extension's `install.js` if present

## Managing Extensions

The **Admin > Extensions** page shows all installed extensions with their status. From there you can:

- **Disable / Enable** (the pause and play button) — switch an extension off without uninstalling it. It stays installed with all its data, settings and groups, but the CMS does not use it: its public files, admin pages, dashboard widgets and hooks are left out until you enable it again. Disabling one that other extensions require also disables them, and everything that requires those; the dialog lists that whole chain first and nothing happens until you agree. Enabling works the same way in the other direction: an extension cannot run without what it requires, so enabling one whose requirements are switched off also enables them (and what those require), after the dialog lists them and you agree. Nothing else that was switched off is turned on. A requirement that is not installed at all cannot be fixed by enabling, and is named. Installing from the marketplace lists, in the same dialog, what it will install and what it will enable.
- **Update** — pull the latest version from npm and apply any changes
- **Uninstall** — remove the extension. Its data is kept unless you tick the box to delete it. An extension cannot stay installed without what it requires, so uninstalling one that others require uninstalls them too (disabled ones included): the dialog lists the whole chain first, and nothing happens until you agree.

### Checking for Updates

The extensions list shows an "Update available" badge next to extensions that have a newer version on their git repository. Click **Update** to pull the latest version.

## Available Extensions

| Extension | Description |
|---|---|
| [`kempo-blog`](https://github.com/dustinpoissant/kempo-blog) | Blog system with posts, comments, and RSS |

## Creating Your Own Extension

See the [Extension Creation Guide](creating-extensions.md) for a step-by-step walkthrough.
