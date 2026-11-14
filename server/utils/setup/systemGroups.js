import db from '../../db/index.js';
import { group } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export const GUESTS_GROUP = 'system:Guests';
export const RESTRICTED_GROUP = 'system:Restricted';

/*
  The groups kempo adds after a site may already exist. A new site gets every group when it is set up (seedDatabase), and
  `ensureSystemGroups` adds any that an older site is missing when the server starts. It only adds: a group that exists is never
  touched, and one that is added holds no permissions, so nothing changes for the site until someone grants it some.
*/
export const SYSTEM_GROUPS = [
  { name: GUESTS_GROUP, description: 'Visitors who have not logged in (guests). Holds the permissions every guest has' },
  { name: RESTRICTED_GROUP, description: 'Restricted people and guests. The permissions in this group are taken away from them, whatever else they hold' },
];

/* Resolves to [error, { added: [names] }]. */
export const ensureSystemGroups = async () => {
  try {
    const added = [];
    for(const { name, description } of SYSTEM_GROUPS){
      const [existing] = await db.select({ name: group.name }).from(group).where(eq(group.name, name)).limit(1);
      if(existing) continue;
      await db.insert(group).values({ name, description, owner: 'system', createdAt: new Date() });
      added.push(name);
    }
    return [null, { added }];
  } catch {
    return [{ code: 500, msg: 'The system groups could not be checked' }, null];
  }
};
