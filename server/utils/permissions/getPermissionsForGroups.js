import db from '../../db/index.js';
import * as schema from '../../db/schema.js';
import { inArray } from 'drizzle-orm';
import { RESTRICTED_GROUP } from '../setup/systemGroups.js';

/*
  The permissions the groups give, together. The system:Restricted group works the other way round: when it is one of the
  groups, what it holds is taken away from the result, however the other groups came by it.
*/
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
      .select({ permissionName: schema.groupPermission.permissionName, groupName: schema.groupPermission.groupName })
      .from(schema.groupPermission)
      .where(inArray(schema.groupPermission.groupName, groupNames));

    const taken = new Set(results.filter(r => r.groupName === RESTRICTED_GROUP).map(r => r.permissionName));

    return [null, [...new Set(results.filter(r => r.groupName !== RESTRICTED_GROUP && !taken.has(r.permissionName)).map(r => r.permissionName))]];
  } catch(error){
    return [{ code: 500, msg: 'Failed to retrieve permissions for groups' }, null];
  }
};
