import db from '../../db/index.js';
import { group } from '../../db/schema.js';

export default async () => {
  return await db.select().from(group);
};
