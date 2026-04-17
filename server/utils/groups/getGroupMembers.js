import db from '../../db/index.js';
import { user, userGroup } from '../../db/schema.js';
import { eq, sql } from 'drizzle-orm';

export default async (groupName, { limit = 50, offset = 0 } = {}) => {
  if(!groupName){
    return [{ code: 400, msg: 'Group name is required' }, null];
  }

  try {
    const members = await db
      .select({ user })
      .from(userGroup)
      .leftJoin(user, eq(userGroup.userId, user.id))
      .where(eq(userGroup.groupName, groupName))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql`count(*)` })
      .from(userGroup)
      .where(eq(userGroup.groupName, groupName));

    return [null, {
      members: members.map(m => m.user),
      total: Number(count),
      limit,
      offset
    }];
  } catch(error){
    return [{ code: 500, msg: 'Failed to retrieve group members' }, null];
  }
};
