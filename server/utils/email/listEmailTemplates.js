import { readdir } from 'fs/promises';
import { defaultEmailsDir, isOwnerName, siteEmailsDir } from './emailTemplatePaths.js';
import readEmailTemplate from './readEmailTemplate.js';
import db from '../../db/index.js';
import { extension } from '../../db/schema.js';

const SUFFIX = '.page.html';

const namesIn = async dir => (await readdir(dir).catch(() => [])).filter(file => file.endsWith(SUFFIX)).map(file => file.slice(0, -SUFFIX.length));

/*
  The email templates of one extension (`owner`), or kempo's own and the site's (no owner): the packaged ones, and any the site has
  added. Resolves to [error, [{ template, name, title, overridden, packaged }]] sorted by name.
*/
const listEmailTemplates = async ({ owner = null } = {}) => {
  if(owner !== null && !isOwnerName(owner)) return [{ code: 400, msg: 'Invalid extension name' }, null];

  const names = [...new Set([...await namesIn(defaultEmailsDir(owner)), ...await namesIn(siteEmailsDir(owner))])].sort();
  const templates = [];
  for(const name of names){
    const [error, found] = await readEmailTemplate({ template: owner ? `${owner}/${name}` : name });
    if(!error) templates.push({ template: found.template, name, title: found.title, overridden: found.overridden, packaged: found.defaultSource !== null });
  }
  return [null, templates];
};

export default listEmailTemplates;

/*
  Every email template there is: kempo's own, then each enabled extension's, so an extension's templates can be edited the same way.
  Resolves to [error, [{ template, name, title, overridden, packaged }]].
*/
export const listEveryEmailTemplate = async () => {
  const [kempoError, own] = await listEmailTemplates({ owner: null });
  if(kempoError) return [kempoError, null];
  const owners = (await db.select({ name: extension.name, enabled: extension.enabled }).from(extension).catch(() => [])).filter(row => row.enabled).map(row => row.name);
  const others = await Promise.all(owners.map(async owner => (await listEmailTemplates({ owner }))[1] ?? []));
  return [null, [...own, ...others.flat()]];
};
