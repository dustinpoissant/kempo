import db from '../../db/index.js';
import { group } from '../../db/schema.js';

export default async () => {
  try {
    const groups = await db.select().from(group);
    return [null, groups];
  } catch(error){
    return [{ code: 500, msg: 'Failed to retrieve groups' }, null];
  }
};
