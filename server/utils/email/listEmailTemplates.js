import { readdir } from 'fs/promises';
import { defaultEmailsDir, isOwnerName, siteEmailsDir } from './emailTemplatePaths.js';
import readEmailTemplate from './readEmailTemplate.js';

const SUFFIX = '.page.html';

const namesIn = async dir => (await readdir(dir).catch(() => [])).filter(file => file.endsWith(SUFFIX)).map(file => file.slice(0, -SUFFIX.length));

/*
  The email templates of one extension (`owner`), or kempo's own and the site's (no owner): the packaged ones, and any the site has
  added. Resolves to [error, [{ template, name, title, overridden, packaged }]] sorted by name.
*/
export default async ({ owner = null } = {}) => {
  if(owner !== null && !isOwnerName(owner)) return [{ code: 400, msg: 'Invalid extension name' }, null];

  const names = [...new Set([...await namesIn(defaultEmailsDir(owner)), ...await namesIn(siteEmailsDir(owner))])].sort();
  const templates = [];
  for(const name of names){
    const [error, found] = await readEmailTemplate({ template: owner ? `${owner}/${name}` : name });
    if(!error) templates.push({ template: found.template, name, title: found.title, overridden: found.overridden, packaged: found.defaultSource !== null });
  }
  return [null, templates];
};
