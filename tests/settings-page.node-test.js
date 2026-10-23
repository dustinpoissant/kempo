import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { seedDatabase } from './helpers/db.js';

/*
  The pieces under the admin Settings page that can be tested without a browser: the readable name made from a setting's name, and
  listing the settings of one owner (by plain prefix, in name order, with secrets masked).
*/

/* A secret setting is stored encrypted, so the suite needs a key even where the environment has none (CI). It protects nothing. */
process.env.SETTINGS_ENCRYPTION_KEY ||= '0'.repeat(64);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = async relative => (await import(pathToFileURL(path.join(root, relative)).href)).default;

const humanize = await load('src/admin/components/settings/humanize.js');
const listSettings = await load('server/utils/settings/listSettings.js');
const setSetting = await load('server/utils/settings/setSetting.js');
const deleteSetting = await load('server/utils/settings/deleteSetting.js');

const OWNERS = ['settings-page-a', 'settings-page_a', 'settings-page-b'];
const names = settings => settings.map(entry => entry.name);

export const beforeAll = async () => {
  await seedDatabase();
  await setSetting('settings-page-a', 'zebra', 'z', 'string', false, '');
  await setSetting('settings-page-a', 'apple', 1, 'number', false, '');
  await setSetting('settings-page_a', 'lookalike', 'x', 'string', false, '');
  await setSetting('settings-page-b', 'api_key', 'top-secret', 'secret', false, '');
};

export const afterAll = async () => {
  for(const [owner, name] of [['settings-page-a', 'zebra'], ['settings-page-a', 'apple'], ['settings-page_a', 'lookalike'], ['settings-page-b', 'api_key']]) await deleteSetting(owner, name);
};

export default {
  'a readable name is made from the setting name': async ({ pass, fail }) => {
    const cases = {
      site_name: 'Site Name',
      session_duration_days: 'Session Duration Days',
      verification_url: 'Verification URL',
      shippoCacheMinutes: 'Shippo Cache Minutes',
      'kebab-case-name': 'Kebab Case Name',
      email_from: 'Email From',
      api_key: 'API Key',
      __weird__name__: 'Weird Name',
      '': '',
    };
    for(const [name, expected] of Object.entries(cases)){
      const got = humanize(name);
      if(got !== expected) return fail(`${JSON.stringify(name)} gave ${JSON.stringify(got)}, wanted ${JSON.stringify(expected)}`);
    }
    if(humanize(null) !== '' || humanize(undefined) !== '') return fail('nothing should give nothing');
    pass('');
  },

  'one extension is listed by name, in order, and never picks up another owner that only looks alike': async ({ pass, fail }) => {
    const [error, data] = await listSettings({ owner: 'settings-page-a' });
    if(error) return fail(error.msg);
    if(JSON.stringify(names(data.settings)) !== JSON.stringify(['settings-page-a:apple', 'settings-page-a:zebra'])) return fail(`got ${JSON.stringify(names(data.settings))}`);
    if(data.total !== 2) return fail(`total ${data.total}`);
    const [, lookalike] = await listSettings({ owner: 'settings-page_a' });
    if(JSON.stringify(names(lookalike.settings)) !== JSON.stringify(['settings-page_a:lookalike'])) return fail('the underscore matched another owner');
    const [, wildcard] = await listSettings({ owner: 'settings%' });
    if(wildcard.settings.length) return fail('a percent sign worked as a pattern');
    pass('');
  },

  'extension means everything that is neither system nor custom, and secrets are masked': async ({ pass, fail }) => {
    const [error, data] = await listSettings({ owner: 'extension', limit: 1000 });
    if(error) return fail(error.msg);
    if(data.settings.some(entry => entry.name.startsWith('system:') || entry.name.startsWith('custom:'))) return fail('a system or custom setting was listed');
    if(!names(data.settings).includes('settings-page-a:apple')) return fail('an extension setting is missing');
    const secret = data.settings.find(entry => entry.name === 'settings-page-b:api_key');
    if(!secret || secret.value === 'top-secret' || JSON.stringify(secret).includes('top-secret')) return fail('a secret was sent');
    const sorted = names(data.settings).every((name, index, all) => index === 0 || all[index - 1] <= name);
    if(!sorted) return fail('not in name order');
    pass('');
  },

  'system and custom list only their own': async ({ pass, fail }) => {
    const [, system] = await listSettings({ owner: 'system', limit: 1000 });
    if(!system.settings.length || system.settings.some(entry => !entry.name.startsWith('system:'))) return fail('system');
    if(!names(system.settings).includes('system:site_name')) return fail('site_name is missing');
    pass('');
  },
};
