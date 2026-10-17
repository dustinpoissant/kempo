import db from '../../db/index.js';
import { scheduledJob } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export default async ({ owner }) => {
  if(!owner){
    return [{ code: 400, msg: 'Owner is required' }, null];
  }

  try {
    await db.delete(scheduledJob).where(eq(scheduledJob.owner, owner));
    return [null, { success: true }];
  } catch(error) {
    return [{ code: 500, msg: 'Failed to remove jobs' }, null];
  }
};
