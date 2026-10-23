import { readFile } from 'fs/promises';
import { locateTemplate, sameSource, titleOf } from './emailTemplatePaths.js';

const read = path => readFile(path, 'utf8').catch(() => null);

/*
  One email template as the site would send it: `source` is the site's own version when it has one and the packaged one
  otherwise, `defaultSource` is the packaged one (null when there is none), and `overridden` says the site's differs from it.
  Resolves to [error, { template, owner, name, title, source, defaultSource, overridden }].
*/
export default async ({ template } = {}) => {
  const located = locateTemplate(template);
  if(!located) return [{ code: 400, msg: 'Invalid email template name' }, null];

  const [site, packaged] = await Promise.all([read(located.sitePath), read(located.defaultPath)]);
  if(site === null && packaged === null) return [{ code: 404, msg: `Email template not found: ${template}` }, null];

  const source = site ?? packaged;
  return [null, {
    template,
    owner: located.owner,
    name: located.name,
    title: titleOf(source),
    source,
    defaultSource: packaged,
    overridden: site !== null && packaged !== null && !sameSource(site, packaged),
  }];
};
