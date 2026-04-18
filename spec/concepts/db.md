# Database

## Description
PostgreSQL database accessed via Drizzle ORM. All tables are defined in a single schema file and managed through Drizzle Kit migrations. System-critical records are protected by database triggers.

## Dependencies
- [drizzle-orm](https://orm.drizzle.team/) — ORM and query builder
- [drizzle-kit](https://orm.drizzle.team/kit-docs/overview) — Migration tooling
- [postgres](https://github.com/porsager/postgres) — PostgreSQL driver

## Context
Drizzle was chosen for its TypeScript-first approach, lightweight footprint, and migration generation from schema diffs. The schema is the single source of truth — migrations are generated from it, not written by hand.

### Decisions
- **Single schema file** (`server/db/schema.js`): All tables live in one file for simplicity. If it grows too large, it can be split into multiple files that are re-exported.
- **Text-based IDs**: Most primary keys use `text` (UUIDs generated in application code) rather than auto-incrementing integers. This avoids DB-level ID generation and makes records portable.
- **`owner` columns**: Groups, permissions, settings, and hooks have an `owner` field to distinguish system-created records from user-created or extension-created ones.
- **Database triggers** protect system records: `prevent_system_setting_delete`, `prevent_system_group_delete`, `prevent_system_permission_delete`. These are created in `scripts/init-db.js`, not in the schema file.

## Implementation

### Schema Location
`server/db/schema.js` — exports all table definitions and relation objects.

### Connection
`server/db/index.js` — creates and exports the `db` instance using `DATABASE_URL` from `.env`.

### Tables
| Table | Primary Key | Storage | Purpose |
|---|---|---|---|
| `user` | `id` (UUID) | DB | User accounts |
| `session` | `token` | DB | Auth sessions |
| `verificationToken` | `token` | DB | Email verification and password reset |
| `group` | `name` | DB | Role groups |
| `userGroup` | `id` (UUID) | DB | User-group membership (M:N) |
| `permission` | `name` | DB | Permission definitions |
| `groupPermission` | `id` (UUID) | DB | Group-permission assignment (M:N) |
| `setting` | `name` | DB | Key-value config |
| `menu` | `id` (UUID) | DB | Navigation menus |
| `menuItem` | `id` (UUID) | DB | Menu items with nesting |
| `hook` | `id` (UUID) | DB | Extension event hooks |
| `extension` | `name` | DB | Installed extensions |

### Migration Commands
- `npm run db:generate` — generates migration SQL from schema diffs
- `npm run db:push` — pushes schema directly (dev only)
- `npm run db:migrate` — runs pending migrations
- `npm run db:studio` — opens Drizzle Studio GUI

### Seeding
`scripts/init-db.js` seeds default permissions, groups, settings, and creates protection triggers. Run after initial migration.

## Notes
- The `menu` and `menuItem` tables exist in migrations but are not yet in `schema.js` — they need to be added.
- Extensions can create their own tables by running migrations in their `install.js` scripts.
