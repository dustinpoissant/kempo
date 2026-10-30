import db from '../../db/index.js';
import { group } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

/*
  Only groups a person made (owner `custom`) can have their name, description or permissions changed. The groups kempo ships
  (owner `system`) and the ones an extension defines (owner = the extension's name) are set by their code, so an edit would be
  undone by the next update, and could break what the extension expects. Nobody is exempt, administrators included. Members
  are not covered here: assigning people to any group is how it is used.
*/
export default async (name) => {
  if(!name){
    return [{ code: 400, msg: 'Group name is required' }, null];
  }

  try {
    const [found] = await db.select({ owner: group.owner }).from(group).where(eq(group.name, name)).limit(1);
    if(!found){
      return [{ code: 404, msg: 'Group not found' }, null];
    }
    if(found.owner !== 'custom'){
      return [{ code: 403, msg: `This group belongs to ${found.owner === 'system' ? 'kempo' : found.owner} and cannot be changed` }, null];
    }
    return [null, found];
  } catch(error){
    return [{ code: 500, msg: 'Failed to check the group' }, null];
  }
};
