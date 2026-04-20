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
    const [result] = await db
      .delete(groupPermission)
      .where(and(
        eq(groupPermission.groupName, groupName),
        eq(groupPermission.permissionName, permissionName)
      ))
      .returning();

    if(!result){
      return [{ code: 404, msg: 'Permission is not assigned to this group' }, null];
    }

    return [null, result];
  } catch(error){
    return [{ code: 500, msg: 'Failed to remove permission from group' }, null];
  }
};
