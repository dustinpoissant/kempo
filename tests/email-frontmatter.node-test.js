import { splitFrontmatter, joinFrontmatter } from '../server/utils/email/frontmatter.js';

const source = '<!--\n\towner: kempo-forms\n\tvariables:\n\t\tname: The person\'s name.\n\t\temail: The address they gave.\n-->\n<page template="email" title="New">\n<p>{{name}}</p>\n';

export default {
  'the frontmatter is split from the body, with its owner and variables read': async ({ pass, fail }) => {
    const { body, owner, variables } = splitFrontmatter(source);
    if(body !== '<page template="email" title="New">\n<p>{{name}}</p>\n') return fail(`the body is ${JSON.stringify(body)}`);
    if(owner !== 'kempo-forms') return fail(`owner ${owner}`);
    if(JSON.stringify(variables) !== JSON.stringify([{ name: 'name', description: 'The person\'s name.' }, { name: 'email', description: 'The address they gave.' }])) return fail(JSON.stringify(variables));
    pass('');
  },

  'a template with no frontmatter has no variables and keeps its whole source': async ({ pass, fail }) => {
    const plain = splitFrontmatter('<page title="x">hi</page>');
    if(plain.frontmatter || plain.variables.length || plain.body !== '<page title="x">hi</page>') return fail(JSON.stringify(plain));
    pass('');
  },

  'the frontmatter put back is the one that was taken off': async ({ pass, fail }) => {
    const { frontmatter, body } = splitFrontmatter(source);
    const edited = body.replace('{{name}}', '{{name}}!');
    const rebuilt = joinFrontmatter(frontmatter, edited);
    if(splitFrontmatter(rebuilt).variables.length !== 2) return fail('the variables were lost');
    if(!rebuilt.includes('{{name}}!')) return fail('the edit was lost');
    if(rebuilt.indexOf('owner: kempo-forms') === -1) return fail('the owner was lost');
    pass('');
  },
};
