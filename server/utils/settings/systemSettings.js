import db from '../../db/index.js';
import { setting } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import setSetting from './setSetting.js';

/*
  The settings kempo itself owns, with their defaults. A new site gets them when it is set up (seedDatabase), and `ensureSystemSettings`
  adds any that an older site is missing when the server starts, so a setting added in a later version shows on the settings screen
  and can be edited like the rest. It only ever adds: a setting that exists is never touched, so nothing an admin chose is overwritten.
*/
export const SYSTEM_SETTINGS = [
  { owner: 'system', name: 'site_name', value: 'Kempo Site', type: 'string', isPublic: true, description: 'The name of the website' },
  { owner: 'system', name: 'session_duration_days', value: 7, type: 'number', isPublic: false, description: 'Session duration in days' },
  { owner: 'system', name: 'allow_registration', value: true, type: 'boolean', isPublic: true, description: 'Allow new users to register' },
  { owner: 'system', name: 'require_email_verification', value: false, type: 'boolean', isPublic: false, description: 'Require email verification before account access' },
  { owner: 'system', name: 'verification_url', value: 'http://localhost:3000/verify-email/{{token}}', type: 'string', isPublic: false, description: 'Email verification URL template' },
  { owner: 'system', name: 'notification_retention_days', value: 90, type: 'number', isPublic: false, description: 'Days to keep notifications before they are deleted (0 keeps them forever)' },
  { owner: 'system', name: 'password_reset_url', value: 'http://localhost:3000/reset-password/{{token}}', type: 'string', isPublic: false, description: 'Password reset URL template' },
  { owner: 'system', name: 'email_max_retries', value: 1, type: 'number', isPublic: false, description: 'How many times kempo tries again to send an email that could not be sent, after the first try (0 never retries)' },
  { owner: 'system', name: 'email_retention_days', value: 30, type: 'number', isPublic: false, description: 'Days to keep the log of sent emails before it is deleted (0 keeps it forever)' },
  { owner: 'system', name: 'email_retention_by_type', value: {}, type: 'json', isPublic: false, description: 'Days to keep a particular kind of email, instead of the number above, as { "verify-email": 7, "kempo-commerce/order-processing": 365 } (0 keeps that kind forever)' },
  { owner: 'system', name: 'email_from', value: '', type: 'string', isPublic: false, description: 'The address emails are sent from, as name@example.com or Shop Name <name@example.com>. It must be on a domain verified with the email provider. Empty uses EMAIL_FROM from the server environment' },
  { owner: 'system', name: 'update_check_enabled', value: true, type: 'boolean', isPublic: false, description: 'Check npm every 12 hours for a newer kempo and tell the people who can install it' },
];

/* Resolves to [error, { added: [names] }]. */
export const ensureSystemSettings = async () => {
  try {
    const added = [];
    for(const entry of SYSTEM_SETTINGS){
      const [existing] = await db.select({ name: setting.name }).from(setting).where(eq(setting.name, `${entry.owner}:${entry.name}`)).limit(1);
      if(existing) continue;
      const [error] = await setSetting(entry.owner, entry.name, entry.value, entry.type, entry.isPublic, entry.description);
      if(error) return [error, null];
      added.push(entry.name);
    }
    return [null, { added }];
  } catch {
    return [{ code: 500, msg: 'The system settings could not be checked' }, null];
  }
};
