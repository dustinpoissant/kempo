# Data migrations

Additive changes to kempo's tables (new tables, columns, indexes) need nothing here: they are applied when the server starts.
A change that restructures or moves data goes in a file in this folder, named so that they sort in the order they must run:

    4.9.0-split-user-name.js

```js
export const meta = { description: 'Splits user.name into first and last', breaking: true };

export const up = async ({ db, sql }) => {
  await db.execute(sql`...`);
};
```

- It runs once, inside a transaction, when the first server of the new version starts, and is recorded in the `upgrade` table.
- `breaking: true` is for anything the previous version cannot run against (data moved or removed). The Updates screen warns
  before such an update, kempo backs the database up first, and a failure puts the previous version and that backup back.
- Add one only in a release whose version is higher than the first one that has this folder: a site's `upgrade` table starts with
  every file that was here when it first started recorded as already run.
