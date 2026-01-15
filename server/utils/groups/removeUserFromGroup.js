import db from '../../db/index.js';
import { userGroup } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';

export default async (userId, groupName) => {
  const [result] = await db
    .delete(userGroup)
    .where(and(
      eq(userGroup.userId, userId),
      eq(userGroup.groupName, groupName)
    ))
    .returning();

  return result;
};
