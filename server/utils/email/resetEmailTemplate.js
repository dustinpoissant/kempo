import { readFile, rm } from 'fs/promises';
import { locateTemplate } from './emailTemplatePaths.js';

/* Removes the site's version of an email template so the packaged one is used again. Resolves to [error, { template }]. */
export default async ({ template } = {}) => {
  const located = locateTemplate(template);
  if(!located) return [{ code: 400, msg: 'Invalid email template name' }, null];
  if(await readFile(located.defaultPath, 'utf8').catch(() => null) === null) return [{ code: 409, msg: 'There is no packaged version to go back to' }, null];
  try {
    await rm(located.sitePath, { force: true });
    return [null, { template }];
  } catch {
    return [{ code: 500, msg: 'The template could not be reset' }, null];
  }
};
