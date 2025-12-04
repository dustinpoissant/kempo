import db from '../server/db/index.js';
import { member, organization, user } from '../server/db/schema.js';
import { eq, and } from 'drizzle-orm';

const DEFAULT_ORG_SLUG = 'site';
const VALID_ROLES = ['superAdmin', 'admin', 'editor', 'contributor', 'subscriber'];

const email = process.argv[2];
const role = process.argv[3];

if(!email || !role) {
	console.error('Usage: node scripts/setUserRoleQuick.js <email> <role>');
	console.error('Roles:', VALID_ROLES.join(', '));
	process.exit(1);
}

if(!VALID_ROLES.includes(role)) {
	console.error('Invalid role. Must be one of:', VALID_ROLES.join(', '));
	process.exit(1);
}

const users = await db.select()
	.from(user)
	.where(eq(user.email, email))
	.limit(1);

if(users.length === 0) {
	console.error('User not found with email:', email);
	process.exit(1);
}

const targetUser = users[0];

let orgs = await db.select()
	.from(organization)
	.where(eq(organization.slug, DEFAULT_ORG_SLUG))
	.limit(1);

let org;
if(orgs.length === 0) {
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
	await db.update(member)
		.set({ role })
		.where(eq(member.id, existingMember[0].id));
	console.log(`✓ Updated ${email} to role: ${role}`);
} else {
	await db.insert(member).values({
		id: crypto.randomUUID(),
		organizationId: org.id,
		userId: targetUser.id,
		role,
		createdAt: new Date()
	});
	console.log(`✓ Added ${email} with role: ${role}`);
}

process.exit(0);
