import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { GLOBAL_FILE, GLOBAL_DISABLED_FILE, parseEntries } from './helpers.js';

export default async ({ rootDir }) => {
  if(!rootDir){
    return [{ code: 400, msg: 'Root directory is required' }, null];
  }

  const activePath = join(rootDir, GLOBAL_FILE);
  const disabledPath = join(rootDir, GLOBAL_DISABLED_FILE);

  const activeEntries = existsSync(activePath)
    ? parseEntries(await readFile(activePath, 'utf-8')).map(e => ({ ...e, disabled: false }))
    : [];

  const disabledEntries = existsSync(disabledPath)
    ? parseEntries(await readFile(disabledPath, 'utf-8')).map(e => ({ ...e, disabled: true }))
    : [];

  const entries = [...activeEntries, ...disabledEntries];
  return [null, { entries, total: entries.length }];
};
