import { mkdir, rm, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

/*
  The made-up values an email template is previewed with: `<name>.sample.json` beside the template, the
  site's winning over the packaged one, and anything else meaning "no data" rather than an error.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteDir = path.join(root, 'templates', 'emails');
const names = ['sample-test-a', 'sample-test-b', 'sample-test-c'];
const readEmailSample = (await import(pathToFileURL(path.join(root, 'server/utils/email/readEmailSample.js')).href)).default;

const cleanup = async () => {
  for(const name of names) await rm(path.join(siteDir, `${name}.sample.json`), { force: true });
};

export default {
  'a template is previewed with the values in its sample file': async ({ pass, fail }) => {
    await mkdir(siteDir, { recursive: true });
    await writeFile(path.join(siteDir, 'sample-test-a.sample.json'), JSON.stringify({ code: '482913', again: false }));
    const sample = await readEmailSample({ template: 'sample-test-a' });
    await cleanup();
    if(sample.code !== '482913' || sample.again !== false) return fail(JSON.stringify(sample));
    pass('');
  },

  'no file, a file that is not JSON, or one that is not an object all mean no data': async ({ pass, fail }) => {
    await mkdir(siteDir, { recursive: true });
    await writeFile(path.join(siteDir, 'sample-test-b.sample.json'), '{ not json');
    await writeFile(path.join(siteDir, 'sample-test-c.sample.json'), JSON.stringify(['a', 'list']));
    const results = [await readEmailSample({ template: 'sample-test-missing' }), await readEmailSample({ template: 'sample-test-b' }), await readEmailSample({ template: 'sample-test-c' }), await readEmailSample({ template: '../etc/passwd' })];
    await cleanup();
    if(results.some(result => Object.keys(result).length)) return fail(JSON.stringify(results));
    pass('');
  },
};
