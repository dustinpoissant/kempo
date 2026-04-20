import crypto from 'crypto';
import db from '../../db/index.js';
import { groupPermission } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';

export default async (groupName, permissionName) => {
  if(!groupName){
    return [{ code: 400, msg: 'Group name is required' }, null];
  }

  if(!permissionName){
    return [{ code: 400, msg: 'Permission name is required' }, null];
  }

  try {
    const [existing] = await db
      .select()
      .from(groupPermission)
      .where(and(
        eq(groupPermission.groupName, groupName),
        eq(groupPermission.permissionName, permissionName)
      ))
      .limit(1);

    if(existing){
      return [null, existing];
    }

    const [result] = await db
      .insert(groupPermission)
      .values({
        id: crypto.randomBytes(16).toString('base64url'),
        groupName,
        permissionName,
        createdAt: new Date()
      })
      .returning();

    return [null, result];
  } catch(error){
    return [{ code: 500, msg: 'Failed to add permission to group' }, null];
  }
};
