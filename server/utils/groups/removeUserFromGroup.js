import db from '../../db/index.js';
import { userGroup } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';

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

    return [null, result];
  } catch(error){
    return [{ code: 500, msg: 'Failed to remove user from group' }, null];
  }
};
