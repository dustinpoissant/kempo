import parseDuration from '../realtime/duration.js';

export const MIN_INTERVAL_MS = 1000;

/* How long a process may hold a job before another may take it over, in case the first one died mid-run. */
export const LEASE_MS = 5 * 60 * 1000;

export const jobId = (owner, name) => `${owner}:${name}`;

/*
  Checks the `jobs` an extension declares: [{ name, every, callback }]. `every` is a number of
  milliseconds or a string such as "30s", "1m" or "6h". Returns [error, jobs] where each job has
  `everyMs` filled in.
*/
export const normalizeJobs = jobs => {
  if(jobs === undefined || jobs === null) return [null, []];
  if(!Array.isArray(jobs)) return [{ code: 400, msg: 'jobs must be a list' }, null];

  const seen = new Set();
  const result = [];
  for(const job of jobs){
    const name = String(job?.name ?? '');
    if(!/^[a-z0-9][a-z0-9-]*$/.test(name)) return [{ code: 400, msg: `Job name "${name}" must be lowercase letters, numbers and dashes` }, null];
    if(seen.has(name)) return [{ code: 400, msg: `Job "${name}" is declared twice` }, null];
    seen.add(name);

    const everyMs = parseDuration(job.every);
    if(everyMs === null || everyMs < MIN_INTERVAL_MS) return [{ code: 400, msg: `Job "${name}" needs an "every" of at least one second, such as "1m"` }, null];

    const callback = String(job.callback ?? '');
    if(!callback.startsWith('./')) return [{ code: 400, msg: `Job "${name}" needs a "callback" path starting with ./` }, null];

    result.push({ name, every: job.every, everyMs, callback });
  }
  return [null, result];
};
