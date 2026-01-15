import bcrypt from 'bcrypt';
import db from '../../db/index.js';
import { verificationToken, user, session } from '../../db/schema.js';
import { eq, and, gt } from 'drizzle-orm';

export default async ({ token, password, logoutAll = false }) => {
  
  const result = await db
    .select()
    .from(verificationToken)
    .where(and(
      eq(verificationToken.token, token),
      eq(verificationToken.type, 'password_reset'),
      gt(verificationToken.expiresAt, new Date())
    ))
    .limit(1);

  if(result.length === 0){
    throw Object.assign(new Error('Invalid or expired password reset token'), { statusCode: 400 });
  }

  const tokenRecord = result[0];
  const passwordHash = await bcrypt.hash(password, 10);

  await db
    .update(user)
    .set({ 
      passwordHash,
      updatedAt: new Date()
    })
    .where(eq(user.id, tokenRecord.userId));

  await db
    .delete(verificationToken)
    .where(eq(verificationToken.token, token));

  if(logoutAll){
    await db
      .delete(session)
      .where(eq(session.userId, tokenRecord.userId));
  }

  return { 
    success: true,
    userId: tokenRecord.userId
  };
};
