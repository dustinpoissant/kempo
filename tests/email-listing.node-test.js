import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';

/* Every email template is listed, kempo's own included, so the Templates tab has rows to show. */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { listEveryEmailTemplate } = await import(pathToFileURL(path.join(root, 'server/utils/email/listEmailTemplates.js')).href);

export default {
  'every email template is listed, kempo\'s own among them': async ({ pass, fail }) => {
    const [error, templates] = await listEveryEmailTemplate();
    if(error) return fail(`the listing failed: ${error.msg}`);
    if(!templates.some(template => template.template === 'verify-email')) return fail(`verify-email is not listed: ${templates.map(t => t.template)}`);
    pass('');
  },
};
