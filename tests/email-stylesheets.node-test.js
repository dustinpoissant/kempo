import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';
import { seedDatabase } from './helpers/db.js';

/*
  Email stylesheets: the default one is made and kept, stylesheets are made, changed and deleted (the default is not), a template
  chooses one, and a rendered email gets only the rules it uses.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = async relative => (await import(pathToFileURL(path.join(root, relative)).href));

const stylesheets = await load('server/utils/email/stylesheets.js');
const treeShake = (await load('server/utils/email/treeShake.js')).default;
const renderEmailTemplate = (await load('server/utils/email/renderEmailTemplate.js')).default;

const NAME = 'tests-sheet';
const TEMPLATE = 'verify-email';

export const beforeAll = async () => {
  await seedDatabase();
  await stylesheets.ensureDefaultStylesheet();
};

const reset = async () => {
  await stylesheets.deleteStylesheet(NAME);
  await stylesheets.setStylesheetFor(TEMPLATE, stylesheets.DEFAULT_STYLESHEET);
};

export default {
  'the default stylesheet is made, and making it again changes nothing': async ({ pass, fail }) => {
    const [, again] = await stylesheets.ensureDefaultStylesheet();
    if(again.added.length) return fail('the default was made twice');
    const [error, sheet] = await stylesheets.getStylesheet(stylesheets.DEFAULT_STYLESHEET);
    if(error || !sheet.css.includes('.btn')) return fail('the default has no CSS');
    pass('');
  },

  'the default stylesheet cannot be deleted, by anyone': async ({ pass, fail }) => {
    const [error] = await stylesheets.deleteStylesheet(stylesheets.DEFAULT_STYLESHEET);
    if(error?.code !== 403) return fail(`expected 403, got ${JSON.stringify(error)}`);
    const [, list] = await stylesheets.listStylesheets();
    if(!list.find(sheet => sheet.name === stylesheets.DEFAULT_STYLESHEET)?.builtIn) return fail('the default is not marked built in');
    pass('');
  },

  'a stylesheet can be made, changed and deleted, with names checked and taken names refused': async ({ pass, fail }) => {
    await reset();
    const [madeError, created] = await stylesheets.createStylesheet({ name: NAME, description: 'test', css: '.a{color:red}' });
    if(madeError || !created) return fail(`not made: ${JSON.stringify(madeError)}`);
    const [dup] = await stylesheets.createStylesheet({ name: NAME, css: '' });
    if(dup?.code !== 409) return fail(`a taken name should be 409, got ${JSON.stringify(dup)}`);
    const [bad] = await stylesheets.createStylesheet({ name: 'Not Valid', css: '' });
    if(bad?.code !== 400) return fail(`a bad name should be 400, got ${JSON.stringify(bad)}`);
    const [, changed] = await stylesheets.updateStylesheet(NAME, { css: '.b{color:blue}' });
    if(changed.css !== '.b{color:blue}') return fail('the CSS was not changed');
    const [, read] = await stylesheets.getStylesheet(NAME);
    if(read.css !== '.b{color:blue}') return fail('the change was not stored');
    const [gone] = await stylesheets.deleteStylesheet(NAME);
    if(gone) return fail(`not deleted: ${JSON.stringify(gone)}`);
    pass('');
  },

  'a template chooses a stylesheet, and deleting it puts the template back on the default': async ({ pass, fail }) => {
    await reset();
    await stylesheets.createStylesheet({ name: NAME, css: '.x{color:red}' });
    const [chosen] = await stylesheets.setStylesheetFor(TEMPLATE, NAME);
    if(chosen) return fail(`could not choose: ${JSON.stringify(chosen)}`);
    if(await stylesheets.stylesheetFor(TEMPLATE) !== NAME) return fail('the choice was not kept');
    await stylesheets.deleteStylesheet(NAME);
    if(await stylesheets.stylesheetFor(TEMPLATE) !== stylesheets.DEFAULT_STYLESHEET) return fail('the template was not put back on the default');
    const [unknown] = await stylesheets.setStylesheetFor(TEMPLATE, 'no-such-sheet');
    if(unknown?.code !== 404) return fail(`an unknown stylesheet should be 404, got ${JSON.stringify(unknown)}`);
    pass('');
  },

  'tree shaking keeps the rules whose element and classes are on the page': async ({ pass, fail }) => {
    const css = '.btn{color:red}.zzz{color:blue}p{margin:0}.btn.primary{color:green}.btn.danger{color:black}h2, h9{color:white}';
    const out = treeShake(css, '<p class="btn primary">Hi</p><h2>x</h2>');
    if(!out.includes('.btn{color:red}') || !out.includes('p{margin:0}') || !out.includes('.btn.primary{color:green}') || !out.includes('h2{color:white}')) return fail(`a used rule was dropped: ${out}`);
    if(/zzz|danger|h9/.test(out)) return fail(`an unused rule survived: ${out}`);
    pass('');
  },

  'an email is drawn with the chosen stylesheet, and only the rules it uses': async ({ pass, fail }) => {
    await reset();
    await stylesheets.createStylesheet({ name: NAME, css: '.small{font-size:9px}.unused-class{color:red}' });
    await stylesheets.setStylesheetFor(TEMPLATE, NAME);
    const [error, page] = await renderEmailTemplate({ template: TEMPLATE, data: { name: 'Ann', verificationLink: 'https://x.test/v' } });
    if(error) return fail(error.msg);
    if(!/<p class="small" style="font-size:\s*9px;?"|<[^>]+class="small"[^>]*style="[^"]*font-size:\s*9px/.test(page)) return fail('the used rule is not on its element');
    if(/<style/.test(page)) return fail('the email still has a style block, which mail clients ignore');
    if(page.includes('unused-class')) return fail('an unused rule was sent');
    if(page.includes('kempo-css')) return fail('the email still embeds kempo-css');
    await reset();
    pass('');
  },
};
