import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

/*
  createPage/createFragment/createTemplate/createGlobalContent all defaulted their file's `owner`
  metadata to the literal string 'custom', with no way for a caller to say otherwise. That blocked
  an extension from calling these through the SDK and having the result recognised as its own (e.g.
  kempo-blog's createPost.js would want owner: 'kempo-blog', locked: true instead of hand-rolling the
  file). Each now takes an optional `owner`, defaulting to 'custom' so every existing caller — none
  of which pass it — is unaffected.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const createPage = (await import(pathToFileURL(path.join(root, 'server/utils/pages/createPage.js')).href)).default;
const createFragment = (await import(pathToFileURL(path.join(root, 'server/utils/fragments/createFragment.js')).href)).default;
const createTemplate = (await import(pathToFileURL(path.join(root, 'server/utils/templates/createTemplate.js')).href)).default;
const createGlobalContent = (await import(pathToFileURL(path.join(root, 'server/utils/global-content/createGlobalContent.js')).href)).default;

const withTmpDir = async fn => {
  const dir = await mkdtemp(path.join(tmpdir(), 'kempo-owner-'));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

export default {
  'createPage defaults owner to custom and accepts an explicit owner': async ({ pass, fail }) => {
    await withTmpDir(async rootDir => {
      const [defaultErr, defaultPage] = await createPage({ rootDir, name: 'Default Owner' });
      if(defaultErr) return fail(`default create returned an error: ${defaultErr.msg}`);
      const defaultContents = await readFile(path.join(rootDir, defaultPage.file), 'utf-8');
      if(!defaultContents.includes('owner: custom')) return fail(`expected owner: custom, got:\n${defaultContents}`);

      const [ownedErr, ownedPage] = await createPage({ rootDir, name: 'Extension Owned', owner: 'my-extension' });
      if(ownedErr) return fail(`owned create returned an error: ${ownedErr.msg}`);
      const ownedContents = await readFile(path.join(rootDir, ownedPage.file), 'utf-8');
      if(!ownedContents.includes('owner: my-extension')) return fail(`expected owner: my-extension, got:\n${ownedContents}`);

      pass();
    });
  },

  'createFragment defaults owner to custom and accepts an explicit owner': async ({ pass, fail }) => {
    await withTmpDir(async rootDir => {
      const [defaultErr, defaultFragment] = await createFragment({ rootDir, name: 'Default Owner' });
      if(defaultErr) return fail(`default create returned an error: ${defaultErr.msg}`);
      const defaultContents = await readFile(path.join(rootDir, defaultFragment.file), 'utf-8');
      if(!defaultContents.includes('owner: custom')) return fail(`expected owner: custom, got:\n${defaultContents}`);

      const [ownedErr, ownedFragment] = await createFragment({ rootDir, name: 'Extension Owned', owner: 'my-extension' });
      if(ownedErr) return fail(`owned create returned an error: ${ownedErr.msg}`);
      const ownedContents = await readFile(path.join(rootDir, ownedFragment.file), 'utf-8');
      if(!ownedContents.includes('owner: my-extension')) return fail(`expected owner: my-extension, got:\n${ownedContents}`);

      pass();
    });
  },

  'createTemplate defaults owner to custom and accepts an explicit owner': async ({ pass, fail }) => {
    await withTmpDir(async rootDir => {
      const [defaultErr, defaultTemplate] = await createTemplate({ rootDir, name: 'Default Owner' });
      if(defaultErr) return fail(`default create returned an error: ${defaultErr.msg}`);
      const defaultContents = await readFile(path.join(rootDir, defaultTemplate.file), 'utf-8');
      if(!defaultContents.includes('owner: custom')) return fail(`expected owner: custom, got:\n${defaultContents}`);

      const [ownedErr, ownedTemplate] = await createTemplate({ rootDir, name: 'Extension Owned', owner: 'my-extension' });
      if(ownedErr) return fail(`owned create returned an error: ${ownedErr.msg}`);
      const ownedContents = await readFile(path.join(rootDir, ownedTemplate.file), 'utf-8');
      if(!ownedContents.includes('owner: my-extension')) return fail(`expected owner: my-extension, got:\n${ownedContents}`);

      pass();
    });
  },

  'createGlobalContent defaults owner to custom and accepts an explicit owner': async ({ pass, fail }) => {
    await withTmpDir(async rootDir => {
      const [defaultErr, defaultEntry] = await createGlobalContent({ rootDir, name: 'Default Owner', location: 'head' });
      if(defaultErr) return fail(`default create returned an error: ${defaultErr.msg}`);
      if(defaultEntry.owner !== 'custom') return fail(`expected owner 'custom', got '${defaultEntry.owner}'`);

      const [ownedErr, ownedEntry] = await createGlobalContent({ rootDir, name: 'Extension Owned', location: 'head', owner: 'my-extension' });
      if(ownedErr) return fail(`owned create returned an error: ${ownedErr.msg}`);
      if(ownedEntry.owner !== 'my-extension') return fail(`expected owner 'my-extension', got '${ownedEntry.owner}'`);

      pass();
    });
  },
};
