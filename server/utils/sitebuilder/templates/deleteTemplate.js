import { eq } from 'drizzle-orm';
import db from '../../../db/index.js';
import { sitebuilderTemplate } from '../../../db/schema.js';

export default async ({ id }) => {
  if(!id) return [{ code: 400, msg: 'A template id is required' }, null];
  const deleted = await db.delete(sitebuilderTemplate).where(eq(sitebuilderTemplate.id, id)).returning({ id: sitebuilderTemplate.id });
  if(!deleted.length) return [{ code: 404, msg: 'Template not found' }, null];
  return [null, { deleted: id }];
};
