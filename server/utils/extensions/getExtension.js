import db from '../../db/index.js';
import { extension } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { join } from 'path';
import { readFile } from 'fs/promises';

const NODE_MODULES = join(process.cwd(), 'node_modules');

export default async ({ name }) => {
  if(!name){
    return [{ code: 400, msg: 'Extension name is required' }, null];
  }

  try {
    const results = await db.select().from(extension).where(eq(extension.name, name)).limit(1);
    if(!results.length){
      return [{ code: 404, msg: 'Extension not found' }, null];
    }
    const ext = results[0];
    let pkg = {};
    try {
      pkg = JSON.parse(await readFile(join(NODE_MODULES, name, 'package.json'), 'utf-8'));
    } catch { /* package may not be installed */ }
    return [null, {
      ...ext,
      description: pkg.description || null,
      author: pkg.author || null,
      license: pkg.license || null,
      docs: pkg.kempo?.docs || null,
    }];
  } catch(error) {
    return [{ code: 500, msg: 'Failed to get extension' }, null];
  }
};
