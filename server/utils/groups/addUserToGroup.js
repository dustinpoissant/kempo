import crypto from 'crypto';
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
    const [existing] = await db
      .select()
      .from(userGroup)
      .where(and(
        eq(userGroup.userId, userId),
        eq(userGroup.groupName, groupName)
      ))
      .limit(1);

    if(existing){
      return [null, existing];
    }

    const [result] = await db
      .insert(userGroup)
      .values({
        id: crypto.randomBytes(16).toString('base64url'),
        userId,
        groupName,
        createdAt: new Date()
      })
      .returning();

    return [null, result];
  } catch(error){
    if(error.code === '23505'){
      return [{ code: 409, msg: 'User is already in this group' }, null];
    }
    return [{ code: 500, msg: 'Failed to add user to group' }, null];
  }
};
