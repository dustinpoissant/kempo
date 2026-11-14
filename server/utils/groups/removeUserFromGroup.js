import db from '../../db/index.js';
import { userGroup, guestSession } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { RESTRICTED_GROUP } from '../setup/systemGroups.js';

export default async (userId, groupName) => {
  if(!userId){
    return [{ code: 400, msg: 'User ID is required' }, null];
  }
  
  if(!groupName){
    return [{ code: 400, msg: 'Group name is required' }, null];
  }
  
  try {
    const [result] = await db
      .delete(userGroup)
      .where(and(
        eq(userGroup.userId, userId),
        eq(userGroup.groupName, groupName)
      ))
      .returning();

    if(!result){
      return [{ code: 404, msg: 'User is not in this group' }, null];
    }

    /* The record that carries the restriction in the person's browser is lifted with it (see markUserRestricted). */
    if(groupName === RESTRICTED_GROUP){
      await db.update(guestSession).set({ restrictedAt: null }).where(eq(guestSession.mergedIntoUserId, userId));
    }

    return [null, result];
  } catch(error){
    return [{ code: 500, msg: 'Failed to remove user from group' }, null];
  }
};
