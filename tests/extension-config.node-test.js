import { mkdtemp, writeFile, rm } from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

/*
  Where an extension's kempo configuration is read from. It lives in kempo-config.json; package.json's
  own `kempo` field is only a fallback for older extensions, and the config wins field by field.

  This is the one reader behind the public-scope routing, the docs link, install and the admin's
  Update button. Reading package.json alone is how the docs link came to be empty for every extension
  and how Update never delivered a new permission, setting, hook or widget.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readKempoConfig = (await import(pathToFileURL(path.join(root, 'server/utils/extensions/readKempoConfig.js')).href)).default;

const withExtension = async (files, run) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'kempo-config-'));
  try {
    for(const [name, contents] of Object.entries(files)) await writeFile(path.join(dir, name), typeof contents === 'string' ? contents : JSON.stringify(contents));
    return await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

export default {
  'kempo-config.json is the source, and package.json is returned alongside it': async ({ pass, fail }) => {
    await withExtension({
      'package.json': { name: 'x', version: '1.2.3' },
      'kempo-config.json': { 'public-scope': 'x', docs: 'https://docs.test/x', widgets: [{ key: 'a' }] },
    }, async dir => {
      const { pkg, kempo } = await readKempoConfig(dir);
      if(pkg.version !== '1.2.3') return fail('package.json was not returned');
      if(kempo['public-scope'] !== 'x' || kempo.docs !== 'https://docs.test/x' || kempo.widgets.length !== 1) return fail(`got ${JSON.stringify(kempo)}`);
      pass();
    });
  },

  'a package.json kempo field is the fallback for an older extension': async ({ pass, fail }) => {
    await withExtension({ 'package.json': { name: 'old', kempo: { 'public-scope': 'old', hooks: { 'user:registered': './h.js' } } } }, async dir => {
      const { kempo } = await readKempoConfig(dir);
      if(kempo['public-scope'] !== 'old' || !kempo.hooks) return fail(`got ${JSON.stringify(kempo)}`);
      pass();
    });
  },

  'kempo-config.json wins field by field, and package.json fills what it leaves out': async ({ pass, fail }) => {
    await withExtension({
      'package.json': { name: 'both', kempo: { 'public-scope': 'from-package', docs: 'https://old.test' } },
      'kempo-config.json': { 'public-scope': 'from-config' },
    }, async dir => {
      const { kempo } = await readKempoConfig(dir);
      if(kempo['public-scope'] !== 'from-config') return fail(`the config should win, got ${kempo['public-scope']}`);
      if(kempo.docs !== 'https://old.test') return fail('a field only package.json has should still come through');
      pass();
    });
  },

  'an extension with no kempo configuration at all reads as empty': async ({ pass, fail }) => {
    await withExtension({ 'package.json': { name: 'plain' } }, async dir => {
      const { kempo } = await readKempoConfig(dir);
      if(Object.keys(kempo).length) return fail(`expected nothing, got ${JSON.stringify(kempo)}`);
      pass();
    });
  },

  'a package that is not installed throws, so callers can skip it': async ({ pass, fail }) => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'kempo-config-'));
    try {
      await readKempoConfig(dir);
      fail('expected a throw for a directory with no package.json');
    } catch {
      pass();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },

  'a kempo-config.json that is not valid JSON is an error, not silently ignored': async ({ pass, fail }) => {
    await withExtension({ 'package.json': { name: 'bad' }, 'kempo-config.json': '{ nope' }, async dir => {
      try {
        await readKempoConfig(dir);
        fail('a broken config must not read as an empty one');
      } catch {
        pass();
      }
    });
  },
};
