# Admin Dashboard

The admin home page (`/admin`) is a grid of widgets. Kempo ships widgets for pages, content, users, notifications and extensions, and any extension can add its own.

Each person arranges their own dashboard: which widgets are shown, in what order, and how big. That layout is kept in the browser's `localStorage` (`kempo:admin:dashboard`), so it is per person per browser and nothing is written to the server. **Customize** opens a dialog listing every widget: drag to reorder, pick a width and height, and hide or show each one. Nothing changes until **Save**; **Cancel** discards, and **Reset to defaults** restores the defaults in the dialog first. A layout that matches the defaults is not stored, so you keep following them as they change.

## Sizes

The grid is four blocks wide. A widget is 1 to 4 blocks wide and 1 to 3 blocks tall. On a narrow screen the grid drops to two or one columns and a wider widget fills the row; its saved width is kept for when there is room.

## Loading

The dashboard asks the server only for the list of widgets and their size limits (`GET /kempo/api/dashboard/widgets`). A widget's script is imported, and the widget fetches its own data, only once it is shown. A widget the user hides is never loaded, and showing it again loads fresh data.

## Disabling and uninstalling

- **Disabled extension:** its widgets leave the dashboard. The server still reports their ids as `unavailable`, and the browser keeps their entry (position, size, hidden state) in the saved layout even when you save other changes. Enable the extension and the widget returns where it was. The same applies to a widget you lose the permission for.
- **Uninstalled extension:** its widgets are deleted and no longer reported, so the next time you save the layout their entries are dropped.
- **Reset to defaults** clears these remembered entries too.
- The widget list is fetched when the dashboard loads, so a change made elsewhere shows up on the next reload.

## Upgrading an existing site

Extension widgets live in a `dashboardWidget` table. Kempo's own widgets are code and need nothing, so until the table exists the dashboard shows just those. Apply the table the way you apply any kempo schema change:

```bash
npx drizzle-kit push
```

## Adding a widget from an extension

Declare it in the extension's kempo config:

```json
"widgets": [
  {
    "key": "orders",
    "title": "Recent orders",
    "description": "Orders placed in the last week.",
    "icon": "storefront",
    "element": "k-shop-orders-widget",
    "module": "/my-ext/components/OrdersWidget.js",
    "defaultWidth": 2,
    "defaultHeight": 2,
    "minWidth": 2,
    "permission": "my-ext:orders:read"
  }
]
```

Widgets are registered on install, refreshed on update (and removed when no longer declared), and removed on uninstall. A disabled extension's widgets are not offered. To register from code instead, use `registerDashboardWidget` from the [Server SDK](extensions/sdk.md#dashboard).

| Field | Meaning |
|---|---|
| `key` | Required. Unique within your extension; letters, numbers, `.`, `_`, `-`. The widget's id is `owner:key`. |
| `title` | Required, up to 100 characters. The default header shows it. |
| `element` | Required. The custom element to create, e.g. `my-ext-orders-widget`. |
| `module` | Required. A site path (starting with a single `/`) to the script that defines the element. |
| `description`, `icon` | Optional. Shown when the user adds the widget back. `icon` is a `k-icon` name. |
| `defaultWidth`, `defaultHeight` | Initial size in blocks. Default 2 × 1. |
| `minWidth`, `maxWidth`, `minHeight`, `maxHeight` | What a user may resize to. Default 1–4 and 1–3. |
| `permission` | Optional. Only people who hold it see the widget. |
| `actions` | Optional, up to 3 link buttons for the header, see [Actions](#actions). |
| `priority` | Order among the defaults, lowest first. Default 100. Kempo's own are 10 to 50. |
| `defaultVisible` | `false` to make it opt-in. Default `true`. |

## Call to action

A widget may offer one primary thing to do. It is drawn the same way in every tile, as a button in a footer, so the dashboard looks consistent. It is optional.

Set `this.cta` in the constructor. A link:

```javascript
this.cta = { label: 'Manage content', icon: 'content', href: '/admin/content/templates' };
```

Or a callback:

```javascript
this.cta = { label: 'Mark all read', icon: 'done_all', onClick: () => this.markAllRead() };
```

Add `permission` to show it only to people who hold that permission, and override `getCta()` instead when it depends on state. For a callback that needs input, `openForm()` opens a standard dialog:

```javascript
this.cta = { label: 'New post', icon: 'add', permission: 'posts:create', onClick: () => this.newPost() };

newPost = () => this.openForm({
  title: 'New Post',
  confirmText: 'Create',
  fields: [{ name: 'name', label: 'Post title' }],
  submit: async ({ name }) => {
    const [error, result] = await createPost({ name });
    if(error) return error.msg;                 // shown in the dialog, which stays open
    window.location.href = `/admin/extension/my-ext/edit/${result.post.id}`;
  }
});
```

`fields` are `{ name, label, type, placeholder, value, options, required }`; `type` is `text`, `email`, `password` or `select` (with `options: [{ value, label }]`). Fields are required unless `required: false`. `submit` returns nothing to close the dialog, or a message to show and keep it open.

Kempo's own widgets use this: New page, Add user, Add extension, Mark all read, Manage content, and the blog's New post.

## Actions

A widget should let people do something, not only look. Actions are buttons in the widget's header.

Declare links in the registration:

```json
"actions": [
  { "label": "New order", "icon": "add", "href": "/admin/extension/my-ext/orders/new", "permission": "my-ext:orders:create" }
]
```

`label` and a site path `href` are required; `icon` is a `k-icon` name; `permission` hides that one action from people who do not hold it (the widget's own `permission` is separate). In a one-block-wide tile an action with an icon shows only the icon.

For anything that is not a plain link (open a dialog, call an API, then redirect), override `actions()` in the element and return `{ label, icon, onClick, primary }` objects. They are drawn after the declared ones:

```javascript
actions(){
  return [{ label: 'New post', icon: 'add', primary: true, onClick: this.newPost }];
}
```

If you override `renderHeader()`, call `this.renderActions()` where the buttons should go.

## Writing the widget

Extend `DashboardWidget`, fetch in `load()`, and render in `renderContent()`. The dashboard draws only the bordered tile; the widget owns everything inside it, header included. The default header is the registered icon and title. Override `renderHeader()` to add your own buttons or change it, using `renderTitle()` for the default icon and title:

```javascript
renderHeader(){
  return html`
    <header class="d-f px py b-bottom" style="align-items: center;">
      ${this.renderTitle()}
      <button class="no-btn pq" aria-label="Refresh" @click=${this.refresh}><k-icon name="restart_alt"></k-icon></button>
    </header>
  `;
}
```

Reordering, sizing and hiding are done in the dashboard's Customize dialog, so your header never has to make room for controls.

```javascript
import DashboardWidget from '/kempo/components/DashboardWidget.js';
import { html } from '/kempo-ui/lit-all.min.js';

export default class OrdersWidget extends DashboardWidget {
  static properties = { ...DashboardWidget.properties, orders: { state: true } };

  load = async () => {
    const response = await fetch('/kempo/api/my-ext/orders?limit=10');
    if(!response.ok) throw new Error('Could not load orders');
    this.orders = (await response.json()).orders;
  };

  renderContent(){
    return html`${this.orders.slice(0, this.height * 3).map(order => html`<div>${order.number}</div>`)}`;
  }
}

customElements.define('k-shop-orders-widget', OrdersWidget);
```

- `width` and `height` (blocks) are set on the element, so it can show more when it has room. `definition` is the registered widget (`title`, `icon`, ...).
- `load()` runs when the element connects and on `refresh()`. Throwing shows the message with a retry button.
- `unwrap(promise)` resolves an SDK call returning `[error, data]` to `data` or throws.
- `/kempo/sdk.js` has `getDashboardWidgets()` for the list.
- A widget's `permission` only hides it. The API your widget calls must enforce its own permissions.
