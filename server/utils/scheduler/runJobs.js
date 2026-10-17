import db from '../../db/index.js';
import { scheduledJob } from '../../db/schema.js';
import { and, eq, lte, or, isNull, asc } from 'drizzle-orm';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { getDisabledExtensionNames } from '../extensions/scopeCache.js';
import { LEASE_MS, jobId } from './helpers.js';

const resolveHandler = (owner, callback) => join(process.cwd(), 'node_modules', owner, callback);

/*
  Takes a job for this process: one conditional UPDATE, so of any number of processes asking at once
  exactly one gets the row. It then moves `nextRunAt` on by an interval. `force` skips the "is it due"
  test (for running a job by hand) but never the lease.
*/
const claim = async (id, { force = false } = {}) => {
  const now = new Date();
  const conditions = [eq(scheduledJob.id, id), or(isNull(scheduledJob.lockedUntil), lte(scheduledJob.lockedUntil, now))];
  if(!force) conditions.push(lte(scheduledJob.nextRunAt, now));

  const [row] = await db.update(scheduledJob)
    .set({ lockedUntil: new Date(now.getTime() + LEASE_MS) })
    .where(and(...conditions))
    .returning();
  if(!row) return null;

  if(!force){
    await db.update(scheduledJob).set({ nextRunAt: new Date(now.getTime() + row.everyMs) }).where(eq(scheduledJob.id, id));
  }
  return row;
};

/* Runs a claimed job's handler, then releases the lease and records how it went. A throwing job never stops anything else. */
const execute = async row => {
  let status = 'ok';
  let message = null;
  try {
    const mod = await import(pathToFileURL(resolveHandler(row.owner, row.callback)).href);
    await (mod.default || mod)({ owner: row.owner, name: row.name });
  } catch(error) {
    status = 'error';
    message = String(error?.message ?? error).slice(0, 500);
    console.error(`[kempo] Job "${row.name}" (${row.owner}) failed: ${message}`);
  }
  await db.update(scheduledJob)
    .set({ lockedUntil: null, lastRunAt: new Date(), lastStatus: status, lastError: message })
    .where(eq(scheduledJob.id, row.id))
    .catch(() => {});
  return { status, error: message };
};

/*
  Runs every job that is due and not held by another process. A disabled extension's jobs stay
  registered but never run, the same as its hooks. Returns the ones this process ran.
*/
export const runDueJobs = async () => {
  try {
    const disabled = await getDisabledExtensionNames();
    const candidates = await db.select().from(scheduledJob).where(lte(scheduledJob.nextRunAt, new Date())).orderBy(asc(scheduledJob.nextRunAt));
    const ran = [];
    for(const candidate of candidates){
      if(disabled.has(candidate.owner)) continue;
      const row = await claim(candidate.id);
      if(!row) continue;
      ran.push({ owner: row.owner, name: row.name, ...(await execute(row)) });
    }
    return [null, ran];
  } catch(error) {
    return [{ code: 500, msg: 'Failed to run jobs' }, null];
  }
};

/* Runs one job now, whatever the schedule says. Refused with 409 while another process is running it. */
export const runJob = async ({ owner, name } = {}) => {
  if(!owner || !name){
    return [{ code: 400, msg: 'Owner and name are required' }, null];
  }

  try {
    const id = jobId(owner, name);
    const [exists] = await db.select({ id: scheduledJob.id }).from(scheduledJob).where(eq(scheduledJob.id, id));
    if(!exists) return [{ code: 404, msg: 'Job not found' }, null];
    if((await getDisabledExtensionNames()).has(owner)) return [{ code: 409, msg: 'The extension is disabled' }, null];
    const row = await claim(id, { force: true });
    if(!row) return [{ code: 409, msg: 'The job is already running' }, null];
    return [null, await execute(row)];
  } catch(error) {
    return [{ code: 500, msg: 'Failed to run the job' }, null];
  }
};
