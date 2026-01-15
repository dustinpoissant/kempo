import db from '../../db/index.js';
import { user } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export default async (email) => {
  const result = await db.select({
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerified,
  }).from(user).where(eq(user.email, email)).limit(1);
  
  return result[0] || null;
};
