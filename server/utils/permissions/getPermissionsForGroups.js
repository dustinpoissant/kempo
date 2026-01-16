import db from '../../db/index.js';
import * as schema from '../../db/schema.js';
import { inArray } from 'drizzle-orm';

export default async (groups) => {
  if(!groups){
    return [{ code: 400, msg: 'Groups are required' }, null];
  }
  
  if(groups.length === 0){
    return [null, []];
  }

  try {
    const groupNames = groups.map(g => g.name);
    
    const results = await db
      .select({ permissionName: schema.groupPermission.permissionName })
      .from(schema.groupPermission)
      .where(inArray(schema.groupPermission.groupName, groupNames));

    return [null, [...new Set(results.map(r => r.permissionName))]];
  } catch(error){
    return [{ code: 500, msg: 'Failed to retrieve permissions for groups' }, null];
  }
};
