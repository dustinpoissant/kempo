import db from '../../db/index.js';
import { extension } from '../../db/schema.js';
import { sql } from 'drizzle-orm';
import { join } from 'path';
import { readFile } from 'fs/promises';

const NODE_MODULES = join(process.cwd(), 'node_modules');

const readPkg = async (name) => {
  try {
    const raw = await readFile(join(NODE_MODULES, name, 'package.json'), 'utf-8');
    return JSON.parse(raw);
  } catch { return {}; }
};

export default async ({ limit = 50, offset = 0 } = {}) => {
  try {
    const [items, [{ count }]] = await Promise.all([
      db.select().from(extension).limit(limit).offset(offset),
      db.select({ count: sql`count(*)` }).from(extension),
    ]);
    const enriched = await Promise.all(items.map(async (ext) => {
      const pkg = await readPkg(ext.name);
      return {
        ...ext,
        description: pkg.description || null,
        author: pkg.author || null,
        license: pkg.license || null,
        docs: pkg.kempo?.docs || null,
      };
    }));
    return [null, { items: enriched, total: Number(count), limit, offset }];
  } catch(error) {
    return [{ code: 500, msg: 'Failed to list extensions' }, null];
  }
};
