# CLI

## Description
A command-line tool (`npx kempo init`) that scaffolds a new kempo project. It copies starter files, sets up the database connection, and optionally initializes the database with default data.

## Dependencies
- [Database](db.md) — pushes schema and runs seeding
- kempo-server — the scaffolded project uses kempo-server for routing

## Context
Kempo is installed as an npm package (`npm install kempo`). The init script creates the project structure in the consumer's working directory, setting up everything needed to start building.

### Decisions
- **Single command**: `npx kempo init` is the only CLI command. It handles all scaffolding in one interactive flow.
- **Copies `app-public/` to `public/`**: The consumer's public directory starts as a copy of kempo's `app-public/`, giving them a working site immediately.
- **Docker-first database**: The init script can start a Docker PostgreSQL container for development.
- **Interactive prompts**: The CLI asks questions (Docker setup, DB push, admin creation) rather than requiring flags.

## Implementation

### Location
`bin/cli.js` — registered as the `kempo` bin command in `package.json`.

### Scaffold Output
```
project/
├── .env                    # Database URL and secrets
├── .gitignore
├── package.json            # With kempo-server start script
├── drizzle.config.js       # Drizzle config pointing to kempo's schema
├── docker-compose.yml      # PostgreSQL container
├── public/                 # Copied from kempo's app-public/
├── server/
│   └── db/
│       └── schema.js       # Re-exports kempo's schema (extensible)
├── templates/
│   └── emails/             # Copied from kempo's app-templates/emails/
└── extensions/             # Empty directory for future extensions
```

### Init Steps
1. Generate `package.json` with kempo-server start script
2. Create `.env` with `DATABASE_URL` and `RESEND_API_KEY` placeholders
3. Create `.gitignore`
4. Copy `app-public/` → `public/`
5. Create `server/db/schema.js` that re-exports kempo's schema
6. Copy email templates
7. Create `drizzle.config.js`
8. Create `docker-compose.yml`
9. Create `extensions/` directory
10. Optionally: start Docker, push DB schema, run `init-db.js`, create admin user

## Notes
- The consumer's `server/db/schema.js` can be extended with additional tables for custom features.
- The `drizzle.config.js` points to the consumer's schema file, which re-exports kempo's schema plus any additions.
