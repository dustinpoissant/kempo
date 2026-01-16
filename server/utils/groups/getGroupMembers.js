import db from '../../db/index.js';
import { user, userGroup } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export default async (groupName) => {
  if(!groupName){
    return [{ code: 400, msg: 'Group name is required' }, null];
  }
  
  try {
    const members = await db
      .select({ user })
      .from(userGroup)
      .leftJoin(user, eq(userGroup.userId, user.id))
      .where(eq(userGroup.groupName, groupName));

    return [null, members.map(m => m.user)];
  } catch(error){
    return [{ code: 500, msg: 'Failed to retrieve group members' }, null];
  }
};
