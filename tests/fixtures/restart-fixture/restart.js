import { writeFileSync } from 'fs';
import { pathToFileURL } from 'url';
import { join } from 'path';

/*
  Run as `node restart.js <marker file> [second]`. The first run restarts itself the way the server does after an update;
  the replacement it starts (the same command, so with "second") writes the marker file and ends. No port is involved.
*/
const [marker, second] = process.argv.slice(2);

if(second){
  writeFileSync(marker, `${process.pid}`);
} else {
  const { restartServer } = await import(pathToFileURL(join(import.meta.dirname, '..', '..', '..', 'server', 'utils', 'updates', 'restart.js')).href);
  process.argv.push('second');
  restartServer({ mode: 'respawn' });
}
