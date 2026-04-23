# Build

## Description
The build script processes source files in `src/` and outputs minified/optimized versions to `dist/`. It runs as part of the development workflow and prepares the framework for distribution via npm.

## Dependencies
- [terser](https://www.npmjs.com/package/terser) — JavaScript minification
- [html-minifier-terser](https://www.npmjs.com/package/html-minifier-terser) — HTML minification with selective preservation

## Workflow

### Running the Build
```bash
npm run build
```

This processes all files in `src/` and outputs to `dist/`, maintaining the directory structure.

### Build Steps

1. **Clean** — Removes `dist/` directory entirely (start fresh)
2. **Walk** — Recursively discovers all files in `src/`
3. **Process** — For each file:
   - `.js` → Minify with terser, generate source maps, disable comments, enable mangling
   - `.html` → Minify with html-minifier-terser while preserving CMS front matter comments (important for page templating system)
   - `.json` → Minify by parsing and re-stringifying
   - All other files (`.svg`, images, etc.) → Copy as-is
4. **Report** — Print summary of files processed, size reduction, and elapsed time

### Output Structure
```
dist/
├── admin/                  # Admin portal (minified HTML, JS, JSON)
│   ├── index.page.html
│   ├── init.js
│   ├── init.js.map
│   ├── components/
│   ├── icons/
│   └── ...
└── kempo/                  # Framework SDK and API (minified)
    ├── sdk.js
    ├── sdk.js.map
    ├── api/                # API route handlers
    ├── components/
    ├── icons/
    └── ...
```

## File Processing Details

### JavaScript
- **Input**: `.js` files in `src/`
- **Output**: Minified + mangled `.js` files + corresponding `.js.map` source maps
- **Options**:
  - `mangle: true` — Rename variables for size reduction
  - `compress: true` — Remove unused code and simplify logic
  - `format: { comments: false }` — Strip comments
  - `sourceMap: true` — Include source maps in `.map` files with original source
- **Size Reduction**: ~23% average per file
- **Use Case**: Framework SDK, API routes, admin components

### HTML
- **Input**: `.html` files in `src/` (mostly `.page.html` and `.template.html`)
- **Output**: Minified HTML with preserved front matter
- **Front Matter**: Leading HTML comments like `<!-- locked: true -->` or YAML-style metadata blocks are preserved at the top of the file
- **Minification**: Collapses whitespace, removes comments (except front matter), removes redundant attributes
- **Size Reduction**: ~4% average per file
- **Use Case**: Admin pages, email templates, page templates

### JSON
- **Input**: `.json` files in `src/`
- **Output**: Minified JSON (no whitespace)
- **Size Reduction**: ~13% per file
- **Use Case**: Configuration files like `known-extensions.json`

### Other Files
- **Copied As-Is**: SVG icons, images, fonts
- **No Minification**: Reduces build complexity and preserves visual fidelity

## Build Summary Output

```
Building src/ → dist/

.......  [progress dots, one per file processed]

--- Build Summary ---

  JS    120 files   195.4KB → 150.6KB (23% reduction)
  HTML  19 files   130.1KB → 124.6KB (4% reduction)
  JSON  1 files   112B → 97B (13% reduction)
  Copy  28 files   12.6KB

  Total 325.6KB → 288.0KB (15% minification reduction)
  Time  0.60s

Build complete.
```

## What Gets Built

- **Included**: All of `src/admin/`, `src/kempo/` (API routes, SDK, components, icons)
- **Excluded**: `server/` (backend utilities, left unminified), `app-*` directories (user boilerplate), `bin/` (CLI entry point)

## Development Workflow

During development, files in `src/` are edited directly:
1. Changes made to `src/admin/`, `src/kempo/`
2. Run `npm run build` to generate `dist/`
3. The running dev server (`npm run dev`) serves `app-public/` for consumer-facing code
4. For framework code testing, the `dist/` output is what gets published to npm

## npm Publishing

The build output (`dist/`) is included in the npm package via the `"files"` field in `package.json`. Users importing from kempo get the minified, optimized code.

## Performance

- **Build Time**: ~0.6s for 168 source files
- **Total Output Size**: 288KB (minified) vs. 325.6KB (original) — 15% reduction
- **Source Maps**: 120 `.js.map` files enable debugging of minified code
