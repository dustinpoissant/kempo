# Admin UI

## Description
A server-rendered admin portal at `/admin/` for managing all CMS resources. Uses kempo-server templating for page rendering, kempo-ui components for layout and tables, and custom admin components for editors and table controls.

## Dependencies
- kempo-server — SSR templating (`.page.html`, `.template.html`, `.fragment.html`)
- kempo-ui — `<k-table>`, `<k-aside>`, `<k-main>`, `<k-icon>`, `<k-import>`, `TableControl`
- kempo-css — all styling via utility classes
- [Frontend SDK](frontend-sdk.md) — admin pages call SDK functions for data operations
- [Middleware](middleware.md) — `kempo-auth` protects all `/admin/**` routes

## Context
The admin portal is the primary interface for site administrators. It is not consumer-facing — consumers interact through the public pages. The admin is served from `dist/admin/` and mapped to `/admin/**` via `.config.json`.

### Decisions
- **Server-side rendered**: Admin pages use kempo-server's template system. Each page is a `.page.html` with frontmatter metadata.
- **kempo-ui `<k-table>`**: All list views use `<k-table>` with SDK data sources. Row actions use `TableControl` subclasses.
- **Custom admin components**: Editors (PageEditor, TemplateEditor, FragmentEditor, GlobalContentEditor, ValueEditor) and table controls (delete, link, install, uninstall) are in `dist/admin/components/`.
- **Monaco editor**: Code editing (templates, fragments, globals, settings) uses Monaco via a LightComponent wrapper.
- **Locked template**: `dist/admin/default.template.html` is system-owned and locked to prevent accidental edits from the admin UI.
- **Absolute paths**: Admin template uses absolute paths (`/kempo-css/...`) rather than `{{pathToRoot}}` since admin always lives at `/admin/`.

## Implementation

### Location
`dist/admin/` — mapped to `/admin/**` via `.config.json`.

### Template Structure
- `default.template.html` — shell with sidebar nav, `<k-main>` wrapper
- `nav.fragment.html` — sidebar navigation with sections: Site, Dashboard, Content, Accounts, Settings, Extensions
- `init.js` — sets icon paths, loads kempo-ui `Aside`, `Main`, `Import` components

### Page Sections
| Section | Path | Description |
|---|---|---|
| Dashboard | `/admin/` | Landing page |
| Templates | `/admin/content/templates/` | Template list and editor |
| Pages | `/admin/content/pages/` | Page list and editor |
| Fragments | `/admin/content/fragments/` | Fragment list and editor |
| Global Content | `/admin/content/globals/` | Global content list and editor |
| Users | `/admin/accounts/users/` | User list and detail |
| Groups | `/admin/accounts/groups/` | Group list and detail |
| Permissions | `/admin/accounts/permissions/` | Permission list |
| Settings | `/admin/settings/` | Settings list and editor |
| Extensions | `/admin/extensions/` | Extension manager with install/uninstall |

### Admin Components
| Component | Type | Purpose |
|---|---|---|
| `PageEditor` | ShadowComponent | Full page editor with template selection and content blocks |
| `TemplateEditor` | ShadowComponent | Template code editor |
| `FragmentEditor` | ShadowComponent | Fragment code editor |
| `GlobalContentEditor` | ShadowComponent | Global content entry editor |
| `ValueEditor` | ShadowComponent | Generic value editor (string/number/boolean/code) |
| `Monaco` | LightComponent | Monaco Editor wrapper |
| `TableRowDelete` | TableControl | Generic row delete button |
| `TableRowLink` | TableControl | Row link/navigate button |
| `InstallExtension` | TableControl | Install extension from available list |
| `UninstallExtension` | TableControl | Uninstall installed extension |
| `AddGroupControl` | TableControl | Add user to group |
| `GroupDeleteSelected` | TableControl | Bulk delete groups (protects system groups) |
| `GroupRemoveRecord` | TableControl | Remove single group membership |
| `ClearExpiredSessionsControl` | TableControl | Clear expired sessions |

## Notes
- The admin nav includes a theme selector at the bottom of the sidebar.
- Extension admin pages are served via `CATCH.js` which uses `renderExternalPage` from kempo-server.
