import db from '../../db/index.js';
import * as schema from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export default async (userId) => {
  const [usersGroup] = await db
    .select()
    .from(schema.group)
    .where(eq(schema.group.name, 'system:Users'))
    .limit(1);

  if(!usersGroup) {
    throw new Error('Users group not found - run init-db.js to initialize the database');
  }

  const explicitGroups = await db
    .select({ group: schema.group })
    .from(schema.userGroup)
    .leftJoin(schema.group, eq(schema.userGroup.groupName, schema.group.name))
    .where(eq(schema.userGroup.userId, userId));

  return [usersGroup, ...explicitGroups.map(g => g.group)];
};
