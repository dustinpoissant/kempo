import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

/*
  The login and register pages are a thin wrapper around <k-login> / <k-register>, and each offers a
  named slot inside that element. A kempo (CMS) extension such as kempo-oauth pushes its "continue
  with ..." buttons into the slot with a *.global.html file, and the component shows whatever ends
  up there between its form and its links.

  Dropping the slot, or moving it outside the element, does not fail loudly: a location nobody
  fills renders as nothing, and the component only keeps content that is its own child. The buttons
  would simply stop appearing. Nothing else in the codebase reads the names, so without this test
  nothing would notice.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const pages = {
  'app-public/login/index.page.html': { tag: 'k-login', slot: 'login-form-after', script: 'kempo/components/Login.js' },
  'app-public/register/index.page.html': { tag: 'k-register', slot: 'register-form-after', script: 'kempo/components/Register.js' },
};

export default Object.fromEntries(Object.entries(pages).map(([file, { tag, slot, script }]) => [
  `${file} keeps "${slot}" inside <${tag}> and loads the component`,
  async ({ pass, fail }) => {
    const markup = await readFile(path.join(root, file), 'utf8');

    const element = markup.match(new RegExp(`<${tag}(\\s[^>]*)?>([\\s\\S]*?)</${tag}>`));
    if(!element) return fail(`${file} has no <${tag}> element`);
    if(!new RegExp(`<location\\s+name="${slot}"[^>]*/?>`).test(element[2])) return fail(`${file}: <location name="${slot}" /> must be inside <${tag}> — the component only keeps its own children, so anywhere else the buttons vanish`);
    if(!markup.includes(script)) return fail(`${file} does not load ${script}, so <${tag}> would render nothing`);

    pass(`${slot} inside <${tag}>`);
  },
]));
