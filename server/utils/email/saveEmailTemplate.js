import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { dirname } from 'path';
import { locateTemplate } from './emailTemplatePaths.js';
import renderEmailTemplate from './renderEmailTemplate.js';

const MAX_SOURCE = 100000;

/*
  The site's own version of an email template, written to `templates/emails/` so it is used from the next email on (the packaged
  one is never touched). Only a template that exists can be saved, so this cannot make up new names. The new version is rendered
  once before it is kept, and the old one is put back when it does not render, so a typo cannot stop the site sending that email.
  Resolves to [error, { template }].
*/
export default async ({ template, source } = {}) => {
  const located = locateTemplate(template);
  if(!located) return [{ code: 400, msg: 'Invalid email template name' }, null];
  if(typeof source !== 'string' || !source.trim()) return [{ code: 400, msg: 'The template cannot be empty' }, null];
  if(source.length > MAX_SOURCE) return [{ code: 400, msg: `The template can be at most ${MAX_SOURCE} characters` }, null];
  if(source.includes('\u0000')) return [{ code: 400, msg: 'The template cannot contain null characters' }, null];

  const [site, packaged] = await Promise.all([readFile(located.sitePath, 'utf8').catch(() => null), readFile(located.defaultPath, 'utf8').catch(() => null)]);
  if(site === null && packaged === null) return [{ code: 404, msg: `Email template not found: ${template}` }, null];

  try {
    await mkdir(dirname(located.sitePath), { recursive: true });
    await writeFile(located.sitePath, source);
  } catch {
    return [{ code: 500, msg: 'The template could not be saved' }, null];
  }

  const [renderError] = await renderEmailTemplate({ template, data: {} });
  if(renderError){
    if(site === null) await rm(located.sitePath, { force: true });
    else await writeFile(located.sitePath, site);
    return [{ code: 400, msg: `The template does not render, so it was not saved: ${renderError.msg}` }, null];
  }
  return [null, { template }];
};
