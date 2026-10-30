import { readFile } from 'fs/promises';
import { locateTemplate, sameSource, titleOf } from './emailTemplatePaths.js';
import { splitFrontmatter } from './frontmatter.js';

const read = path => readFile(path, 'utf8').catch(() => null);

/*
  One email template as the site would send it: `source` is the body of the site's own version when it has one and the packaged one
  otherwise, without its frontmatter, which is never shown or edited. `variables` are the ones the frontmatter declares, and
  `defaultSource` the packaged body (null when there is none). `overridden` says the site's whole file differs from the packaged one.
  Resolves to [error, { template, owner, name, title, source, variables, defaultSource, overridden }].
*/
export default async ({ template } = {}) => {
  const located = locateTemplate(template);
  if(!located) return [{ code: 400, msg: 'Invalid email template name' }, null];

  const [site, packaged] = await Promise.all([read(located.sitePath), read(located.defaultPath)]);
  if(site === null && packaged === null) return [{ code: 404, msg: `Email template not found: ${template}` }, null];

  const source = site ?? packaged;
  const { body, variables } = splitFrontmatter(source);
  return [null, {
    template,
    owner: located.owner,
    name: located.name,
    title: titleOf(source),
    source: body,
    variables,
    defaultSource: packaged === null ? null : splitFrontmatter(packaged).body,
    overridden: site !== null && packaged !== null && !sameSource(site, packaged),
  }];
};
