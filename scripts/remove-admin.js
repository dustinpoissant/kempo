import readline from 'readline';
import getUserByEmail from '../server/utils/users/getUserByEmail.js';
import removeUserFromGroup from '../server/utils/groups/removeUserFromGroup.js';
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

if(!email) {
  console.error('❌ Email is required');
  process.exit(1);
}

try {
  const [error, targetUser] = await getUserByEmail(email);

  if(error || !targetUser) {
    console.error(`❌ User not found: ${email}`);
    process.exit(1);
  }

  console.log(`✓ Found user: ${targetUser.name} (${targetUser.email})`);

  const [existing] = await db
    .select()
    .from(userGroup)
    .where(
      and(
        eq(userGroup.userId, targetUser.id),
        eq(userGroup.groupName, 'system:Administrators')
      )
    )
    .limit(1);

  if(!existing) {
    console.log('ℹ User is not an administrator');
    process.exit(0);
  }

  const [removeError] = await removeUserFromGroup(targetUser.id, 'system:Administrators');
  
  if(removeError){
    console.error('❌ Failed to remove user from Administrators group:', removeError.msg);
    process.exit(1);
  }

  console.log(`✓ Removed ${email} from Administrators group`);
  process.exit(0);
} catch(error) {
  console.error('Error removing admin:', error);
  process.exit(1);
}
