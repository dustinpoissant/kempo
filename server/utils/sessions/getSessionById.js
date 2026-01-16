import db from '../../db/index.js';
import { session } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export default async (token) => {
  if(!token){
    return [{ code: 400, msg: 'Session token is required' }, null];
  }
  
  try {
    const result = await db.select().from(session).where(eq(session.token, token)).limit(1);
    
    if(!result[0]){
      return [{ code: 404, msg: 'Session not found' }, null];
    }
    
    return [null, result[0]];
  } catch(error){
    return [{ code: 500, msg: 'Failed to retrieve session' }, null];
  }
};
