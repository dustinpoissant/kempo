import path from 'path';
import os from 'os';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import { fileURLToPath, pathToFileURL } from 'url';
import { sql, eq } from 'drizzle-orm';
import { seedDatabase } from './helpers/db.js';

/*
  Email in kempo: every email is logged before anything is sent, an email extension sends it through the `email:send` hook, the first
  one to say it sent it ends the chain, a failure is tried again as many times as the setting allows, and old emails are deleted by
  the retention settings.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = async relative => (await import(pathToFileURL(path.join(root, relative)).href));

const db = (await load('server/db/index.js')).default;
const { email, hook } = await load('server/db/schema.js');
const sendEmail = (await load('server/utils/email/sendEmail.js')).default;
const sendEmailFromTemplate = (await load('server/utils/email/sendEmailFromTemplate.js')).default;
const retryEmail = (await load('server/utils/email/retryEmail.js')).default;
const listEmails = (await load('server/utils/email/listEmails.js')).default;
const getEmail = (await load('server/utils/email/getEmail.js')).default;
const pruneEmails = (await load('server/utils/email/pruneEmails.js')).default;
const maintainEmails = (await load('server/utils/email/maintainEmails.js')).default;
const createHook = (await load('server/utils/hooks/createHook.js')).default;
const setSetting = (await load('server/utils/settings/setSetting.js')).default;

const OWNER = 'email-log-test';
const TO = 'someone@email-log.test';
let directory;
let handlerCount = 0;

/* A sender extension for the test: `body` is the body of its handler, which gets `{ email }` and `calls` (a list that records what it saw). */
const sender = async (name, body) => {
  const file = path.join(directory, `${name}.mjs`);
  globalThis.emailLogCalls ??= {};
  globalThis.emailLogCalls[name] = [];
  await writeFile(file, `export default async ({ email }) => { globalThis.emailLogCalls[${JSON.stringify(name)}].push(email); ${body} };`);
  /* Hooks run in the order they were registered, by the millisecond: a pause keeps two of them from sharing one on a fast machine. */
  await new Promise(resolve => setTimeout(resolve, 5));
  const [error] = await createHook({ owner: OWNER, event: 'email:send', callback: file });
  if(error) throw new Error(error.msg);
  handlerCount++;
};

const calls = name => globalThis.emailLogCalls[name];
const row = async id => (await getEmail(id))[1];
const setRetries = value => setSetting('system', 'email_max_retries', value, 'number', false, 'test');
const age = (id, minutes) => db.execute(sql`update email set "updatedAt" = now() - (${minutes} * interval '1 minute') where id = ${id}`);

const reset = async () => {
  await db.delete(hook).where(eq(hook.owner, OWNER));
  await db.execute(sql`delete from email where recipient like '%@email-log.test'`);
  globalThis.emailLogCalls = {};
  handlerCount = 0;
  await setRetries(1);
};

export const beforeAll = async () => {
  await seedDatabase();
  directory = await mkdtemp(path.join(os.tmpdir(), 'kempo-email-'));
  await reset();
};

export const afterAll = async () => {
  await reset();
  await setSetting('system', 'email_retention_days', 30, 'number', false, 'test');
  await setSetting('system', 'email_retention_by_type', {}, 'json', false, 'test');
  await rm(directory, { recursive: true, force: true });
  delete globalThis.emailLogCalls;
};

const mail = (extra = {}) => sendEmail({ to: TO, subject: 'Hello', html: '<p>Hi</p>', ...extra });

export default {
  'with no email extension installed, the email is logged, queued for a retry, and the caller is told why': async ({ pass, fail }) => {
    await reset();
    const [error, result] = await mail();
    if(result || error?.code !== 503) return fail(`got ${JSON.stringify([error, result])}`);
    if(!/No email extension is installed/.test(error.msg)) return fail(error.msg);
    const saved = await row(error.emailId);
    if(saved.status !== 'queued' || saved.attempts !== 1 || saved.recipient !== TO || saved.html !== '<p>Hi</p>' || !saved.lastError) return fail(`the log has ${JSON.stringify(saved)}`);
    if(saved.type !== 'other') return fail(`type ${saved.type}`);
    pass('');
  },

  'a sender that sends marks it sent, and is given the whole email': async ({ pass, fail }) => {
    await reset();
    await sender('one', "return { sent: true, provider: 'one-mail', messageId: 'msg-1' };");
    const [error, result] = await mail({ template: 'verify-email' });
    if(error || result.status !== 'sent') return fail(`got ${JSON.stringify([error, result])}`);
    const saved = await row(result.id);
    if(saved.status !== 'sent' || saved.provider !== 'one-mail' || saved.providerRef !== 'msg-1' || !saved.sentAt || saved.attempts !== 1 || saved.lastError !== null) return fail(`the log has ${JSON.stringify(saved)}`);
    if(saved.type !== 'verify-email') return fail('the type is the template');
    const seen = calls('one')[0];
    if(seen.to !== TO || seen.subject !== 'Hello' || seen.html !== '<p>Hi</p>' || seen.id !== result.id || seen.attempt !== 1 || !seen.from) return fail(`the sender was given ${JSON.stringify(seen)}`);
    pass('');
  },

  'the first sender to send it ends the chain, and a sender that fails hands it to the next': async ({ pass, fail }) => {
    await reset();
    await sender('failing', "return { sent: false, error: 'Mailbox full' };");
    await sender('thrower', "throw new Error('Boom');");
    await sender('working', "return { sent: true, provider: 'working' };");
    await sender('after', "return { sent: true, provider: 'after' };");
    const [error, result] = await mail();
    if(error) return fail(error.msg);
    if(calls('failing').length !== 1 || calls('thrower').length !== 1 || calls('working').length !== 1) return fail('each sender before the one that worked should have had a try');
    if(calls('after').length !== 0) return fail('a sender after the one that sent it was given the email too');
    if((await row(result.id)).provider !== 'working') return fail('the wrong provider was recorded');
    pass('');
  },

  'when every sender fails the reasons are kept, and the email is tried again until its tries are used': async ({ pass, fail }) => {
    await reset();
    await sender('failing', "return { sent: false, error: 'Mailbox full' };");
    const [first] = await mail();
    if(first.code !== 502 || !first.msg.includes('Mailbox full') || !first.msg.includes(OWNER)) return fail(`got ${JSON.stringify(first)}`);
    let saved = await row(first.emailId);
    if(saved.status !== 'queued' || saved.attempts !== 1) return fail(`after the first try: ${saved.status}, ${saved.attempts}`);

    await maintainEmails();
    saved = await row(first.emailId);
    if(saved.attempts !== 1) return fail('it was tried again before the minute was up');

    await age(first.emailId, 2);
    await maintainEmails();
    saved = await row(first.emailId);
    if(saved.status !== 'failed' || saved.attempts !== 2) return fail(`after the retry: ${saved.status}, ${saved.attempts} (one retry is the default)`);
    if(calls('failing').length !== 2) return fail('the sender should have had two tries');

    await age(first.emailId, 2);
    await maintainEmails();
    if(calls('failing').length !== 2) return fail('a failed email was tried again by itself');
    pass('');
  },

  'a sender that is not set up is not counted as having tried, and the real failure is what is reported': async ({ pass, fail }) => {
    await reset();
    await sender('unset', "return { sent: false, skipped: true, error: 'No key is saved' };");
    await sender('broken', "return { sent: false, error: 'The server refused the sender' };");
    const [error] = await mail();
    if(error.code !== 502) return fail(`code ${error.code}`);
    if(error.msg.includes('No key is saved') || !error.msg.includes('The server refused the sender')) return fail(`the reason is "${error.msg}"`);
    const saved = await row(error.emailId);
    if(saved.lastError !== error.msg) return fail('the log should say the same');

    await reset();
    await sender('unset', "return { sent: false, skipped: true, error: 'No key is saved' };");
    const [none] = await mail();
    if(none.code !== 503 || !/No email extension is set up yet/.test(none.msg) || !none.msg.includes('No key is saved')) return fail(`when every sender is skipped: ${none.code} "${none.msg}"`);
    pass('');
  },

  'the sender is told whether the site chose its own address': async ({ pass, fail }) => {
    await reset();
    await sender('looker', "return { sent: false, error: 'just looking' };");
    await setSetting('system', 'email_from', '', 'string', false, 'test');
    const previousEnv = { from: process.env.EMAIL_FROM, smtp: process.env.SMTP_FROM };
    delete process.env.EMAIL_FROM;
    delete process.env.SMTP_FROM;
    try {
      await mail();
      if(calls('looker')[0].fromIsDefault !== true || calls('looker')[0].from !== 'noreply@example.com') return fail(`unset: ${JSON.stringify(calls('looker')[0])}`);
      await setSetting('system', 'email_from', 'Shop <shop@mine.test>', 'string', false, 'test');
      await mail();
      if(calls('looker')[1].fromIsDefault !== false || calls('looker')[1].from !== 'Shop <shop@mine.test>') return fail(`set: ${JSON.stringify(calls('looker')[1])}`);
    } finally {
      await setSetting('system', 'email_from', '', 'string', false, 'test');
      if(previousEnv.from !== undefined) process.env.EMAIL_FROM = previousEnv.from;
      if(previousEnv.smtp !== undefined) process.env.SMTP_FROM = previousEnv.smtp;
    }
    pass('');
  },

  'no retries means one try, and the retry setting is respected': async ({ pass, fail }) => {
    await reset();
    await setRetries(0);
    await sender('failing', "return { sent: false, error: 'No' };");
    const [error] = await mail();
    if((await row(error.emailId)).status !== 'failed') return fail('with no retries the first failure is final');
    await setRetries(3);
    const [again] = await mail();
    for(let step = 0; step < 3; step++){ await age(again.emailId, 2); await maintainEmails(); }
    const saved = await row(again.emailId);
    if(saved.status !== 'failed' || saved.attempts !== 4) return fail(`after 3 retries: ${saved.status}, ${saved.attempts}`);
    await setRetries(1);
    pass('');
  },

  'a retry that works sends it, and the retry button gives a failed email its tries again': async ({ pass, fail }) => {
    await reset();
    await setRetries(0);
    await sender('flaky', "return globalThis.emailLogWorks ? { sent: true, provider: 'flaky' } : { sent: false, error: 'Down' };");
    globalThis.emailLogWorks = false;
    const [error] = await mail();
    if((await row(error.emailId)).status !== 'failed') return fail('it should have failed');
    globalThis.emailLogWorks = true;
    const [retryError, result] = await retryEmail(error.emailId);
    delete globalThis.emailLogWorks;
    if(retryError || result.status !== 'sent') return fail(`got ${JSON.stringify([retryError, result])}`);
    const saved = await row(error.emailId);
    if(saved.status !== 'sent' || saved.attempts !== 1 || saved.lastError !== null) return fail(`the log has ${saved.status}, ${saved.attempts}, ${saved.lastError}`);
    const [again] = await retryEmail(error.emailId);
    if(again?.code !== 409) return fail('an email that was sent cannot be tried again');
    const [missing] = await retryEmail('no-such-email');
    if(missing?.code !== 409) return fail('an unknown email cannot be tried again');
    await setRetries(1);
    pass('');
  },

  'two sends of one email at once reach the sender once': async ({ pass, fail }) => {
    await reset();
    await sender('slow', "await new Promise(resolve => setTimeout(resolve, 60)); return { sent: true, provider: 'slow' };");
    const id = 'race-email-log-test';
    await db.insert(email).values({ id, type: 'other', recipient: TO, sender: 'a@b.co', subject: 'Race', html: 'x', status: 'queued', attempts: 0, createdAt: new Date(), updatedAt: new Date() });
    const dispatch = (await load('server/utils/email/dispatchEmail.js')).default;
    const results = await Promise.all([dispatch(id), dispatch(id)]);
    if(results.filter(([error]) => !error).length !== 1 || results.find(([error]) => error)[0].code !== 409) return fail(`got ${JSON.stringify(results)}`);
    if(calls('slow').length !== 1) return fail(`the sender saw ${calls('slow').length} emails`);
    pass('');
  },

  'a send that never finished comes back to the queue, and one that is over a day old is not sent late': async ({ pass, fail }) => {
    await reset();
    const [stuck] = await mail();
    await db.update(email).set({ status: 'sending' }).where(eq(email.id, stuck.emailId));
    await age(stuck.emailId, 10);
    await sender('works', "return { sent: true, provider: 'works' };");
    await maintainEmails();
    const recovered = await row(stuck.emailId);
    if(recovered.status !== 'sent') return fail(`a stuck send should have been picked up and sent, it is ${recovered.status}`);

    await db.delete(hook).where(eq(hook.owner, OWNER));
    const [old] = await mail();
    await db.execute(sql`update email set "createdAt" = now() - interval '2 days', "updatedAt" = now() - interval '2 days' where id = ${old.emailId}`);
    await sender('late', "return { sent: true, provider: 'late' };");
    await maintainEmails();
    const tooOld = await row(old.emailId);
    if(tooOld.status !== 'failed' || !/too old/.test(tooOld.lastError)) return fail(`an email a day old should be failed, it is ${tooOld.status}: ${tooOld.lastError}`);
    if(calls('late').length !== 0) return fail('an email that was too old was sent');
    pass('');
  },

  'the log is listed newest first, filtered and searched, without the bodies, and one is read whole': async ({ pass, fail }) => {
    await reset();
    await sender('works', "return { sent: true, provider: 'works' };");
    await mail({ subject: 'First one' });
    await mail({ to: 'other@email-log.test', subject: 'Second one' });
    await db.delete(hook).where(eq(hook.owner, OWNER));
    await setRetries(0);
    await mail({ subject: 'Third one' });
    const [, all] = await listEmails({ search: 'email-log.test', limit: 10 });
    if(JSON.stringify(all.emails.map(entry => entry.subject)) !== JSON.stringify(['Third one', 'Second one', 'First one'])) return fail(`order ${JSON.stringify(all.emails.map(entry => entry.subject))}`);
    if('html' in all.emails[0]) return fail('the list has the bodies');
    const [, failed] = await listEmails({ status: 'failed', search: 'email-log.test' });
    if(failed.total !== 1 || failed.emails[0].subject !== 'Third one') return fail('the status filter');
    const [, mine] = await listEmails({ search: 'other@' });
    if(mine.total !== 1) return fail('the search');
    const [, percent] = await listEmails({ search: '%' });
    if(percent.total !== 0) return fail('a percent sign worked as a pattern');
    const [badStatus] = await listEmails({ status: 'bogus' });
    if(badStatus?.code !== 400) return fail('a bad status');
    const [, whole] = await getEmail(all.emails[0].id);
    if(whole.html !== '<p>Hi</p>') return fail('one email is read whole');
    const [missing] = await getEmail('nope');
    if(missing?.code !== 404) return fail('an unknown email is a 404');
    await setRetries(1);
    pass('');
  },

  'old emails are deleted by the retention settings, with a kind of email able to be kept longer or shorter': async ({ pass, fail }) => {
    await reset();
    const insert = (id, type, days) => db.insert(email).values({ id, type, recipient: TO, sender: 'a@b.co', subject: id, html: 'x', status: 'sent', attempts: 1, createdAt: new Date(Date.now() - days * 86400000), updatedAt: new Date() });
    await insert('r-default-old', 'other', 40);
    await insert('r-default-new', 'other', 10);
    await insert('r-verify-old', 'verify-email', 10);
    await insert('r-order-old', 'order', 100);
    await setSetting('system', 'email_retention_days', 30, 'number', false, 'test');
    await setSetting('system', 'email_retention_by_type', { 'verify-email': 7, order: 365 }, 'json', false, 'test');
    const [error, result] = await pruneEmails();
    if(error) return fail(error.msg);
    const left = (await db.select({ id: email.id }).from(email).where(sql`id like 'r-%'`)).map(entry => entry.id).sort();
    if(JSON.stringify(left) !== JSON.stringify(['r-default-new', 'r-order-old'])) return fail(`left ${JSON.stringify(left)}`);
    if(result.deleted !== 2) return fail(`deleted ${result.deleted}`);
    await setSetting('system', 'email_retention_days', 0, 'number', false, 'test');
    await setSetting('system', 'email_retention_by_type', {}, 'json', false, 'test');
    await insert('r-forever', 'other', 3000);
    await pruneEmails();
    if(!(await row('r-forever'))) return fail('0 days should keep an email forever');
    await db.execute(sql`delete from email where id like 'r-%'`);
    await setSetting('system', 'email_retention_days', 30, 'number', false, 'test');
    pass('');
  },

  'a template email is logged with its template as its type': async ({ pass, fail }) => {
    await reset();
    await sender('works', "return { sent: true, provider: 'works' };");
    const [error, result] = await sendEmailFromTemplate({ to: TO, subject: 'Verify', template: 'verify-email', data: { name: 'Ada', verificationLink: 'https://x.test/v' } });
    if(error) return fail(error.msg);
    const saved = await row(result.id);
    if(saved.type !== 'verify-email' || !saved.html.includes('https://x.test/v')) return fail(`type ${saved.type}`);
    const [missing] = await sendEmailFromTemplate({ to: TO, subject: 'x', template: 'no-such-template' });
    if(missing?.code !== 404) return fail('an unknown template should not be logged or sent');
    pass('');
  },

  'a bad request is refused before anything is logged': async ({ pass, fail }) => {
    await reset();
    for(const input of [{ to: '', subject: 's', html: 'h' }, { to: TO, subject: '', html: 'h' }, { to: TO, subject: 's', html: '' }]){
      const [error] = await sendEmail(input);
      if(error?.code !== 400) return fail(`${JSON.stringify(input)} gave ${error?.code}`);
    }
    const [, all] = await listEmails({ search: 'email-log.test' });
    if(all.total !== 0) return fail('a refused email was logged');
    pass('');
  },

  'the email settings are checked when they are saved': async ({ pass, fail }) => {
    for(const [name, value, type] of [['email_max_retries', -1, 'number'], ['email_max_retries', 11, 'number'], ['email_max_retries', 1.5, 'number'], ['email_retention_days', -5, 'number'], ['email_retention_by_type', [1], 'json'], ['email_retention_by_type', { a: 'x' }, 'json'], ['email_retention_by_type', { a: -1 }, 'json'], ['email_retention_by_type', 'text', 'json']]){
      const [error] = await setSetting('system', name, value, type, false, 'test');
      if(error?.code !== 400) return fail(`${name} = ${JSON.stringify(value)} was accepted`);
    }
    for(const [name, value, type] of [['email_max_retries', 0, 'number'], ['email_max_retries', 10, 'number'], ['email_retention_days', 0, 'number'], ['email_retention_by_type', {}, 'json'], ['email_retention_by_type', { 'verify-email': 7 }, 'json']]){
      const [error] = await setSetting('system', name, value, type, false, 'test');
      if(error) return fail(`${name} = ${JSON.stringify(value)} was refused: ${error.msg}`);
    }
    await setSetting('system', 'email_max_retries', 1, 'number', false, 'test');
    await setSetting('system', 'email_retention_by_type', {}, 'json', false, 'test');
    pass('');
  },
};
