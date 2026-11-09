import { desc, eq } from 'drizzle-orm';
import db from '../../../db/index.js';
import { sitebuilderTemplate } from '../../../db/schema.js';
import { TREE_FORMAT } from '../rows.js';

/* Templates from before kempo-ui's page builder hold another kind of tree, so they are not listed. */
export default async () => {
  const templates = await db.select().from(sitebuilderTemplate).where(eq(sitebuilderTemplate.format, TREE_FORMAT)).orderBy(desc(sitebuilderTemplate.createdAt));
  return [null, { templates }];
};
