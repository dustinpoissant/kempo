import db from '../../db/index.js';
import * as schema from '../../db/schema.js';
import { inArray } from 'drizzle-orm';

export default async (groups) => {
  if(groups.length === 0) {
    return [];
  }

  const groupNames = groups.map(g => g.name);
  
  const results = await db
    .select({ permissionName: schema.groupPermission.permissionName })
    .from(schema.groupPermission)
    .where(inArray(schema.groupPermission.groupName, groupNames));

  return [...new Set(results.map(r => r.permissionName))];
};
