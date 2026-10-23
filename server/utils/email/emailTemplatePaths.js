import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const PART = '[a-z0-9][a-z0-9-]*';
const NAME = new RegExp(`^(?:(${PART})/)?(${PART})$`);

/*
  Where an email template lives, the same places renderEmailTemplate looks:

    "owner/name"  the extension's own `node_modules/owner/emails/name.page.html`, which the site overrides at
                  `templates/emails/owner/name.page.html`
    "name"        kempo's own `app-templates/emails/name.page.html`, which the site overrides at
                  `templates/emails/name.page.html`
*/
export const parseTemplateName = template => {
  const match = typeof template === 'string' ? NAME.exec(template) : null;
  return match ? { owner: match[1] ?? null, name: match[2] } : null;
};

export const siteEmailsDir = owner => (owner ? join(process.cwd(), 'templates/emails', owner) : join(process.cwd(), 'templates/emails'));

export const defaultEmailsDir = owner => (owner ? join(process.cwd(), 'node_modules', owner, 'emails') : join(here, '../../../app-templates/emails'));

export const locateTemplate = template => {
  const parsed = parseTemplateName(template);
  if(!parsed) return null;
  return { ...parsed, template, sitePath: join(siteEmailsDir(parsed.owner), `${parsed.name}.page.html`), defaultPath: join(defaultEmailsDir(parsed.owner), `${parsed.name}.page.html`) };
};

export const isOwnerName = owner => new RegExp(`^${PART}$`).test(owner);

/* The page's `title`, which is what a list shows as the email's name. */
export const titleOf = source => /<page\b[^>]*\stitle="([^"]*)"/.exec(source)?.[1] ?? '';

export const sameSource = (a, b) => String(a).replace(/\r\n/g, '\n').trim() === String(b).replace(/\r\n/g, '\n').trim();
