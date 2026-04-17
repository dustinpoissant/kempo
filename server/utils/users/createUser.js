import crypto from 'crypto';
import bcrypt from 'bcrypt';
import db from '../../db/index.js';
import { user } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

const generateId = () => crypto.randomBytes(16).toString('hex');
const generatePassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*';
  let password = '';
  for(let i = 0; i < 16; i++){
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

export default async ({ name, email, password, emailVerified = false }) => {
  if(!email){
    return [{ code: 400, msg: 'Email is required' }, null];
  }

  if(!name){
    return [{ code: 400, msg: 'Name is required' }, null];
  }

  let generatedPassword = null;
  if(!password){
    generatedPassword = generatePassword();
    password = generatedPassword;
  }

  const existingUser = await db.select().from(user).where(eq(user.email, email)).limit(1);
  if(existingUser.length > 0){
    return [{ code: 409, msg: 'User already exists with this email' }, null];
  }

  const userId = generateId();
  const now = new Date();
  
  await db.insert(user).values({
    id: userId,
    email,
    name,
    passwordHash: await bcrypt.hash(password, 10),
    emailVerified,
    createdAt: now,
    updatedAt: now,
  });

  const result = {
    user: {
      id: userId,
      email,
      name,
      emailVerified,
    },
    generatedPassword
  };
  return [null, result];
};
