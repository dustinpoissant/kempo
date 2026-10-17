import { symlink, rm } from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { eq } from 'drizzle-orm';
import { reachable } from './helpers/db.js';

/*
  Scheduled jobs: an extension declares `jobs` in kempo-config.json, install registers them, a ticker runs
  what is due, and a lease on the row keeps several processes from running the same job at once.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = 'kempo-scheduler-fixture';
const fixtureSource = path.join(root, 'tests', 'fixtures', FIXTURE);
const fixtureLink = path.join(root, 'node_modules', FIXTURE);
const load = file => import(pathToFileURL(path.join(root, file)).href);

const db = (await load('server/db/index.js')).default;
const { extension, scheduledJob } = await load('server/db/schema.js');
const installExtension = (await load('server/utils/extensions/installExtension.js')).default;
const uninstallExtension = (await load('server/utils/extensions/uninstallExtension.js')).default;
const disableExtension = (await load('server/utils/extensions/disableExtension.js')).default;
const enableExtension = (await load('server/utils/extensions/enableExtension.js')).default;
const { invalidateScopeCache } = await load('server/utils/extensions/scopeCache.js');
const { normalizeJobs } = await load('server/utils/scheduler/helpers.js');
const { runDueJobs, runJob } = await load('server/utils/scheduler/runJobs.js');
const { startScheduler, stopScheduler } = await load('server/utils/scheduler/scheduler.js');
const registerJobs = (await load('server/utils/scheduler/registerJobs.js')).default;
const listJobs = (await load('server/utils/scheduler/listJobs.js')).default;

const databaseReachable = await reachable(db);

const calls = () => globalThis.schedulerCalls || [];
const reset = () => { globalThis.schedulerCalls = []; };
const jobRow = async name => (await db.select().from(scheduledJob).where(eq(scheduledJob.id, `${FIXTURE}:${name}`)))[0];
const makeDue = name => db.update(scheduledJob).set({ nextRunAt: new Date(Date.now() - 1000), lockedUntil: null }).where(eq(scheduledJob.id, `${FIXTURE}:${name}`));

const purge = async () => {
  await db.delete(scheduledJob).where(eq(scheduledJob.owner, FIXTURE)).catch(() => {});
  await db.delete(extension).where(eq(extension.name, FIXTURE)).catch(() => {});
  invalidateScopeCache();
};

const link = async () => {
  await rm(fixtureLink, { recursive: true, force: true }).catch(() => {});
  await symlink(fixtureSource, fixtureLink, 'junction');
};

export default databaseReachable ? {
  'declared jobs are validated': async ({ pass, fail }) => {
    const [, none] = normalizeJobs(undefined);
    if(none.length) return fail('no jobs should be no jobs');
    const [, good] = normalizeJobs([{ name: 'sweep', every: '90s', callback: './jobs/sweep.js' }]);
    if(good[0].everyMs !== 90000) return fail(`90s parsed as ${good[0].everyMs}`);
    const bad = [
      [{ name: 'Sweep', every: '1m', callback: './a.js' }],
      [{ name: 'a', every: '1m', callback: './a.js' }, { name: 'a', every: '1m', callback: './b.js' }],
      [{ name: 'a', every: 'often', callback: './a.js' }],
      [{ name: 'a', every: '10ms', callback: './a.js' }],
      [{ name: 'a', every: '1m', callback: '../outside.js' }],
      [{ name: 'a', every: '1m', callback: 'a.js' }],
      'not a list',
    ];
    for(const jobs of bad){
      const [error] = normalizeJobs(jobs);
      if(!error || error.code !== 400) return fail(`accepted ${JSON.stringify(jobs)}`);
    }
    pass('');
  },

  'install registers the declared jobs, due immediately': async ({ pass, fail }) => {
    await purge();
    await link();
    const [error] = await installExtension({ name: FIXTURE });
    if(error) return fail(`install: ${error.msg}`);
    const [, jobs] = await listJobs();
    const mine = jobs.filter(job => job.owner === FIXTURE);
    if(mine.length !== 2) return fail(`expected 2 jobs, got ${mine.length}`);
    const tick = await jobRow('tick');
    if(tick.everyMs !== 60000) return fail(`interval ${tick.everyMs}`);
    if(tick.nextRunAt.getTime() > Date.now()) return fail('a new job should be due straight away');
    pass('');
  },

  'a due job runs once, then waits an interval': async ({ pass, fail }) => {
    reset();
    const [error, ran] = await runDueJobs();
    if(error) return fail(error.msg);
    if(calls().join() !== `${FIXTURE}:tick`) return fail(`calls: ${calls()}`);
    if(!ran.some(job => job.name === 'tick' && job.status === 'ok')) return fail('tick not reported ok');
    const tick = await jobRow('tick');
    if(tick.lockedUntil !== null) return fail('the lease was not released');
    if(tick.lastStatus !== 'ok' || !tick.lastRunAt) return fail('the run was not recorded');
    if(tick.nextRunAt.getTime() < Date.now() + 50000) return fail('next run is not an interval away');
    reset();
    await runDueJobs();
    if(calls().length) return fail(`ran again straight away: ${calls()}`);
    pass('');
  },

  'a job that throws is recorded and stops nothing else': async ({ pass, fail }) => {
    const boom = await jobRow('boom');
    if(boom.lastStatus !== 'error') return fail(`boom status ${boom.lastStatus}`);
    if(!/the job broke/.test(boom.lastError)) return fail(`error: ${boom.lastError}`);
    pass('');
  },

  'two processes asking at once run a job once': async ({ pass, fail }) => {
    reset();
    await makeDue('tick');
    await Promise.all(Array.from({ length: 6 }, () => runDueJobs()));
    const count = calls().filter(call => call === `${FIXTURE}:tick`).length;
    if(count !== 1) return fail(`ran ${count} times`);
    pass('');
  },

  'a job held by a live lease is not run, and an abandoned lease is taken over': async ({ pass, fail }) => {
    reset();
    await db.update(scheduledJob).set({ nextRunAt: new Date(Date.now() - 1000), lockedUntil: new Date(Date.now() + 60000) }).where(eq(scheduledJob.id, `${FIXTURE}:tick`));
    await runDueJobs();
    if(calls().length) return fail('ran while another process held it');
    const [refused] = await runJob({ owner: FIXTURE, name: 'tick' });
    if(!refused || refused.code !== 409) return fail('a manual run should be refused while it is running');
    await db.update(scheduledJob).set({ lockedUntil: new Date(Date.now() - 1000) }).where(eq(scheduledJob.id, `${FIXTURE}:tick`));
    await runDueJobs();
    if(calls().length !== 1) return fail('an expired lease should be taken over');
    pass('');
  },

  'a job can be run by hand whatever the schedule says': async ({ pass, fail }) => {
    reset();
    const [error, result] = await runJob({ owner: FIXTURE, name: 'tick' });
    if(error) return fail(error.msg);
    if(result.status !== 'ok' || calls().length !== 1) return fail('did not run');
    const [missing] = await runJob({ owner: FIXTURE, name: 'nope' });
    if(!missing || missing.code !== 404) return fail('unknown job should be 404');
    pass('');
  },

  'a disabled extension\'s jobs do not run, and run again when it is enabled': async ({ pass, fail }) => {
    await disableExtension({ name: FIXTURE });
    reset();
    await makeDue('tick');
    await runDueJobs();
    if(calls().length) return fail('a disabled extension\'s job ran');
    const [refused] = await runJob({ owner: FIXTURE, name: 'tick' });
    if(!refused || refused.code !== 409) return fail('manual run of a disabled extension\'s job should be 409');
    await enableExtension({ name: FIXTURE });
    await runDueJobs();
    if(calls().length !== 1) return fail('the job did not run once enabled');
    pass('');
  },

  'registering again keeps when a job is due and removes jobs no longer declared': async ({ pass, fail }) => {
    const before = await jobRow('tick');
    const [error] = await registerJobs({ owner: FIXTURE, jobs: [{ name: 'tick', every: '5m', callback: './jobs/tick.js' }] });
    if(error) return fail(error.msg);
    const after = await jobRow('tick');
    if(after.everyMs !== 300000) return fail('interval was not refreshed');
    if(after.nextRunAt.getTime() !== before.nextRunAt.getTime()) return fail('a refresh moved when the job is due');
    if(await jobRow('boom')) return fail('a job no longer declared was kept');
    const [bad] = await registerJobs({ owner: FIXTURE, jobs: [{ name: 'x', every: 'never', callback: './x.js' }] });
    if(!bad) return fail('an invalid schedule was accepted');
    if(!(await jobRow('tick'))) return fail('an invalid schedule removed the existing jobs');
    pass('');
  },

  'the ticker runs due jobs by itself and stops when told': async ({ pass, fail }) => {
    reset();
    await makeDue('tick');
    if(!startScheduler({ tickMs: 30 })) return fail('did not start');
    if(startScheduler({ tickMs: 30 })) return fail('started a second ticker');
    await new Promise(resolve => setTimeout(resolve, 400));
    stopScheduler();
    if(calls().length !== 1) return fail(`ran ${calls().length} times`);
    if(stopScheduler()) return fail('stopped twice');
    pass('');
  },

  'uninstalling removes the jobs': async ({ pass, fail }) => {
    const [error] = await uninstallExtension({ name: FIXTURE });
    if(error) return fail(error.msg);
    if((await db.select().from(scheduledJob).where(eq(scheduledJob.owner, FIXTURE))).length) return fail('jobs outlived the extension');
    await rm(fixtureLink, { recursive: true, force: true }).catch(() => {});
    await purge();
    pass('');
  },
} : {
  'scheduled jobs (SKIPPED)': async ({ pass }) => pass('skipped: no database'),
};
