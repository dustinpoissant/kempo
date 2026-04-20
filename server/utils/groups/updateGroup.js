import db from '../../db/index.js';
import { group, userGroup, groupPermission } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export default async (name, updates) => {
  if(!name){
    return [{ code: 400, msg: 'Group name is required' }, null];
  }

  if(!updates || Object.keys(updates).length === 0){
    return [{ code: 400, msg: 'Updates are required' }, null];
  }

  if(name.startsWith('system:')){
    return [{ code: 403, msg: 'Editing system-owned groups is not allowed' }, null];
  }

  try {
    const safeUpdates = {};
    if(updates.name !== undefined) safeUpdates.name = updates.name;
    if(updates.description !== undefined) safeUpdates.description = updates.description;
    safeUpdates.updatedAt = new Date();

    if(safeUpdates.name && safeUpdates.name !== name){
      let result;
      await db.transaction(async (tx) => {
        await tx.update(userGroup).set({ groupName: safeUpdates.name }).where(eq(userGroup.groupName, name));
        await tx.update(groupPermission).set({ groupName: safeUpdates.name }).where(eq(groupPermission.groupName, name));
        [result] = await tx.update(group).set(safeUpdates).where(eq(group.name, name)).returning();
      });
      if(!result){
        return [{ code: 404, msg: 'Group not found' }, null];
      }
      return [null, result];
    }

    const [result] = await db
      .update(group)
      .set(safeUpdates)
      .where(eq(group.name, name))
      .returning();

    if(!result){
      return [{ code: 404, msg: 'Group not found' }, null];
    }

    return [null, result];
  } catch(error){
    if(error.code === '23505'){
      return [{ code: 409, msg: 'Group name already exists' }, null];
    }
    return [{ code: 500, msg: 'Failed to update group' }, null];
  }
};
