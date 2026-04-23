# CLI

## Description
A command-line tool (`npx kempo init`) that scaffolds a new kempo project. It guides the user through a full setup wizard — Docker/Postgres configuration, file scaffolding, database initialization, admin user creation, and email service configuration — leaving the user one `npm run dev` away from a working site.

## Dependencies
- [Database](db.md) — pushes schema and runs seeding via `drizzle-kit push` and `init-db.js`
- Docker Desktop — required for Postgres
- kempo-server — the scaffolded project uses kempo-server for routing

## Context
Kempo is installed as an npm package (`npm install kempo`). The init script creates the project structure in the consumer's working directory, setting up everything needed to start building.

### Decisions
- **Single command**: `npx kempo init` handles all setup. `npx kempo upgrade` (separate command) handles future updates.
- **`-y` / `--yes` flag**: Skips all prompts and uses sensible defaults (container name `kempo-postgres`, generated admin password, Resend as email service placeholder).
- **Existing setup detection**: If `public/` exists, the user is prompted to start over, run upgrade, or cancel. Starting over deletes scaffolded files.
- **Copies `app-public/` → `public/`**: Sample content is already in `app-public/` so users see a working site immediately.
- **Docker-first database**: Docker Desktop + a Postgres container is required and managed automatically.
- **All prompts upfront**: All questions are asked at the start before any work begins, so setup runs uninterrupted.
- **No git initialization**: Users manage their own git setup.

## CLI Flags

| Flag | Description |
|------|-------------|
| `-y`, `--yes` | Use all defaults, skip all prompts |

## Init Wizard Flow

### 1. Existing Setup Detection
- Checks for `public/` directory
- If found (and not `-y`), prompts: **Start over** / **Run upgrade** / **Cancel**
- Start over deletes: `public/`, `server/`, `templates/`, `extensions/`, `.env`, `drizzle.config.js`, `docker-compose.yml`
- With `-y`: exits with message pointing to `npx kempo upgrade`

### 2. Configuration Prompts (all upfront)
All prompts run before any files are written or commands executed.

**Docker / Postgres:**
- Detects if Docker Desktop is running via `docker info`
- If not running: prints platform-specific install URL and exits
- If existing Postgres containers found: offer list to choose from, or create new
- If creating new: prompt for container name (default: `kempo-postgres`)
- If using existing: prompt for `DATABASE_URL`

**Admin user:**
- Full name (default: `Admin`)
- Email (default: `admin@example.com`)
- Password (default: auto-generated 16-char secure password)

**Email service:**
- Choice: Resend (recommended) or Skip for now
- If Resend: prompt for API key and from-address

### 3. File Scaffolding
| File/Dir | Source |
|---|---|
| `package.json` | Generated (with `dev` and `start` scripts) |
| `.gitignore` | Generated |
| `public/` | Copied from `app-public/` |
| `server/db/schema.js` | Copied from `app-server/db/schema.js` |
| `templates/` | Copied from `app-templates/` |
| `extensions/` | Created (empty) |
| `drizzle.config.js` | Copied from `app-drizzle.config.js` |
| `docker-compose.yml` | Generated (only when creating new container) |
| `.env` | Generated with all required variables |

### 4. Environment File (`.env`)
Generated with comments explaining each variable:
```
DATABASE_URL=postgresql://kempo:kempo_dev_password@localhost:5433/kempo
RESEND_API_KEY=<value or placeholder>
EMAIL_FROM=<value or placeholder>
PORT=9876
NODE_ENV=development
```

### 5. Install Dependencies
```
npm install kempo
```

### 6. Start Postgres Container
- New container: `docker compose up -d`, then polls `pg_isready` until ready (up to 30s)
- Existing container: starts it if stopped, polls until ready

### 7. Database Initialization
```
npx drizzle-kit push
node node_modules/kempo/scripts/init-db.js
```

### 8. Admin User Creation
Dynamically imports `createUser` and `addUserToGroup` from the kempo module, then:
1. Creates the user account (with `emailVerified: true`)
2. Adds the user to the `system:Administrators` group

### 9. Summary
Prints the admin credentials and next steps:
```
npm run dev
```
Then visit `http://localhost:9876` and `http://localhost:9876/admin`.

## Implementation

### Location
`bin/cli.js` — registered as the `kempo` bin command in `package.json`.

### Scaffold Output
```
project/
├── .env                    # Database URL, email config, and server settings
├── .gitignore
├── package.json            # With dev and start scripts using kempo-server
├── drizzle.config.js       # Drizzle config pointing to kempo's schema
├── docker-compose.yml      # PostgreSQL container (when creating new)
├── public/                 # Copied from kempo's app-public/
├── server/
│   └── db/
│       └── schema.js       # Re-exports kempo's schema (extensible)
├── templates/
│   └── emails/             # Copied from kempo's app-templates/emails/
└── extensions/             # Empty directory for future extensions
```

## Notes
- The consumer's `server/db/schema.js` can be extended with additional tables for custom features.
- The `drizzle.config.js` points to the consumer's schema file, which re-exports kempo's schema plus any additions.
- If any step fails, manual recovery commands are printed to the console.
