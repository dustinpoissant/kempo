import { desc } from 'drizzle-orm';
import db from '../../../db/index.js';
import { sitebuilderTemplate } from '../../../db/schema.js';

export default async () => {
  const templates = await db.select().from(sitebuilderTemplate).orderBy(desc(sitebuilderTemplate.createdAt));
  return [null, { templates }];
};
