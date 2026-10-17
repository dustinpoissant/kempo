import db from '../../db/index.js';
import { scheduledJob } from '../../db/schema.js';
import { asc } from 'drizzle-orm';

export default async () => {
  try {
    return [null, await db.select().from(scheduledJob).orderBy(asc(scheduledJob.owner), asc(scheduledJob.name))];
  } catch(error) {
    return [{ code: 500, msg: 'Failed to list jobs' }, null];
  }
};
