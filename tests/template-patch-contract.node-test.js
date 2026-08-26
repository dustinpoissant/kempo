import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

/*
  The scaffolded site template makes a promise to template patches, and this is what holds it.

  A *.template-patch.html targets one element by id, and an id that is absent is skipped rather than
  thrown — deliberately, so that a template changing out from under an extension does not take the
  page down with it. Which is exactly why this test exists: the failure is quiet. Renaming or
  removing `id="main"` does not break the site loudly, it just stops kempo-blog posts from getting
  their <article> wrapper, leaving a line in a server log as the only evidence.

  Nothing else in the codebase reads the attribute, so without this test nothing would notice.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const templates = {
  'app-public/default.template.html': 'the template scaffolded into every new site'
};

export default {
  'the scaffolded template keeps id="main" on its page body wrapper': async ({ pass, fail }) => {
    for(const [file, description] of Object.entries(templates)){
      const markup = await readFile(path.join(root, file), 'utf8');

      const main = markup.match(/<main(\s[^>]*)?>/);
      if(!main) return fail(`${file} (${description}) has no <main> element`);
      if(!/\bid\s*=\s*"main"/.test(main[0])){
        return fail(`${file} (${description}) must keep id="main" on its <main> — template patches target it by id and throw when it is absent, so dropping it breaks kempo-blog's post template at render time`);
      }

      /*
        The id is only useful on the element that actually wraps the page body: a patch replaces it
        wholesale and supplies its own <location />.
      */
      const wrapper = markup.match(/<main\s[^>]*id\s*=\s*"main"[^>]*>([\s\S]*?)<\/main>/);
      if(!wrapper) return fail(`${file}: could not read the <main id="main"> element's contents`);
      if(!/<location\s*\/>|<location\s*>/.test(wrapper[1])){
        return fail(`${file}: <main id="main"> no longer wraps the default <location /> — a patch replacing it would drop the page body`);
      }
    }
    pass();
  },

  'exactly one <main> exists, so a patch cannot target the wrong one': async ({ pass, fail }) => {
    for(const [file] of Object.entries(templates)){
      const markup = await readFile(path.join(root, file), 'utf8');
      const count = (markup.match(/<main(\s[^>]*)?>/g) || []).length;
      if(count !== 1) return fail(`${file} has ${count} <main> elements — kempo-blog's migration only adds id="main" when there is exactly one`);
    }
    pass();
  }
};
