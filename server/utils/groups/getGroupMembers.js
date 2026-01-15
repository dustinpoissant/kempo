import db from '../../db/index.js';
import { user, userGroup } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export default async (groupName) => {
  const members = await db
    .select({ user })
    .from(userGroup)
    .leftJoin(user, eq(userGroup.userId, user.id))
    .where(eq(userGroup.groupName, groupName));

  return members.map(m => m.user);
};
