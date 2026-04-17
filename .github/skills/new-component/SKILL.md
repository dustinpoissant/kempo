---
name: new-component
description: Creates a new Web Component for the kempo project — either an admin panel component (TableControl / ShadowComponent) or a consumer-facing component (LightComponent).
applyTo: "dist/**/*.js"
---

# New Component Skill

## Step 1 — Determine Component Type

Ask: is this component for the **admin panel** or for **consumer-facing** pages?

| Type | Directory | Custom element prefix | Typical base class |
|---|---|---|---|
| Admin | `dist/admin/components/` | `admin-` | `TableControl` or `ShadowComponent` |
| Consumer | `dist/kempo/components/` | `kempo-` | `LightComponent` |

---

## Step 2 — Choose a Base Class

Read the AGENTS.md section "Base Component Architecture" for full details. Summary:

| Base class | Import path | Use when |
|---|---|---|
| `TableControl` | `/kempo-ui/components/tableControls/TableControl.js` | Admin slot controls for `k-table` (`slot="before"`, `slot="after"`, `slot="top"`) |
| `ShadowComponent` | `/kempo-ui/components/ShadowComponent.js` | Shadow DOM encapsulation with automatic `/kempo.css` |
| `LightComponent` | `/kempo-ui/components/LightComponent.js` | Light DOM; no shadow DOM; used for consumer-facing components |
| `HybridComponent` | `/kempo-ui/components/HybridComponent.js` | Both shadow + light DOM needed simultaneously |

**Lit** is available at `/kempo-ui/lit-all.min.js` — import `html`, `css`, etc. from there.

---

## Step 3 — Write the Source File

### Admin component (TableControl)

`dist/admin/components/MyActionControl.js`:

```javascript
import TableControl from '/kempo-ui/components/tableControls/TableControl.js';
import { html } from '/kempo-ui/lit-all.min.js';
import '/kempo-ui/components/Icon.js';

export default class MyActionControl extends TableControl {
  /*
    Reactive Properties
  */
  static get properties() {
    return {
      myProp: { type: String, reflect: true }
    };
  }

  /*
    Lifecycle
  */
  connectedCallback() {
    super.connectedCallback();
    this.onTableEvent('selectionChange', () => this.requestUpdate());
  }

  /*
    Event Handlers
  */
  handleClick = () => {
    if(!this.table) return;
    // act on this.record (per-row) or this.table.getSelectedRecords() (batch)
  };

  /*
    Render
  */
  render() {
    return html`
      <button class="no-btn icon-btn" @click="${this.handleClick}">
        <k-icon name="add"></k-icon>
      </button>
    `;
  }
}

customElements.define('admin-my-action', MyActionControl);
```

### Consumer component (LightComponent)

`dist/kempo/components/MyWidget.js`:

```javascript
import LightComponent from '/kempo-ui/components/LightComponent.js';
import { html } from '/kempo-ui/lit-all.min.js';

export default class MyWidget extends LightComponent {
  /*
    Reactive Properties
  */
  static get properties() {
    return {
      value: { type: String, reflect: true }
    };
  }

  /*
    Lifecycle
  */
  connectedCallback() {
    super.connectedCallback();
  }

  updated(changedProperties) {
    super.updated(changedProperties);
  }

  /*
    Event Handlers
  */
  handleAction = () => {
    // handle interaction
  };

  /*
    Render
  */
  renderLightDom() {
    return html`<div class="kempo-component-my-widget">${this.value}</div>`;
  }
}

customElements.define('kempo-my-widget', MyWidget);
```

### Conventions (from AGENTS.md)

- Use **arrow functions** for event handlers and class methods to avoid binding.
- Use **`static get properties()`** to declare reactive props.
- Use **multi-line comments** (`/* ... */`) to separate logical sections (Lifecycle, Event Handlers, Render, etc.).
- **No leading underscores** on identifiers. Use native `#privateField` if true privacy is needed.
- **Default export** — one export per file, no `const` name: `export default class MyComponent extends ...`
- `customElements.define(...)` at the **bottom** of the file.
- End the file with an **empty line**.

---

## Step 4 — Import in the HTML Page

In the `<head>` (or before usage in `<body>`):

```html
<!-- Admin component -->
<script type="module" src="/admin/components/MyActionControl.js"></script>

<!-- Consumer component -->
<script type="module" src="/kempo/components/MyWidget.js"></script>
```

Then use the element:

```html
<admin-my-action slot="top"></admin-my-action>
<kempo-my-widget value="Hello"></kempo-my-widget>
```

---

## Step 5 — Icons

If the component uses icons, load the `get-icon` skill first:

```
.github/skills/get-icon/SKILL.md
```

- Use `<k-icon name="icon-name">` (never HTML entities or Unicode).
- Admin icons: download to `dist/admin/icons/` with `npx kempo-geticon <name> --dir dist/admin/icons`.
- Built-in kempo-ui icons are served from `/icons/` automatically.
- The admin icon path is configured as `window.kempo.pathsToIcons = ['/admin/icons', '/icons']`.

---

## Step 6 — TableControl API Reference

When extending `TableControl` for admin components:

| API | Description |
|---|---|
| `this.record` | The row record (for `slot="before"` / `slot="after"` controls) |
| `this.table` | The parent `<k-table>` element |
| `this.onTableEvent(eventName, handler)` | Subscribe to table events (e.g. `selectionChange`, `dataChange`) |
| `this.requestUpdate()` | Trigger a re-render |
| `new TableControl({ maxWidth: null })` | Pass options to super constructor (e.g. disable max-width) |

**Do NOT wrap `slot="after"` or `slot="before"` controls in `<k-permission>`** — the LightComponent `<slot>` inside Permission will hijack the table's pagination rendering.

---

## Notes

- **No build step** — files in `dist/` are served directly. There is no compilation.
- **No docs or test files** to create — components are verified live at `http://localhost:3000`.
- Use the running dev server (port 3000) to verify functionality and appearance after creating the component.
