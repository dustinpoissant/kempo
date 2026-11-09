import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

/*
  An extension can declare `suggestedPeers` in kempo-config.json: other extensions it works better with. It is advice
  only (nothing is required), so it is checked here for shape, and a bad entry is named so the author can fix it.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { normalizeSuggestedPeers, suggestionsFor } = await import(pathToFileURL(path.join(root, 'server/utils/extensions/suggestedPeers.js')).href);

export default {
  'no declaration means no suggestions': async ({ pass, fail }) => {
    for(const value of [undefined, null, []]){
      const [error, peers] = normalizeSuggestedPeers(value);
      if(error || peers.length) return fail(`${JSON.stringify(value)} gave ${JSON.stringify(error || peers)}`);
    }
    pass('');
  },

  'a name and an object with a reason are both accepted': async ({ pass, fail }) => {
    const [error, peers] = normalizeSuggestedPeers(['kempo-thumbs', { name: 'kempo-media', reason: '  Pictures  ' }]);
    if(error) return fail(error.msg);
    if(JSON.stringify(peers) !== JSON.stringify([{ name: 'kempo-thumbs', reason: '' }, { name: 'kempo-media', reason: 'Pictures' }])) return fail(JSON.stringify(peers));
    pass('');
  },

  'the extension itself and repeats are left out': async ({ pass, fail }) => {
    const [error, peers] = normalizeSuggestedPeers(['kempo-products', 'kempo-media', { name: 'kempo-media', reason: 'again' }], 'kempo-products');
    if(error) return fail(error.msg);
    if(peers.length !== 1 || peers[0].name !== 'kempo-media') return fail(JSON.stringify(peers));
    pass('');
  },

  'a reason is cut to a sensible length': async ({ pass, fail }) => {
    const [, peers] = normalizeSuggestedPeers([{ name: 'kempo-media', reason: 'x'.repeat(500) }]);
    if(peers[0].reason.length !== 200) return fail(`${peers[0].reason.length} characters`);
    pass('');
  },

  'a bad declaration is refused and says what is wrong': async ({ pass, fail }) => {
    const bad = [
      ['kempo-media', '`suggestedPeers` must be a list'],
      [['Not A Name!'], 'not a valid package name'],
      [[{ reason: 'no name' }], 'not a valid package name'],
      [[{ name: 'kempo-media', reason: 5 }], 'not text']
    ];
    for(const [value, expected] of bad){
      const [error, peers] = normalizeSuggestedPeers(value);
      if(!error || peers !== null || !error.msg.includes(expected) || error.code !== 400) return fail(`${JSON.stringify(value)} gave ${JSON.stringify(error)}`);
    }
    pass('');
  },

  'suggestions for several extensions are merged, and leave out what runs already': async ({ pass, fail }) => {
    const rows = [
      { name: 'kempo-commerce', enabled: true, kempo: { suggestedPeers: [{ name: 'kempo-tax', reason: 'Tax at checkout' }, 'kempo-media', 'kempo-products'] } },
      { name: 'kempo-products', enabled: true, kempo: { suggestedPeers: [{ name: 'kempo-media', reason: 'Pictures' }] } },
      { name: 'kempo-tax', enabled: true, kempo: {} },
      { name: 'kempo-media', enabled: false, kempo: {} },
      { name: 'kempo-forms', enabled: true, kempo: { suggestedPeers: ['kempo-smtp'] } }
    ];
    const merged = suggestionsFor(rows, ['kempo-commerce', 'kempo-products']);
    if(merged.length !== 1) return fail(`Expected only kempo-media (the others run, or were just added): ${JSON.stringify(merged)}`);
    const [media] = merged;
    if(media.name !== 'kempo-media' || media.status !== 'disabled' || media.reason !== 'Pictures' || media.suggestedBy.join() !== 'kempo-commerce,kempo-products') return fail(JSON.stringify(media));
    const missing = suggestionsFor(rows, ['kempo-forms']);
    if(missing.length !== 1 || missing[0].status !== 'missing' || missing[0].suggestedBy.join() !== 'kempo-forms') return fail(JSON.stringify(missing));
    if(suggestionsFor(rows, ['kempo-tax', 'not-installed']).length) return fail('An extension that suggests nothing, or is not installed, should add nothing');
    pass('');
  },

  'every extension in this workspace declares valid suggestions': async ({ pass, fail }) => {
    const { readdir, readFile } = await import('fs/promises');
    const base = path.resolve(root, '..');
    for(const dir of await readdir(base)){
      if(!dir.startsWith('kempo-')) continue;
      const config = await readFile(path.join(base, dir, 'kempo-config.json'), 'utf8').then(JSON.parse, () => null);
      if(!config?.suggestedPeers) continue;
      const [error] = normalizeSuggestedPeers(config.suggestedPeers, dir);
      if(error) return fail(`${dir}: ${error.msg}`);
    }
    pass('');
  }
};
