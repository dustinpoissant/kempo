import { runDueJobs } from './runJobs.js';

/*
  One ticker per process, held on a Symbol.for global so that the middleware and an extension reach the
  same one even if kempo was resolved twice. Each tick only asks the database what is due; the lease on
  each job row is what stops several processes running the same job. Set KEMPO_SCHEDULER=off to keep a
  process from running jobs.
*/
const SCHEDULER = Symbol.for('kempo.scheduler');

export const TICK_MS = 15000;

export const startScheduler = ({ tickMs = TICK_MS } = {}) => {
  if(globalThis[SCHEDULER] || process.env.KEMPO_SCHEDULER === 'off') return false;

  let running = false;
  const timer = setInterval(async () => {
    if(running) return;
    running = true;
    try {
      const [error] = await runDueJobs();
      if(error) console.error(`[kempo] Scheduler: ${error.msg}`);
    } finally {
      running = false;
    }
  }, tickMs);
  timer.unref?.();
  globalThis[SCHEDULER] = timer;
  return true;
};

export const stopScheduler = () => {
  if(!globalThis[SCHEDULER]) return false;
  clearInterval(globalThis[SCHEDULER]);
  globalThis[SCHEDULER] = null;
  return true;
};
