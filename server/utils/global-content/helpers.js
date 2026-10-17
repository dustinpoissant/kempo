const GLOBAL_FILE = 'kempo-global.global.html';
const GLOBAL_DISABLED_FILE = 'kempo-global.global-disabled.html';

/*
  A quote or angle bracket inside an attribute would end the tag early, so they are written as
  entities and read back.
*/
const escapeAttr = value => String(value ?? '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const unescapeAttr = value => value.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

const KNOWN_ATTRIBUTES = ['id', 'name', 'owner', 'author', 'locked', 'location', 'priority', 'created', 'updated', 'menu', 'menu-locations', 'menu-copy', 'menu-nav-item'];

/*
  Attributes this code does not know about are kept in `extra` and written back unchanged, so a
  marker added by hand or by a newer version survives a save instead of being silently dropped.
*/
const parseEntries = raw => {
  const entries = [];
  const regex = /<content\s([^>]*)>([\s\S]*?)<\/content>/g;
  let match;
  while((match = regex.exec(raw)) !== null){
    const attrs = {};
    const attrRegex = /(\w[\w-]*)="([^"]*)"/g;
    let a;
    while((a = attrRegex.exec(match[1])) !== null) attrs[a[1]] = unescapeAttr(a[2]);
    entries.push({
      id: attrs.id || '',
      name: attrs.name || '',
      owner: attrs.owner || 'custom',
      author: attrs.author || '',
      locked: attrs.locked === 'true',
      menu: attrs.menu || '',
      menuLocations: attrs['menu-locations'] === undefined ? null : attrs['menu-locations'].split(',').map(l => l.trim()).filter(Boolean),
      menuCopyOf: attrs['menu-copy'] || '',
      navItem: attrs['menu-nav-item'] || '',
      location: attrs.location || 'default',
      priority: parseInt(attrs.priority || '0', 10),
      createdAt: attrs.created || '',
      updatedAt: attrs.updated || '',
      extra: Object.fromEntries(Object.entries(attrs).filter(([key]) => !KNOWN_ATTRIBUTES.includes(key))),
      markup: match[2].trim()
    });
  }
  return entries;
};

const serializeEntries = entries => entries.map(e => {
  const attrs = [
    `id="${e.id}"`,
    `name="${escapeAttr(e.name)}"`,
    `owner="${e.owner}"`,
    `author="${escapeAttr(e.author)}"`,
    `created="${e.createdAt}"`,
    `updated="${e.updatedAt}"`,
    `locked="${e.locked}"`,
    `location="${e.location}"`,
    `priority="${e.priority}"`,
    ...(e.menu ? [`menu="${e.menu}"`] : []),
    ...(e.menuLocations ? [`menu-locations="${e.menuLocations.join(',')}"`] : []),
    ...(e.menuCopyOf ? [`menu-copy="${e.menuCopyOf}"`] : []),
    ...(e.navItem ? [`menu-nav-item="${e.navItem}"`] : []),
    ...Object.entries(e.extra || {}).map(([key, value]) => `${key}="${escapeAttr(value)}"`)
  ].join(' ');
  return `<content ${attrs}>\n${e.markup}\n</content>`;
}).join('\n');

export { GLOBAL_FILE, GLOBAL_DISABLED_FILE, parseEntries, serializeEntries };
