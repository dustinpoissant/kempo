import { execFileSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const dir = dirname(fileURLToPath(import.meta.url));

execFileSync('kempo-server', [
  '--root', 'app-public',
  '--port', '9876',
  '--config', resolve(dir, 'dev.config.json')
], { stdio: 'inherit', shell: true });
