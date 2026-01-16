import db from '../../db/index.js';
import { user } from '../../db/schema.js';
import { ilike, sql } from 'drizzle-orm';

export default async (searchTerm, { limit = 50, offset = 0 } = {}) => {
  if(!searchTerm){
    return [{ code: 400, msg: 'Search term is required' }, null];
  }
  
  try {
    const users = await db.select({
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
    }).from(user)
      .where(ilike(user.email, `%${searchTerm}%`))
      .limit(limit)
      .offset(offset);
    
    const [{ count }] = await db.select({ count: sql`count(*)` })
      .from(user)
      .where(ilike(user.email, `%${searchTerm}%`));
    
    return [null, {
      users,
      total: Number(count),
      limit,
      offset,
      searchTerm
    }];
  } catch(error){
    return [{ code: 500, msg: 'Failed to search users' }, null];
  }
};
