import db from '../../db/index.js';
import * as schema from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export default async (userId) => {
  if(!userId){
    return [{ code: 400, msg: 'User ID is required' }, null];
  }
  
  try {
    const [usersGroup] = await db
      .select()
      .from(schema.group)
      .where(eq(schema.group.name, 'system:Users'))
      .limit(1);

    if(!usersGroup){
      return [{ code: 500, msg: 'Users group not found - run init-db.js to initialize the database' }, null];
    }

    const explicitGroups = await db
      .select({ group: schema.group })
      .from(schema.userGroup)
      .leftJoin(schema.group, eq(schema.userGroup.groupName, schema.group.name))
      .where(eq(schema.userGroup.userId, userId));

    return [null, [usersGroup, ...explicitGroups.map(g => g.group)]];
  } catch(error){
    return [{ code: 500, msg: 'Failed to retrieve user groups' }, null];
  }
};
