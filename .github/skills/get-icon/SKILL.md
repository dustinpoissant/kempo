---
name: get-icon
description: Fetches icons from the Google Material Design Icon set, saves it to this project, and then formats it.
---

# Get Icon

## When to Use

Use this skill any time an icon is needed — whether the user explicitly asks for one or you determine that a UI element (button, control, action, etc.) would benefit from one.

## Overview

Icons live in `dist/admin/icons/` for admin-specific icons (checked first), and kempo-ui's built-in icons at `node_modules/kempo-ui/icons/` are served at `/icons/`. The `pathsToIcons` for admin pages is `['/admin/icons', '/icons']`.

The workflow has three stages:

1. **Check local icons first** — the icon may already exist
2. **Find** the correct Material Symbols name if it doesn't
3. **Fetch, format, and save** using the npx scripts

---

## Stage 1: Check Local Icons First

Check `dist/admin/icons/` and `node_modules/kempo-ui/icons/` for an existing match.

- If a **clear match** exists, use it — no download needed.
- If a **reasonable match** exists for a directional icon, use it with the `direction` attribute.
- If **nothing fits**, proceed to Stage 2.

---

## Stage 2: Find the Icon Name

Search Google Material Symbols via npx:

```powershell
npx kempo-listicons <search_term>
```

Search matches both icon names **and tags**. Try multiple terms if the first returns nothing.

---

## Stage 3: Fetch, Format, and Save

Save admin-specific icons to `dist/admin/icons/` using `--dir`:

```powershell
npx kempo-geticon <icon_name> [custom_name] --dir dist/admin/icons [-y]
```

- `icon_name` — the Material Symbols name from the search
- `custom_name` — optional rename
- `--dir dist/admin/icons` — save to admin icons folder
- `-y` — auto-accept the directional prompt

Examples:
```powershell
# Non-directional
npx kempo-geticon format_bold --dir dist/admin/icons

# Directional with auto-accept
npx kempo-geticon chevron_left --dir dist/admin/icons -y
```

---

## Directional Icons and `<k-icon>`

| `direction` value | Rotation applied |
|---|---|
| *(omitted)* | 0° — points right |
| `down` | 90° |
| `left` | 180° |
| `up` | 270° |
