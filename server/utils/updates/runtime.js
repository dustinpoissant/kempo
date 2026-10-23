import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

/*
  What this process is running, read once when it starts. After an update the files on disk are the new
  version while this process is still the old one, so these are what tell the two apart: the running
  version, and a boot id that is different in every process.
*/
export const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

export const RUNNING_VERSION = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8')).version;

export const BOOT_ID = randomUUID();
