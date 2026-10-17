import db from '../../db/index.js';
import { scheduledJob } from '../../db/schema.js';
import { and, eq, notInArray } from 'drizzle-orm';
import { normalizeJobs, jobId } from './helpers.js';

/*
  Makes an extension's schedule match what it declares: adds new jobs, refreshes the interval and
  callback of existing ones (keeping when they are next due), and removes the ones no longer declared.
  Safe to call from install and again from update.
*/
export default async ({ owner, jobs }) => {
  if(!owner){
    return [{ code: 400, msg: 'Owner is required' }, null];
  }

  const [invalid, declared] = normalizeJobs(jobs);
  if(invalid){
    return [invalid, null];
  }

  try {
    const now = new Date();
    for(const job of declared){
      const row = { owner, name: job.name, everyMs: job.everyMs, callback: job.callback };
      await db.insert(scheduledJob)
        .values({ id: jobId(owner, job.name), ...row, nextRunAt: now, createdAt: now })
        .onConflictDoUpdate({ target: scheduledJob.id, set: row });
    }
    const names = declared.map(job => job.name);
    await db.delete(scheduledJob).where(names.length
      ? and(eq(scheduledJob.owner, owner), notInArray(scheduledJob.name, names))
      : eq(scheduledJob.owner, owner));
    return [null, { registered: declared.length }];
  } catch(error) {
    return [{ code: 500, msg: 'Failed to register jobs' }, null];
  }
};
