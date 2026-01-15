import readline from 'readline';
import getUserByEmail from '../server/utils/users/getUserByEmail.js';
import addUserToGroup from '../server/utils/groups/addUserToGroup.js';
import db from '../server/db/index.js';
import { userGroup } from '../server/db/schema.js';
import { eq, and } from 'drizzle-orm';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const email = await new Promise(resolve => {
  rl.question('Enter user email: ', answer => {
    rl.close();
    resolve(answer.trim());
  });
});

if(!email){
  console.error('❌ Email is required');
  process.exit(1);
}

console.log(`Looking for user with email: ${email}`);

const foundUser = await getUserByEmail(email);

if(!foundUser){
  console.error(`❌ User not found with email: ${email}`);
  process.exit(1);
}

console.log(`✓ Found user: ${foundUser.name} (${foundUser.email})`);

const [existing] = await db
  .select()
  .from(userGroup)
  .where(and(
    eq(userGroup.userId, foundUser.id),
    eq(userGroup.groupName, 'system:Administrators')
  ))
  .limit(1);

if(existing){
  console.log('ℹ User is already an administrator');
  process.exit(0);
}

await addUserToGroup(foundUser.id, 'system:Administrators');

console.log('✅ User is now an administrator!');
process.exit(0);
