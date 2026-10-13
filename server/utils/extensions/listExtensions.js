import db from '../../db/index.js';
import { extension } from '../../db/schema.js';
import { sql } from 'drizzle-orm';
import { join } from 'path';
import readKempoConfig from './readKempoConfig.js';

const NODE_MODULES = join(process.cwd(), 'node_modules');

const readConfig = async name => {
  try {
    return await readKempoConfig(join(NODE_MODULES, name));
  } catch {
    return { pkg: {}, kempo: {} };
  }
};

export default async ({ limit = 50, offset = 0 } = {}) => {
  try {
    const [items, [{ count }]] = await Promise.all([
      db.select().from(extension).limit(limit).offset(offset),
      db.select({ count: sql`count(*)` }).from(extension),
    ]);
    const enriched = await Promise.all(items.map(async (ext) => {
      const { pkg, kempo } = await readConfig(ext.name);
      return {
        ...ext,
        description: pkg.description || null,
        author: pkg.author || null,
        license: pkg.license || null,
        docs: kempo.docs || null,
      };
    }));
    return [null, { items: enriched, total: Number(count), limit, offset }];
  } catch(error) {
    return [{ code: 500, msg: 'Failed to list extensions' }, null];
  }
};
