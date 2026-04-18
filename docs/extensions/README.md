# Extensions

Extensions are npm packages that add features to a kempo site. They can provide new routes, admin pages, database tables, settings, permissions, groups, and event hooks — all managed through the admin panel.

## Installing Extensions

In your project directory, install the npm package and then register it through the admin or the API:

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

- **Enable/Disable** — temporarily disable an extension without uninstalling it
- **Update** — pull the latest version from npm and apply any changes
- **Uninstall** — remove the extension and clean up its data

### Checking for Updates

The extensions list shows an "Update available" badge next to extensions that have a newer version on their git repository. Click **Update** to pull the latest version.

## Available Extensions

| Extension | Description |
|---|---|
| [`kempo-blog`](https://github.com/dustinpoissant/kempo-blog) | Blog system with posts, comments, and RSS |

## Creating Your Own Extension

See the [Extension Creation Guide](creating-extensions.md) for a step-by-step walkthrough.
