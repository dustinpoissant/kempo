import { randomUUID } from 'crypto';
import db from '../../../db/index.js';
import { sitebuilderTemplate } from '../../../db/schema.js';
import loadRegistry from '../registry.js';
import validateTree from '../validateTree.js';
import { TREE_FORMAT } from '../rows.js';

/*
  Saves widgets (with everything inside them) as a template. The nodes are cleaned like a page's, and given fresh ids
  when inserted, so a template is a pattern and not a link to anything.
*/
export default async ({ name, nodes, userId = null }) => {
  const title = String(name ?? '').trim();
  if(!title) return [{ code: 400, msg: 'A template needs a name' }, null];
  if(title.length > 100) return [{ code: 400, msg: 'A template name can be at most 100 characters' }, null];
  if(!Array.isArray(nodes) || !nodes.length) return [{ code: 400, msg: 'Select a widget to save as a template' }, null];

  const registry = await loadRegistry();
  const [error, cleaned] = validateTree(nodes, registry);
  if(error) return [error, null];

  const [saved] = await db.insert(sitebuilderTemplate).values({ id: randomUUID(), name: title, nodes: cleaned, format: TREE_FORMAT, createdBy: userId, createdAt: new Date() }).returning();
  return [null, saved];
};
