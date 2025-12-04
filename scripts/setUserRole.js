import db from '../server/db/index.js';
import { member, organization, user } from '../server/db/schema.js';
import { eq, and } from 'drizzle-orm';
import * as readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

const rl = readline.createInterface({ input, output });

const DEFAULT_ORG_SLUG = 'site';
const VALID_ROLES = ['superAdmin', 'admin', 'editor', 'contributor', 'subscriber'];

console.log('=== Set User Role ===\n');

const email = await rl.question('Enter user email: ');

const users = await db.select()
	.from(user)
	.where(eq(user.email, email))
	.limit(1);

if(users.length === 0) {
	console.error('User not found with email:', email);
	rl.close();
	process.exit(1);
}

const targetUser = users[0];
console.log(`\nFound user: ${targetUser.name} (${targetUser.email})`);

let orgs = await db.select()
	.from(organization)
	.where(eq(organization.slug, DEFAULT_ORG_SLUG))
	.limit(1);

let org;
if(orgs.length === 0) {
	console.log('Creating default organization...');
	[org] = await db.insert(organization).values({
		id: crypto.randomUUID(),
		name: 'Site',
		slug: DEFAULT_ORG_SLUG,
		createdAt: new Date()
	}).returning();
} else {
	org = orgs[0];
}

const existingMember = await db.select()
	.from(member)
	.where(and(
		eq(member.organizationId, org.id),
		eq(member.userId, targetUser.id)
	))
	.limit(1);

if(existingMember.length > 0) {
	console.log(`Current role: ${existingMember[0].role}`);
}

console.log('\nAvailable roles:');
VALID_ROLES.forEach((role, index) => {
	console.log(`  ${index + 1}. ${role}`);
});

const roleChoice = await rl.question('\nSelect role (1-5): ');
const roleIndex = parseInt(roleChoice) - 1;

if(roleIndex < 0 || roleIndex >= VALID_ROLES.length) {
	console.error('Invalid role selection');
	rl.close();
	process.exit(1);
}

const selectedRole = VALID_ROLES[roleIndex];

if(existingMember.length > 0) {
	await db.update(member)
		.set({ role: selectedRole })
		.where(eq(member.id, existingMember[0].id));
	console.log(`\n✓ Updated role to: ${selectedRole}`);
} else {
	await db.insert(member).values({
		id: crypto.randomUUID(),
		organizationId: org.id,
		userId: targetUser.id,
		role: selectedRole,
		createdAt: new Date()
	});
	console.log(`\n✓ Added user with role: ${selectedRole}`);
}

rl.close();
process.exit(0);
