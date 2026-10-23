import { spawn, spawnSync } from 'child_process';
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { countAttempt, paths, performSwitch, restoreFiles, rollBack, seedSite, shouldRollBack } from './siteLayout.js';

/*
  The image's startup script. It runs before the site, as the container's main process, and does what must not be left to
  the site itself:

    1. First start: fills the volume from the image (/seed) with the site as it was built.
    2. A new version waiting (state/switch.json asked for it): moves its code into place, while nothing is running.
    3. A new version that has not proved itself and keeps stopping, or says it failed: puts the previous code back,
       the files an update changed, and the database too when the update changed data (from the backup it took first).
    4. After a change of Node version: rebuilds the compiled modules (bcrypt) the volume was built with.
    5. Starts the site, passes signals to it and ends with its exit code, so the container's restart policy sees what
       the site did (the site ends with 75 to ask for a restart after an update).

  Environment: KEMPO_SITE_ROOT (the volume, /site), KEMPO_SEED (the site as built, /seed), KEMPO_START_COMMAND (default
  `npm start`, or a JSON array when a path has spaces), and DATABASE_URL, which a database restore needs.
*/
const siteRoot = process.env.KEMPO_SITE_ROOT || '/site';
const seed = process.env.KEMPO_SEED || '/seed';
const { app, state } = paths(siteRoot);

const say = message => console.log(`[kempo] ${message}`);

/* Puts a backup taken before a data-changing update back: a plain-SQL dump, gzipped, with its own DROP statements. */
const restoreDatabase = async file => {
  if(!file || !existsSync(file)) return false;
  const psql = spawn('psql', ['-v', 'ON_ERROR_STOP=1', '-q', process.env.DATABASE_URL], { stdio: ['pipe', 'inherit', 'inherit'] });
  const finished = new Promise((resolve, reject) => {
    psql.on('error', reject);
    psql.on('exit', code => (code === 0 ? resolve() : reject(new Error(`psql ended with ${code}`))));
  });
  await Promise.all([pipeline(createReadStream(file), createGunzip(), psql.stdin), finished]);
  return true;
};

const goBack = async reason => {
  say(`The new version of Kempo is not working (${reason}). Going back to the one before it.`);
  const result = rollBack({ siteRoot, reason });
  if(!result.ok){
    say(result.reason);
    return;
  }
  say(`Back on Kempo ${result.to}.`);
  if(result.dbBackup){
    try {
      say('Restoring the database from the backup taken before the update.');
      await restoreDatabase(result.dbBackup);
    } catch(error) {
      say(`The database could not be restored (${error.message}). The backup is at ${result.dbBackup}.`);
    }
  }
};

if(seedSite({ siteRoot, seed })) say('First start: the site was copied onto the volume.');

const switched = performSwitch(siteRoot);
if(switched){
  say(`Kempo ${switched.from.version} -> ${switched.version}.`);
  if(switched.kind === 'rollback'){
    restoreFiles({ siteRoot, backup: switched.filesBackup });
    if(switched.dbBackup){
      try {
        say('Restoring the database from the backup taken before the update.');
        await restoreDatabase(switched.dbBackup);
      } catch(error) {
        say(`The database could not be restored (${error.message}). The backup is at ${switched.dbBackup}.`);
      }
    }
  }
}

const counted = countAttempt(siteRoot);
if(shouldRollBack(counted)) await goBack(counted.failed ? counted.failure || 'a data migration failed' : 'it stopped too many times');

const nodeFile = join(state, 'node-version');
const builtWith = existsSync(nodeFile) ? readFileSync(nodeFile, 'utf8').trim() : null;
if(builtWith && builtWith !== process.version){
  say(`Node changed from ${builtWith} to ${process.version}: rebuilding compiled modules.`);
  spawnSync('npm', ['rebuild'], { cwd: app, stdio: 'inherit' });
}
mkdirSync(state, { recursive: true });
writeFileSync(nodeFile, process.version);

const startCommand = process.env.KEMPO_START_COMMAND || 'npm start';
const [command, ...args] = startCommand.startsWith('[') ? JSON.parse(startCommand) : startCommand.split(' ');
const site = spawn(command, args, { cwd: app, stdio: 'inherit', env: { ...process.env, KEMPO_SITE_ROOT: siteRoot } });

for(const signal of ['SIGTERM', 'SIGINT']){
  process.on(signal, () => site.kill(signal));
}
site.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
