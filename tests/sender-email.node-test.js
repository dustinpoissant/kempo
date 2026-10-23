import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { sql } from 'drizzle-orm';
import { seedDatabase } from './helpers/db.js';

/*
  The address kempo sends its emails from: the `system:email_from` setting, else EMAIL_FROM, else SMTP_FROM, else the email
  provider's test address; and the same as a bare address for an extension. A value that is not an address never wins, and the
  setting cannot be saved as one. Older sites get the setting when the server starts.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = async relative => (await import(pathToFileURL(path.join(root, relative)).href)).default;
const loadNamed = async relative => import(pathToFileURL(path.join(root, relative)).href);

const db = await load('server/db/index.js');
const getSenderEmail = await load('server/utils/email/getSenderEmail.js');
const getSenderFrom = await load('server/utils/email/getSenderFrom.js');
const isValidSender = await load('server/utils/email/isValidSender.js');
const setSetting = await load('server/utils/settings/setSetting.js');
const { ensureSystemSettings, SYSTEM_SETTINGS } = await loadNamed('server/utils/settings/systemSettings.js');

const PLACEHOLDER = ['noreply', 'example.com'].join('@');
const original = { EMAIL_FROM: process.env.EMAIL_FROM, SMTP_FROM: process.env.SMTP_FROM };

const setup = async ({ stored = '', email, smtp } = {}) => {
  delete process.env.EMAIL_FROM;
  delete process.env.SMTP_FROM;
  if(email !== undefined) process.env.EMAIL_FROM = email;
  if(smtp !== undefined) process.env.SMTP_FROM = smtp;
  await setSetting('system', 'email_from', stored, 'string', false, 'test');
};

const restore = async () => {
  for(const [name, value] of Object.entries(original)){
    if(value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  await setSetting('system', 'email_from', '', 'string', false, 'test');
};

export const beforeAll = async () => {
  await seedDatabase();
};

export const afterAll = async () => {
  await restore();
  await seedDatabase();
};

export default {
  'the setting wins over EMAIL_FROM, which wins over SMTP_FROM, which wins over the placeholder': async ({ pass, fail }) => {
    await setup({ stored: 'Shop <set@example.com>', email: 'env@example.com', smtp: 'old@example.com' });
    if(await getSenderFrom() !== 'Shop <set@example.com>') return fail('the setting');
    await setup({ email: 'env@example.com', smtp: 'old@example.com' });
    if(await getSenderFrom() !== 'env@example.com') return fail('EMAIL_FROM');
    await setup({ smtp: 'old@example.com' });
    if(await getSenderFrom() !== 'old@example.com') return fail('SMTP_FROM');
    await setup();
    if(await getSenderFrom() !== PLACEHOLDER) return fail('the placeholder');
    pass('');
  },

  'a value that is not an address is skipped, so one bad value cannot stop every email': async ({ pass, fail }) => {
    await setup({ email: 'not an address', smtp: 'old@example.com' });
    if(await getSenderFrom() !== 'old@example.com') return fail('a bad EMAIL_FROM');
    await setup({ email: 'bad' });
    if(await getSenderFrom() !== PLACEHOLDER) return fail('every value bad');
    pass('');
  },

  'the bare address comes out of a name and an address, or a plain address': async ({ pass, fail }) => {
    await setup({ email: 'Dustin 3D Print <orders@example.com>' });
    if(await getSenderEmail() !== 'orders@example.com') return fail('a named sender');
    await setup({ stored: 'plain@example.com' });
    if(await getSenderEmail() !== 'plain@example.com') return fail('a plain sender');
    await setup();
    if(await getSenderEmail() !== PLACEHOLDER) return fail('the placeholder');
    pass('');
  },

  'what is an address': async ({ pass, fail }) => {
    for(const good of ['a@b.co', 'Shop Name <a@b.co>', '  a@b.co  ', 'Dustin 3D Print <orders@sub.example.com>']) if(!isValidSender(good)) return fail(`${good} should be valid`);
    for(const bad of ['', 'a', 'a@b', '<a@b.co>', 'a@b.co, c@d.co', 'a@b.co\nBcc: x@y.co', 'Shop <a@b.co> extra', 5, null, 'x'.repeat(201) + '@b.co']) if(isValidSender(bad)) return fail(`${JSON.stringify(bad)} should not be valid`);
    pass('');
  },

  'the setting cannot be saved as something that is not an address, but can be cleared': async ({ pass, fail }) => {
    await setup();
    const [badError] = await setSetting('system', 'email_from', 'nonsense', 'string', false, 'test');
    if(badError?.code !== 400) return fail('a bad value was accepted');
    const [clearError] = await setSetting('system', 'email_from', '', 'string', false, 'test');
    if(clearError) return fail('clearing it should work');
    const [goodError] = await setSetting('system', 'email_from', 'Shop <ok@example.com>', 'string', false, 'test');
    if(goodError) return fail('a good value was refused');
    pass('');
  },

  'an older site gets the setting when the server starts, and nothing it already has is changed': async ({ pass, fail }) => {
    /* System settings are protected from deletion by a trigger, so an older site is made by taking the row out with it off. */
    await db.execute(sql`alter table setting disable trigger user`);
    await db.execute(sql`delete from setting where name = 'system:email_from'`);
    await db.execute(sql`alter table setting enable trigger user`);
    await setSetting('system', 'site_name', 'My Own Name', 'string', true, 'The name of the website');
    const [error, result] = await ensureSystemSettings();
    if(error) return fail(error.msg);
    if(!result.added.includes('email_from')) return fail('the setting was not added');
    const found = await db.execute(sql`select value from setting where name = 'system:site_name'`);
    const [row] = found.rows ?? found;
    if(row?.value !== 'My Own Name') return fail('an existing setting was overwritten');
    const [, again] = await ensureSystemSettings();
    if(again.added.length) return fail('a second run added something');
    if(!SYSTEM_SETTINGS.some(entry => entry.name === 'email_from' && entry.value === '')) return fail('the default is not empty');
    pass('');
  },
};
