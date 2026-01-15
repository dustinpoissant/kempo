import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default async (request, response) => {
  const referer = request.headers.referer || '/';
  const refererUrl = new URL(referer, `http://${request.headers.host}`);
  const depth = refererUrl.pathname.split('/').filter(p => p).length;
  const pathToRoot = depth === 0 ? './' : '../'.repeat(depth);

  const template = await readFile(join(__dirname, '..', '..', 'templates', 'nav.html'), 'utf-8');
  const html = template.replace(/\{\{pathToRoot\}\}/g, pathToRoot);

  response.setHeader('Content-Type', 'text/html');
  response.send(html);
};
