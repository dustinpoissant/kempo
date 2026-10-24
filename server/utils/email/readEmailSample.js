import { readFile } from 'fs/promises';
import { join } from 'path';
import { defaultEmailsDir, locateTemplate, siteEmailsDir } from './emailTemplatePaths.js';

/*
  The made-up values a template is previewed with: `<name>.sample.json` beside the template, in the site's
  `templates/emails` (which wins) or the packaged one. A template with none, or one whose file is not a JSON
  object, previews with no data, which is what it did before. Always resolves to an object.
*/
export default async ({ template } = {}) => {
  const located = locateTemplate(template);
  if(!located) return {};

  for(const dir of [siteEmailsDir(located.owner), defaultEmailsDir(located.owner)]){
    try {
      const sample = JSON.parse(await readFile(join(dir, `${located.name}.sample.json`), 'utf8'));
      if(sample && typeof sample === 'object' && !Array.isArray(sample)) return sample;
    } catch {
      /* no file here, or not JSON: try the next place */
    }
  }
  return {};
};
