import { and, eq } from 'drizzle-orm';
import db from '../../db/index.js';
import { dashboardWidget } from '../../db/schema.js';

/*
  Removes one widget, or every widget the owner registered when `key` is omitted. Removing something
  that is not there is not an error; `removed` says how many rows went.
*/
export default async ({ owner, key } = {}) => {
  if(!owner){
    return [{ code: 400, msg: 'Owner is required' }, null];
  }

  try {
    const removed = await db
      .delete(dashboardWidget)
      .where(key ? and(eq(dashboardWidget.owner, owner), eq(dashboardWidget.key, key)) : eq(dashboardWidget.owner, owner))
      .returning({ id: dashboardWidget.id });

    return [null, { removed: removed.length }];
  } catch(error) {
    return [{ code: 500, msg: 'Failed to remove dashboard widget' }, null];
  }
};
