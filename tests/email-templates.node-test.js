import { symlink, rm, mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

/*
  Email templates. A plain name is kempo's or the site's; "owner/name" is an extension's own template,
  which the site can override and which is laid out with the site's (or kempo's) email layout.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = 'kempo-email-fixture';
const fixtureLink = path.join(root, 'node_modules', FIXTURE);
const siteDir = path.join(root, 'templates', 'emails', FIXTURE);
const load = file => import(pathToFileURL(path.join(root, file)).href);

const renderEmailTemplate = (await load('server/utils/email/renderEmailTemplate.js')).default;
const sendEmailFromTemplate = (await load('server/utils/email/sendEmailFromTemplate.js')).default;

const cleanup = async () => {
  await rm(fixtureLink, { recursive: true, force: true }).catch(() => {});
  await rm(path.join(root, 'templates'), { recursive: true, force: true }).catch(() => {});
};

export default {
  'a plain name still renders kempo\'s own template': async ({ pass, fail }) => {
    const [error, html] = await renderEmailTemplate({ template: 'verify-email', data: { name: 'Sam', verificationLink: 'https://x.test/v/1' } });
    if(error) return fail(error.msg);
    if(!html.includes('<html')) return fail('not a full document');
    pass('');
  },

  'an extension\'s template renders inside the email layout with its data': async ({ pass, fail }) => {
    await cleanup();
    await symlink(path.join(root, 'tests', 'fixtures', FIXTURE), fixtureLink, 'junction');
    const [error, html] = await renderEmailTemplate({ template: `${FIXTURE}/hello`, data: { name: 'Ada' } });
    if(error) return fail(error.msg);
    if(!html.includes('Hello Ada')) return fail('data was not applied');
    if(!html.includes('<html') || !html.includes('max-width: 600px')) return fail('the email layout was not applied');
    pass('');
  },

  'the site can override an extension\'s template': async ({ pass, fail }) => {
    await mkdir(siteDir, { recursive: true });
    await writeFile(path.join(siteDir, 'hello.page.html'), '<page template="email" title="x"><content><p>Site wording for {{name}}</p></content></page>');
    const [error, html] = await renderEmailTemplate({ template: `${FIXTURE}/hello`, data: { name: 'Ada' } });
    if(error) return fail(error.msg);
    if(!html.includes('Site wording for Ada')) return fail('the override was not used');
    pass('');
  },

  'unknown and malformed names are refused': async ({ pass, fail }) => {
    const [missing] = await renderEmailTemplate({ template: `${FIXTURE}/nope` });
    if(!missing || missing.code !== 404) return fail('a missing template should be 404');
    const [absent] = await renderEmailTemplate({ template: 'no-such-extension/hello' });
    if(!absent || absent.code !== 404) return fail('an absent extension should be 404');
    for(const template of ['../secrets', 'a/b/c', 'Hello', '/etc/passwd', 'a//b', '']){
      const [error] = await renderEmailTemplate({ template });
      if(!error || ![400].includes(error.code)) return fail(`accepted "${template}"`);
    }
    pass('');
  },

  'sendEmailFromTemplate reports a missing template before trying to send': async ({ pass, fail }) => {
    const [error] = await sendEmailFromTemplate({ to: 'a@b.test', subject: 's', template: `${FIXTURE}/nope` });
    if(!error || error.code !== 404) return fail(`got ${JSON.stringify(error)}`);
    await cleanup();
    pass('');
  },
};
