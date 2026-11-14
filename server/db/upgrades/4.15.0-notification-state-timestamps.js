export const meta = {
  description: 'Carries what notifications recorded as read and handled over to viewed and acknowledged, marks them delivered, and makes each one\'s level its subtype',
  breaking: false,
};

const TABLES = ['notificationRecipient', 'notificationGuestRecipient'];

const rowsOf = result => (Array.isArray(result) ? result : result.rows);

/*
  A notification's state used to be readAt, handledAt and dismissedAt. It is now deliveredAt, viewedAt, acknowledgedAt,
  dismissedAt and lastShownAt, and the new columns are added when the server starts, before this runs. Read becomes
  viewed and handled becomes acknowledged; anything a person had read, handled or dismissed has plainly been
  delivered. The old columns are left where they are, since kempo only ever adds to its tables, and nothing reads them.
  A table that has no old columns (a site that began on this version) has nothing to carry over.
*/
export const up = async ({ db, sql }) => {
  /* A notification made before types had a level (info, success, warning, error) and no subtype: the level is its subtype now. */
  await db.execute(sql`update "notification" set "subtype" = "level" where "subtype" is null and "level" in ('success', 'warning', 'error')`);

  for(const table of TABLES){
    const columns = rowsOf(await db.execute(sql`select column_name from information_schema.columns where table_schema = 'public' and table_name = ${table}`)).map(row => row.column_name);

    if(!columns.includes('readAt') || !columns.includes('handledAt') || !columns.includes('viewedAt')) continue;

    await db.execute(sql.raw(`
      update "${table}" set
        "viewedAt" = coalesce("viewedAt", "readAt"),
        "acknowledgedAt" = coalesce("acknowledgedAt", "handledAt"),
        "deliveredAt" = coalesce("deliveredAt", "readAt", "handledAt", "dismissedAt")
      where "readAt" is not null or "handledAt" is not null or "dismissedAt" is not null
    `));
  }
};
