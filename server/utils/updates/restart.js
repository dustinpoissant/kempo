import { spawn } from 'child_process';
import { existsSync } from 'fs';

/*
  How the server comes back after an update.

    respawn  this process starts its own replacement and exits. For `npm start` or `npm run dev` run by hand.
    exit     this process only exits and whatever started it starts it again (pm2, systemd, a container's
             restart policy). Respawning there would fight the supervisor for the port, and a container
             stops when its main process does.

  Chosen by the KEMPO_RESTART environment variable ("respawn" or "exit"), otherwise "exit" when pm2, systemd,
  Kubernetes or Docker is detected and "respawn" when none is.
*/
export const restartMode = (env = process.env, inContainer = () => existsSync('/.dockerenv')) => {
  if(env.KEMPO_RESTART === 'exit' || env.KEMPO_RESTART === 'respawn') return env.KEMPO_RESTART;
  return env.pm_id !== undefined || env.INVOCATION_ID || env.KUBERNETES_SERVICE_HOST || inContainer() ? 'exit' : 'respawn';
};

/*
  The replacement cannot be started by the process it replaces: the port is still taken. A small detached
  watcher waits for that process to be gone and then starts the same command in the same directory with
  the same environment. It gives up waiting after a minute and starts anyway.
*/
const WATCHER = `
const { spawn } = require('child_process');
const pid = Number(process.argv[1]);
const command = JSON.parse(process.argv[2]);
const started = Date.now();
const alive = () => {
  try { process.kill(pid, 0); return true; } catch(error) { return error.code === 'EPERM'; }
};
const wait = () => {
  if(alive() && Date.now() - started < 60000) return setTimeout(wait, 200);
  setTimeout(() => {
    spawn(command[0], command.slice(1), { detached: true, stdio: 'ignore', cwd: process.cwd(), env: process.env, windowsHide: true }).unref();
    process.exit(0);
  }, 500);
};
wait();
`;

/*
  Under a supervisor the exit code is nonzero on purpose (75, "try again later"): a Docker `restart: on-failure` or a
  systemd `Restart=on-failure` policy restarts only after a failure, while `always` and `unless-stopped` restart after any exit.
*/
export const RESTART_EXIT_CODE = 75;

export const restartServer = ({ mode = restartMode(), exit = code => process.exit(code), spawner = spawn } = {}) => {
  if(mode === 'respawn'){
    const command = [process.execPath, ...process.execArgv, ...process.argv.slice(1)];
    spawner(process.execPath, ['-e', WATCHER, String(process.pid), JSON.stringify(command)], {
      detached: true,
      stdio: 'ignore',
      cwd: process.cwd(),
      env: process.env,
      windowsHide: true
    }).unref();
  }
  exit(mode === 'respawn' ? 0 : RESTART_EXIT_CODE);
};

/* Restarts after `delayMs`, so the response that announced it has been sent first. */
export const scheduleRestart = ({ delayMs = 1000, ...options } = {}) => setTimeout(() => restartServer(options), delayMs);
