import db from '../../db/index.js';
import { userGroup } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export default async () => {
  try {
    const [found] = await db.select().from(userGroup).where(eq(userGroup.groupName, 'system:Administrators')).limit(1);
    return [null, !!found];
  } catch(error){
    return [{ code: 500, msg: 'Failed to check for an administrator' }, null];
  }
};
