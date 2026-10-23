import { symlink, rm, readFile, access } from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

/*
  Editing email templates from the admin: an extension's templates are listed, read, saved as the site's own copy in
  templates/emails (never touching the packaged one), and reset. A template that cannot be rendered is not kept.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = 'kempo-email-edit-fixture';
const fixtureLink = path.join(root, 'node_modules', FIXTURE);
const siteDir = path.join(root, 'templates', 'emails', FIXTURE);
const sitePath = path.join(siteDir, 'hello.page.html');
const load = file => import(pathToFileURL(path.join(root, file)).href);

const list = (await load('server/utils/email/listEmailTemplates.js')).default;
const read = (await load('server/utils/email/readEmailTemplate.js')).default;
const save = (await load('server/utils/email/saveEmailTemplate.js')).default;
const reset = (await load('server/utils/email/resetEmailTemplate.js')).default;
const renderEmailTemplate = (await load('server/utils/email/renderEmailTemplate.js')).default;

const exists = file => access(file).then(() => true, () => false);

const cleanup = async () => {
  await rm(fixtureLink, { recursive: true, force: true }).catch(() => {});
  await rm(siteDir, { recursive: true, force: true }).catch(() => {});
};

const GOOD = '<page template="email" title="Reworded"><content><p>Reworded for {{name}}</p></content></page>';

export default {
  'an extension\'s templates are listed with their titles and whether the site changed them': async ({ pass, fail }) => {
    await cleanup();
    await symlink(path.join(root, 'tests', 'fixtures', 'kempo-email-fixture'), fixtureLink, 'junction');
    const [error, templates] = await list({ owner: FIXTURE });
    if(error) return fail(error.msg);
    if(templates.length !== 1 || templates[0].template !== `${FIXTURE}/hello` || templates[0].title !== 'Hello from the extension') return fail(`got ${JSON.stringify(templates)}`);
    if(templates[0].overridden || !templates[0].packaged) return fail('an untouched packaged template is not overridden');
    const [badOwner] = await list({ owner: '../x' });
    if(badOwner?.code !== 400) return fail('a bad extension name should be refused');
    const [none, empty] = await list({ owner: 'no-such-extension' });
    if(none || empty.length) return fail('an extension with no emails has an empty list');
    pass('');
  },

  'kempo\'s own templates are listed when no extension is named': async ({ pass, fail }) => {
    const [error, templates] = await list({});
    if(error) return fail(error.msg);
    if(!templates.some(template => template.template === 'verify-email')) return fail('verify-email is missing');
    pass('');
  },

  'a saved template is the site\'s own copy, is used for the next email, and the packaged one is untouched': async ({ pass, fail }) => {
    const packagedPath = path.join(root, 'tests', 'fixtures', 'kempo-email-fixture', 'emails', 'hello.page.html');
    const before = await readFile(packagedPath, 'utf8');
    const [error] = await save({ template: `${FIXTURE}/hello`, source: GOOD });
    if(error) return fail(error.msg);
    if(await readFile(sitePath, 'utf8') !== GOOD) return fail('the site copy was not written');
    if(await readFile(packagedPath, 'utf8') !== before) return fail('the packaged template was changed');
    const [, html] = await renderEmailTemplate({ template: `${FIXTURE}/hello`, data: { name: 'Ada' } });
    if(!html.includes('Reworded for Ada')) return fail('the next email does not use the saved copy');
    const [, found] = await read({ template: `${FIXTURE}/hello` });
    if(found.source !== GOOD || !found.overridden || found.defaultSource !== before || found.title !== 'Reworded') return fail(`read gave ${JSON.stringify(found)}`);
    const [, listed] = await list({ owner: FIXTURE });
    if(!listed[0].overridden) return fail('the list does not say it was changed');
    pass('');
  },

  'saving refuses bad names, empty, huge and unknown templates and writes nothing': async ({ pass, fail }) => {
    await rm(siteDir, { recursive: true, force: true });
    const cases = [
      [{ template: '../etc/passwd', source: GOOD }, 400], [{ template: 'a/b/c', source: GOOD }, 400], [{ template: undefined, source: GOOD }, 400],
      [{ template: `${FIXTURE}/hello`, source: '   ' }, 400], [{ template: `${FIXTURE}/hello`, source: 5 }, 400],
      [{ template: `${FIXTURE}/hello`, source: 'x'.repeat(100001) }, 400], [{ template: `${FIXTURE}/hello`, source: `a${'\u0000'}b` }, 400],
      [{ template: `${FIXTURE}/new-name`, source: GOOD }, 404],
    ];
    for(const [input, code] of cases){
      const [error] = await save(input);
      if(error?.code !== code) return fail(`${JSON.stringify(input).slice(0, 70)} gave ${error?.code}, wanted ${code}`);
    }
    if(await exists(siteDir)) return fail('a refused save left files behind');
    pass('');
  },

  'resetting removes the site copy so the packaged template is used again, and refuses what has no packaged one': async ({ pass, fail }) => {
    await save({ template: `${FIXTURE}/hello`, source: GOOD });
    const [error] = await reset({ template: `${FIXTURE}/hello` });
    if(error) return fail(error.msg);
    if(await exists(sitePath)) return fail('the site copy is still there');
    const [, html] = await renderEmailTemplate({ template: `${FIXTURE}/hello`, data: { name: 'Ada' } });
    if(!html.includes('Hello Ada')) return fail('the packaged template is not used again');
    const [again] = await reset({ template: `${FIXTURE}/hello` });
    if(again) return fail('resetting an untouched template should be harmless');
    const [noPackaged] = await reset({ template: `${FIXTURE}/nope` });
    if(noPackaged?.code !== 409) return fail('a template with no packaged version cannot be reset');
    const [bad] = await reset({ template: 'Bad Name' });
    if(bad?.code !== 400) return fail('a bad name should be refused');
    await cleanup();
    pass('');
  },
};
