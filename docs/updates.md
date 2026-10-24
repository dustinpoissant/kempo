# Updates

Kempo checks npm every 12 hours for a newer version of itself and of every installed extension. When there is one, everyone who can install it gets a notification, and **Admin → Updates** lists them with a box each, installs what is ticked, restarts the server, waits for it to come back, reloads, and says the update worked. Nothing is typed on the server: not the install, not the database migration, not the restart.

How it goes depends on where the site runs.

- **In Docker, from the volume the `npx kempo init` Docker files set up** (the way to run a site on a server): the new version is downloaded next to the running site, you see what it will change, and you switch to it when you choose. The site keeps working until the switch, a version that does not work is put back by itself, and "Go back" does it by hand.
- **Anywhere else** (`npm start` run by hand, pm2, systemd): the new version is installed in place and the server restarts.

Either way the admin needs the `system:updates:manage` permission, which the Administrators group has. A site where kempo is linked (`npm run link:local`), a `file:` or git dependency, or a source checkout is shown the update but never replaced: installing would swap your local checkout for the registry copy.

## Extensions

Extensions are npm packages, so they are checked against npm: every installed extension's newest version is looked up with the kempo check, and the Updates screen lists those that are newer. Kempo and extensions are updated together and in the same way. Tick what you want, and:

- in Docker they are staged, shown in the plan (each extension's old and new version and what it adds), and switched to in one go, with the same automatic way back;
- elsewhere they are installed in place in one `npm install` and the server restarts.

An extension's code has to be in `node_modules` first, but its **database work happens at server start**, not in the request: when the server starts it compares each installed extension's version on disk with the one recorded for it, and for each one that is newer it adds the tables, columns and indexes its schema gained, runs its `update.js`, and registers what the new version declares (permissions, settings, groups, hooks, widgets, jobs). This is the same whether the new version arrived through the Updates screen, a switch of the site's code, `npm` by hand or a rebuilt image. Of several servers starting together, one does each extension. A version that is older than the recorded one means the site went back: the record follows and no script runs. Extensions are taken in dependency order (what each declares in `dependencies`), so an update script finds the extensions it builds on already up to date. A failed extension is reported on the Updates screen and in a notification, keeps its old version recorded and is tried again at the next start.

**Breaking extension updates.** An extension's data migration is its own `update.js`, which kempo cannot read ahead of time, so kempo takes the version number at its word: a new **major** version, or while the major is still 0 a new **minor** version (0.1.x to 0.2.0, which is what npm's own `^0.1.1` assumes), or one whose `kempo-config.json` says `"breaking": true`, is treated as changing data. The screen warns, the database is backed up first (Docker), and you confirm. Going back restores that backup and loses what was entered since. A minor or patch update is expected to be additive, so going back past it loses nothing.

**What is checked before anything is installed:** the extension is installed and has a newer version on npm; the new version does not need a newer kempo than the one that will be running (an extension that does is only offered together with that kempo); and the addresses it claims do not collide with another extension's. Extensions have no starter files to fingerprint: their own `public/` is served from the package (an update replaces it), and a file the owner changes lives in the site (an email template override, say) and always wins. An extension that generates a file into the site uses `writeSiteFile`, which follows the same rule as kempo's starter files.

## In Docker

`npx kempo init` offers to add `Dockerfile`, `docker-compose.prod.yml` and `.dockerignore`. Put `DB_PASSWORD` and `SETTINGS_ENCRYPTION_KEY` in a `.env` next to them and run `docker compose -f docker-compose.prod.yml up -d --build`. Then open `/setup` to create the first administrator.

### What lives where

| | |
|---|---|
| **The image** | Node, `pg_dump`, and the site as it was when you built it (`/seed`). It is only used the first time a container starts. |
| **The `site` volume** (`/site`) | The site itself. `app/` holds your files (`public`, `templates`, uploads, `.env`) and the code (`node_modules`, `package.json`, the lockfile). `releases/` holds the version before the last update, `staging/` a version being prepared, `state/` what the startup script and the site tell each other. |
| **The `db` volume** | The database. |

**The startup script is part of the image, not the volume.** `entrypoint.mjs` and `siteLayout.js` are copied into the image from the kempo that was installed when it was built, because they must be able to run (and put the previous code back) even when the site's own code is broken. So updating kempo from the screen does not change them: rebuild the image (`docker compose build`, or a deploy) to pick up a newer startup script. The records they share with the site (`state/*.json`) are kept readable by both older and newer versions, and the screen copes with what an older startup script writes.

Everything the admin does (pages, templates, uploads, installing and updating kempo and extensions) is written to the volume, so replacing or rebuilding the container loses nothing. The first time a container starts it copies the image's site onto the volume; after that **the volume is the site**, and rebuilding the image does not change it (rebuild to change Node). Back up both volumes. `docker compose down -v` deletes them.

### Updating

1. **Get ready.** Kempo installs the new version (and any `kempo-server`, `kempo-ui` or `kempo-css` it needs) into `staging/`, a copy of the site's code, while the site keeps running from its own files. Nothing the site uses is touched, so this can fail or be abandoned without a trace.
2. **Look.** The page shows what switching would change, worked out from the staged copy:
   - starter files you never edited that will be updated, and new ones that will be added
   - files you edited, which stay exactly as you made them
   - files you edited that the new version must replace anyway (a security fix); your version is saved first
   - a change to your data, if it carries one
3. **Switch.** One click (with a confirmation where you are being asked to accept something). Kempo replaces the starter files, backs the database up first if data changes, and restarts. The startup script moves the new code into place while nothing is running, and the site is only down for the restart.
4. **Proving itself.** The new version has a minute to stay up (the screen waits it out: "Switch now" and "Go back" are held back with a note, and look again every few seconds). A download is a copy of the site's code from when you clicked "Get ready", so if the code changes in between (another update, an extension installed) it is refused and thrown away, and you get it ready again. If it stops more than three times, or says its data migration failed, the startup script puts the previous code back, the starter files the update replaced, and the database too when the update changed data. The Updates page says what happened.

**Go back** puts the site on the version it had before the last update. It is not offered while the last switch is still being checked, nor right after the site went back (by hand or because the new version failed): the earlier version is then the one just left, and moving forward is an update. The screen and the server work this out in one place, so the warning that going back restores the database appears exactly when it will. If that update changed data, going back also restores the database from the backup taken before it, which loses whatever was entered since (the page says so and asks first). If it only added to the database, which is the usual case, nothing is lost.

### Starter files

`npx kempo init` copies kempo's own files into the site: `app-public/` into `public/` (the login and register pages, the nav, `styles.css`) and `app-templates/` into `templates/` (the email templates). They start as kempo's and become yours when anyone edits one.

Kempo remembers the fingerprint (SHA-256) of each one it copied, in `.kempo/shipped.json`. On an update:

| The file in your site | What happens |
|---|---|
| Identical to the new version's, or kempo did not change it | Nothing |
| Still exactly what kempo copied | Replaced by the new version |
| Anything else, edited by anyone (the admin, FTP, a shell) | Kept, and listed as having a newer version |
| Deleted by you | Stays deleted |
| New in this version | Added |

A site made before this record existed has none: a file is judged against what the running version ships, so a file that equals it counts as never edited and anything else counts as edited, and nothing is overwritten by mistake.

A version can name files it must replace even if you edited them, in its `package.json`:

```json
{ "kempo": { "forceUpdate": ["public/login/", "public/init.js"] } }
```

A path ending in `/` is a folder. The update then asks for your confirmation, lists those files, and keeps a copy of each one first. Extension email templates are not copied into the site at all: a site only gets one when someone edits it in the admin, and that copy always wins over the extension's.

## The database

Nothing has to be typed to migrate. Two things run every time the server starts, before it serves anything.

**Additive sync of kempo's tables.** Kempo compares its own tables with the schema of the version now installed and **adds** what is missing: new tables (with their indexes and foreign keys), columns, indexes and constraints. It only ever adds: it never drops, renames, truncates or changes the type of anything, and it only looks at kempo's own tables. The site's tables and the tables of extensions are never touched. Each change is applied on its own: if the database refuses one (a new unique index over rows that already break it, a required column with no default on a table that has rows), the rest are still applied, the server still starts, and the problem is shown on the Updates page and sent as a notification, once. Several servers starting together take turns (a Postgres advisory lock). A database with no tables is a new one: they are all created, its groups, permissions and settings are put in, and `/setup` makes the first administrator.

**Extensions' tables** are brought up to date the same way, per extension (see above).

**Data migrations.** A change that restructures or moves data cannot be additive. It goes in a file in `server/db/upgrades/` (see its README), runs once inside a transaction, and is recorded in the `upgrade` table. A migration marked `breaking` is one the previous version cannot run against. Only major releases carry one. For an update that has one:

- the Updates page says so before you switch ("this update changes your data"), because the staged copy can be read before anything runs;
- kempo backs the database up first with `pg_dump` (the image has it) into `state/backups/`, and refuses the update if it cannot;
- if the migration fails, it is rolled back, and the previous version and that backup are put back;
- going back after the new version has been used restores that backup, which loses what was entered since.

A site's `upgrade` table starts with every migration file that existed when it first started recorded as already run, so a migration is only ever added in a release after the first one that has the folder.

For your own releases, you can keep even a large change safe to go back from by splitting it over two: the first adds the new structure and copies the data across, a later one removes the old structure.

## Anywhere else

Kempo installs the new versions (kempo, and the extensions you ticked) into the site's own `node_modules` with npm in one run (with any `kempo-server`, `kempo-ui` or `kempo-css` that has fallen below its minimum), then restarts. There is no staging and no automatic way back, and it is only worth using where the site's files persist. The database is brought up to date when the server starts, as above.

## How the server restarts

| Mode | When | What happens |
|---|---|---|
| `respawn` | `npm start` / `npm run dev` run by hand | The server starts a detached watcher that waits for it to exit, then starts the same command in the same directory with the same environment, and exits. Output is no longer attached to the terminal. |
| `exit` | pm2, systemd, Kubernetes or Docker detected | The server only exits (code 75, so even an `on-failure` policy restarts it) and the supervisor starts it again. In the Docker files this is set, and the startup script passes the code on. |

Set `KEMPO_RESTART=respawn` or `KEMPO_RESTART=exit` to choose.

While the server is gone, the Updates page asks it every two seconds whether it is back. Every process has its own boot id, so a reply from a different process means it is. The page then reloads and says whether the version it asked for is the one now running, or that the site went back. A server that does not come back in ten minutes is reported rather than waited on forever.

## Settings and environment

- `system:update_check_enabled` (default on): turn the scheduled check off. The page and "Check now" still work.
- `KEMPO_NPM_REGISTRY`: another registry to ask, such as a private mirror (default `https://registry.npmjs.org`).
- `KEMPO_SITE_ROOT`: set to `/site` by the Docker files; its presence is what makes a site use the staged, switchable flow.

## For extensions

Handle `kempo:updated` (`{ oldVersion, newVersion, packages }`) to react before the restart. Extensions are updated from the same screen: see Extensions above.

## Server utilities

All under `server/utils/updates/` (and `server/utils/setup/`), returning `[error, data]`.

| Util | Purpose |
|---|---|
| `getUpdateStatus({ force, offline })` | Running and newest version, `updateAvailable`, `major`, `canUpdate` and `reason`, `restart` mode, `bootId`, `mode`, and for a volume site the staged update, `canGoBack` and `lastUpdate` |
| `prepareUpdate({ version, extensions })` | Stage kempo and/or extensions and work out the plan (volume sites) |
| `applyStagedUpdate({ confirm })` | Switch to the staged version, with a backup if data changes |
| `rollbackUpdate({ confirm })` | Go back to the version before the last update |
| `applyUpdate({ version, extensions })` | Install in place (other sites) |
| `getExtensionUpdates()` | Which installed extensions have a newer version on npm |
| `reconcileExtensions()`, `upgradeExtension()` | Bring each extension's database in step with its version on disk, at start |
| `writeSiteFile()` | For an extension that writes a file into the site, without overwriting the owner's edits |
| `syncCoreSchema()`, `runUpgrades()`, `seedIfNew()` | The database steps that run at start |
| `runUpdateCheck()` | The scheduled job: check and notify, once per version |
| `restartServer()` / `scheduleRestart()` | Restart as described above |

## API

| Route | Purpose |
|---|---|
| `GET /kempo/api/updates` | The status. `?offline=true` never asks npm, which is what the page polls with |
| `POST /kempo/api/updates/check` | Ask npm now |
| `POST /kempo/api/updates/prepare` | `{ version, extensions }` (version null leaves kempo as it is): stage them and answer with the plan (volume sites) |
| `POST /kempo/api/updates/apply` | `{ confirm: { forced, breaking } }` on a volume site (switch), `{ version, extensions }` elsewhere (install in place). 409 with `details` says what needs confirming |
| `POST /kempo/api/updates/rollback` | `{ confirm: { data } }` |
| `POST /kempo/api/updates/discard` | Throw away a staged update |
