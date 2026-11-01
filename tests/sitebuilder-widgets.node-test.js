import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

/*
  The page builder's pure parts: the widget tree, attribute types, rendering, rebuilding a tree from HTML, comparing two
  pieces of HTML by meaning, the editor's tree operations and its undo history, and what the server accepts from the
  editor. None of it needs a database or a browser.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = async relative => (await import(pathToFileURL(path.join(root, relative)).href));

const { buildRegistry } = await load('src/kempo/sitebuilder/registry.js');
const { renderLocation, renderNodes, canContain, slotsOf, createRegistry } = await load('src/kempo/sitebuilder/render.js');
const nodes = await load('src/kempo/sitebuilder/nodes.js');
const { createNode } = nodes;
const ops = await load('src/kempo/sitebuilder/ops.js');
const History = (await load('src/kempo/sitebuilder/history.js')).default;
const { coerceAttribute, isDefaultValue } = await load('src/kempo/sitebuilder/attributes.js');
const { resolveEmbed } = await load('src/kempo/sitebuilder/embedProviders.js');
const { safeUrl, escapeAttribute } = await load('src/kempo/sitebuilder/html.js');
const coreWidgets = (await load('src/kempo/sitebuilder/widgets.js')).default;
const rebuild = (await load('server/utils/sitebuilder/rebuild.js')).default;
const { sameMeaning } = await load('server/utils/sitebuilder/normalize.js');
const { sanitizeMarkup, sanitizeText } = await load('server/utils/sitebuilder/sanitize.js');
const validateTree = (await load('server/utils/sitebuilder/validateTree.js')).default;
const { normalizeExtensionWidget } = await load('server/utils/sitebuilder/registry.js');
const { parsePageFile, composePageFile, hashFile } = await load('server/utils/sitebuilder/pageFile.js');

const registry = buildRegistry([]);
const ctx = { registry };

const expect = (condition, message) => {
  if(!condition) throw new Error(message);
};

const t = fn => async ({ pass, fail }) => {
  try {
    await fn();
    pass('');
  } catch(error) {
    fail(error.message);
  }
};

const roundTrip = html => {
  const [error, tree] = rebuild(html, registry);
  if(error) return { error: error.msg };
  return { tree, again: renderLocation(tree, ctx) };
};

const everyWidget = () => [
  createNode('markup', { html: '<h2>Hi</h2><p>Text {{name}} and <b>bold</b></p><ul><li>a</li></ul>' }),
  createNode('row', {}, { default: [createNode('column', { size: '7', stack: true }, { default: [createNode('button', { label: 'Go', href: '/x', color: 'primary' })] }), createNode('column', { stack: false }, { default: [createNode('image', { src: '/a.png', alt: 'A', width: 200 })] })] }),
  createNode('accordion', {}, { default: [createNode('accordion-item', { title: 'One' }, { default: [createNode('markup', { html: '<p>x</p>' })] }), createNode('accordion-item', { title: 'Two' })] }),
  createNode('tabs', {}, { default: [createNode('tab-item', { label: 'A' }, { default: [createNode('markup', { html: '<p>tab</p>' })] }), createNode('tab-item', { label: 'B' })] }),
  createNode('hero', { image: '/h.jpg', height: 'full', overlay: 60 }, { default: [createNode('markup', { html: '<h1>Hero</h1>' })] }),
  createNode('conditional', { condition: '!name' }, { default: [createNode('fragment', { name: 'nav' })] }),
  createNode('repeat', { in: 'lines', as: 'line' }, { default: [createNode('markup', { html: '<p>{{line}}</p>' })] }),
  createNode('location', { name: 'x' }),
  createNode('table', { header: true, rows: [['a', 'b'], ['c', 'd']] }),
  createNode('spacer', { size: 'large' }),
  createNode('spacer', { size: 'small' }),
  createNode('divider'),
  createNode('group', { element: 'section', padding: 'medium', background: 'alt', align: 'center', extraClass: 'foo bar' }, { default: [createNode('markup', { html: '<p>in group</p>' })] }),
  createNode('search', { action: '/find' }),
  createNode('audio', { src: '/a.mp3', loop: true }),
  createNode('file', { href: '/f.pdf', label: 'Get it' }),
  createNode('card', { label: 'Card' }, { default: [createNode('markup', { html: '<p>c</p>' })] }),
  createNode('content-slider', { loop: true, controls: false }, { default: [createNode('markup', { html: '<p>s1</p>' })] }),
  createNode('social-icons', { github: 'https://github.com/x' }),
  createNode('embed', { src: 'https://youtu.be/dQw4w9WgXcQ' }),
  createNode('video', { src: '/v.mp4' }),
  createNode('icon', { name: 'star' }),
  createNode('show-more', { opened: true }, { default: [createNode('markup', { html: '<p>m</p>' })] }),
  createNode('photo-viewer', { images: [{ src: '/p.png', alt: 'p' }, { src: '/q.png', alt: '' }, { src: '/r.png', alt: 'r' }], columns: '4' })
];

export default {
  /*
    Tree, attributes, html helpers
  */

  'a tree can be walked, found in, cloned with fresh ids, inserted into, and have widgets removed': t(() => {
    const tree = [createNode('group', {}, { default: [createNode('button', { label: 'A' })] }), createNode('divider')];
    const buttonId = tree[0].slots.default[0].id;
    expect(nodes.countNodes(tree) === 3, 'count');
    expect(nodes.maxDepth(tree) === 2, 'depth');
    const found = nodes.findNode(tree, buttonId);
    expect(found.parent.id === tree[0].id && found.slot === 'default' && found.index === 0, 'find');
    const copy = nodes.cloneNodes(tree, true);
    expect(copy[0].id !== tree[0].id && copy[0].slots.default[0].id !== buttonId, 'fresh ids');
    expect(copy[0].slots.default[0].attrs.label === 'A', 'attrs copied');
    expect(nodes.insertNode(tree, tree[0].id, 'default', 1, createNode('divider')), 'insert');
    expect(tree[0].slots.default.length === 2, 'inserted');
    expect(nodes.removeNode(tree, buttonId).type === 'button', 'remove');
    expect(nodes.findNode(tree, buttonId) === null, 'removed');
    expect(nodes.isInside(tree, tree[0].id, tree[0].slots.default[0].id), 'isInside');
  }),

  'attribute values are cleaned by their type': t(() => {
    expect(coerceAttribute({ type: 'boolean' }, 'true') === true && coerceAttribute({ type: 'boolean' }, 'no') === false, 'boolean');
    expect(coerceAttribute({ type: 'number', min: 1, max: 5 }, '9') === 5 && coerceAttribute({ type: 'number' }, 'abc') === '', 'number');
    expect(coerceAttribute({ type: 'url' }, 'javascript:alert(1)') === '' && coerceAttribute({ type: 'url' }, '/ok') === '/ok', 'url');
    expect(coerceAttribute({ type: 'image' }, '//evil.com/x.png') === '', 'protocol-relative address refused');
    expect(coerceAttribute({ type: 'select', default: 'a', options: [{ value: 'a' }, { value: 'b' }] }, 'zzz') === 'a', 'select');
    expect(isDefaultValue({ type: 'string' }, '') && isDefaultValue({ type: 'number', default: 40 }, 40) && !isDefaultValue({ type: 'number', default: 40 }, 41), 'default');
    expect(safeUrl('mailto:a@b.c') === 'mailto:a@b.c' && safeUrl('data:text/html,x') === '', 'safeUrl');
    expect(escapeAttribute('a"b<c') === 'a&quot;b&lt;c', 'escape');
  }),

  'only the providers embedProviders knows can be embedded': t(() => {
    expect(resolveEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ').src === 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', 'youtube');
    expect(resolveEmbed('https://youtu.be/dQw4w9WgXcQ').provider === 'YouTube', 'youtu.be');
    expect(resolveEmbed('https://vimeo.com/123456').src === 'https://player.vimeo.com/video/123456', 'vimeo');
    expect(resolveEmbed('https://open.spotify.com/track/abc123').src === 'https://open.spotify.com/embed/track/abc123', 'spotify');
    expect(resolveEmbed('https://evil.example/embed') === null && resolveEmbed('javascript:alert(1)') === null && resolveEmbed('') === null, 'others refused');
  }),

  'a video embed gets the playback options as the provider\'s own parameters': t(() => {
    const youtube = resolveEmbed('https://youtu.be/dQw4w9WgXcQ', { autoplay: true, loop: true, controls: false }).src;
    expect(youtube === 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&mute=1&loop=1&playlist=dQw4w9WgXcQ&controls=0', youtube);
    expect(resolveEmbed('https://vimeo.com/123456', { muted: true }).src === 'https://player.vimeo.com/video/123456?muted=1', 'vimeo muted');
    expect(resolveEmbed('https://youtu.be/dQw4w9WgXcQ', { controls: true }).src === 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', 'nothing asked, nothing added');
  }),

  'a video has its playback and size options, written as attributes and read back': t(() => {
    const attrs = { src: '/v.mp4', poster: '/p.jpg', width: 640, align: 'center', ratio: '9/16', fit: 'cover', controls: 'full', skip: 5, hideAfter: 6, autoplay: true, loop: true, muted: true, remember: true, preload: 'auto' };
    const html = renderLocation([createNode('video', attrs)], ctx);
    expect(html.includes('controls="full"') && html.includes('hide-after="6"') && html.includes('ratio="9/16"') && html.includes(' autoplay') && html.includes(' remember'), html);
    const { tree, again } = roundTrip(html);
    expect(tree[0].type === 'video' && Object.entries(attrs).every(([name, value]) => tree[0].attrs[name] === value) && sameMeaning(html, again), JSON.stringify(tree));
    expect(renderLocation([createNode('video', { src: '/v.mp4' })], ctx).startsWith('<k-video-player src="/v.mp4"></k-video-player>'), 'defaults are not written');
    const [, cleaned] = validateTree([{ id: 'v', type: 'video', attrs: { src: '/v.mp4', controls: 'evil', ratio: '5/5', align: 'up', preload: 'x' }, slots: {} }], registry);
    expect(cleaned[0].attrs.controls === 'normal' && cleaned[0].attrs.ratio === '' && cleaned[0].attrs.align === 'left' && cleaned[0].attrs.preload === 'metadata', JSON.stringify(cleaned[0].attrs));
  }),

  /*
    Rendering and rebuilding
  */

  'every widget kempo ships renders, rebuilds from that HTML, and renders the same again': t(() => {
    const original = everyWidget();
    const html = renderLocation(original, ctx);
    const { error, tree, again } = roundTrip(html);
    expect(!error, error);
    expect(tree.map(node => node.type).join() === original.map(node => node.type).join(), `types: ${tree.map(node => node.type)}`);
    expect(sameMeaning(html, again), `render changed:\n${html}\n---\n${again}`);
  }),

  'only what differs from a default is written to the page': t(() => {
    const html = renderNodes([createNode('hero', { image: '', height: 'tall', overlay: 40 })], ctx);
    expect(html === '<k-hero></k-hero>', html);
    expect(renderNodes([createNode('image', { src: '/a.png', alt: '' })], ctx) === '<img src="/a.png">', 'empty alt is left out');
  }),

  'the page-side scripts of the widgets a page uses are written once each, and are not read back as content': t(() => {
    const html = renderLocation([createNode('hero'), createNode('hero')], ctx);
    expect((html.match(/<script/g) || []).length === 1 && html.includes('/kempo/components/Hero.js'), html);
    const { error, tree } = roundTrip(html);
    expect(!error && tree.length === 2, error || 'wrong count');
    expect(renderLocation([createNode('markup', { html: '<p>x</p>' }), createNode('divider')], ctx).includes('<script') === false, 'primitives load nothing');
  }),

  'the editor version marks every widget and shows the server tags as placeholders': t(() => {
    const html = renderNodes([createNode('fragment', { name: 'nav' }), createNode('button', { label: 'Go' })], { registry, editor: true });
    expect(!html.includes('<fragment') && html.includes('data-sb-label="Fragment"'), 'fragment placeholder');
    expect(/data-sb-id="[^"]+" data-sb-edit="label"/.test(html), 'button editable');
  }),

  'hand-written pages become widgets where they can, with unrecognised classes kept': t(() => {
    const { tree, again, error } = roundTrip('<section class="p bg-alt custom"><h2>Title</h2><p>Text</p></section>');
    expect(!error, error);
    expect(tree[0].type === 'group' && tree[0].attrs.element === 'section' && tree[0].attrs.padding === 'medium' && tree[0].attrs.background === 'alt', JSON.stringify(tree[0].attrs));
    expect(tree[0].attrs.extraClass === 'custom' && tree[0].slots.default[0].type === 'markup', 'children and class');
    expect(sameMeaning('<section class="custom p bg-alt"><h2>Title</h2><p>Text</p></section>', again), again);
  }),

  'loose text and inline tags between widgets become Markup, and adjacent text blocks are one Markup': t(() => {
    const { tree, error } = roundTrip('Hello <em>there</em><div class="ta-center"><a class="btn primary" href="/a">Go</a></div><p>One</p><p>Two</p><ul><li>x</li></ul>');
    expect(!error, error);
    expect(tree.map(node => node.type).join() === 'markup,group,markup', tree.map(node => node.type).join());
    expect(tree[2].attrs.html.includes('<p>One</p>') && tree[2].attrs.html.includes('<ul>'), 'one run');
  }),

  'a tag nothing knows is kept as an unknown widget, exactly as written': t(() => {
    const html = '<k-mystery a="1" onclick="x()"><p>inside</p></k-mystery>';
    const { tree, again, error } = roundTrip(html);
    expect(!error && tree[0].type === 'unknown' && tree[0].attrs.tag === 'k-mystery' && tree[0].attrs.html === html, error || JSON.stringify(tree));
    expect(again === html, 'written back exactly');
  }),

  'a page the builder cannot represent is refused with the reason': t(() => {
    for(const [html, word] of [['<p>x</p><script>alert(1)</script>', 'script'], ['<iframe src="/x"></iframe>', 'iframe'], ['<style>p{}</style>', 'style'], ['<blink>x</blink>', 'blink']]){
      const [error] = rebuild(html, registry);
      expect(error && error.msg.includes(word), `${html} -> ${error?.msg}`);
    }
  }),

  'what the rebuild would drop shows up when the tree is rendered back, so the page is not rebuilt': t(() => {
    const html = '<div style="color:red"><p>x</p></div>';
    const { again, error } = roundTrip(html);
    expect(!error, error);
    expect(!sameMeaning(html, again), 'inline style was not noticed as lost');
    const unsafe = '<p onclick="x()">hi</p>';
    expect(!sameMeaning(unsafe, sanitizeMarkup(unsafe)), 'the sanitizer would change this, so it must be noticed');
  }),

  'a row is read with its column widths, an odd row as a group, and spacers as their sizes': t(() => {
    const { tree, again } = roundTrip('<div class="row"><div class="span-3 m-span-12"><p>a</p></div><div class="col"><p>b</p></div><div class="span-4"><p>c</p></div></div>');
    const columns = tree[0].slots.default;
    expect(tree[0].type === 'row' && columns.map(column => `${column.attrs.size || 'fill'}:${column.attrs.stack}`).join() === '3:true,fill:false,4:false', JSON.stringify(columns.map(column => column.attrs)));
    expect(sameMeaning('<div class="row"><div class="span-3 m-span-12"><p>a</p></div><div class="col"><p>b</p></div><div class="span-4"><p>c</p></div></div>', again), again);
    expect(roundTrip('<div class="row"><div><p>a</p></div></div>').tree[0].type === 'group', 'a column that is not a column class');
    expect(roundTrip('<div class="row"><div class="span-3 span-4"><p>a</p></div></div>').tree[0].type === 'group', 'two sizes');
    expect(roundTrip('<div class="py"><div class="py"></div></div>').tree[0].attrs.size === 'large', 'large spacer');
    expect(roundTrip('<div class="py"><p>text</p></div>').tree[0].type === 'group', 'padding with content is a group');
  }),

  'the server template tags become server widgets and keep what is inside them': t(() => {
    const { tree, error } = roundTrip('<if condition="name"><p>Hi {{name}}</p></if><foreach in="rows" as="row"><p>{{row}}</p></foreach><fragment name="footer" /><location name="extra" /><location />');
    expect(!error, error);
    expect(tree.map(node => node.type).join() === 'conditional,repeat,fragment,location,location', tree.map(node => node.type).join());
    expect(tree[0].slots.default[0].attrs.html.includes('{{name}}'), 'variables kept');
    expect(tree[4].attrs.name === '', 'default location');
  }),

  'accordion sections and tabs are read as pairs of elements': t(() => {
    const { tree, error } = roundTrip('<k-accordion><k-accordion-header for-panel="panel-1">A</k-accordion-header><k-accordion-panel name="panel-1"><p>x</p></k-accordion-panel></k-accordion>');
    expect(!error && tree[0].slots.default[0].attrs.title === 'A', error || JSON.stringify(tree));
    const [bad] = rebuild('<k-accordion><k-accordion-header for-panel="a">A</k-accordion-header><k-accordion-panel name="b"></k-accordion-panel></k-accordion>', registry);
    expect(bad, 'a header and a panel that do not match were accepted');
  }),

  'tables rebuild from rows of text, with or without a heading row': t(() => {
    const { tree } = roundTrip('<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>');
    expect(tree[0].attrs.header === true && tree[0].attrs.rows[1][1] === '2', JSON.stringify(tree[0].attrs));
    const headless = roundTrip('<table><tbody><tr><td>1</td></tr></tbody></table>').tree[0];
    expect(headless.attrs.header === false, 'no heading row');
  }),

  'nesting deeper than 100 levels is refused': t(() => {
    let html = '<p>x</p>';
    for(let index = 0; index < 105; index++) html = `<section>${html}</section>`;
    const [error] = rebuild(html, registry);
    expect(error && /deeply/.test(error.msg), error?.msg);
  }),

  /*
    Meaning
  */

  'two pieces of HTML mean the same when only whitespace, attribute order or quote style differ': t(() => {
    expect(sameMeaning('<p>     hello world</p>', '<p> hello world</p>'), 'leading space');
    expect(sameMeaning('<a href="/x" class="btn primary">Go</a>', "<a class='primary btn' href=/x>Go</a>"), 'order and quotes');
    expect(sameMeaning('<div>\n  <p>a</p>\n  <p>b</p>\n</div>', '<div><p>a</p><p>b</p></div>'), 'indentation');
    expect(sameMeaning('<p>a <b>b</b> c</p>', '<p>a   <b>b</b>   c</p>'), 'inline spacing collapses');
    expect(sameMeaning('<!-- note --><p>x</p>', '<p>x</p>'), 'comments');
  }),

  'whitespace that changes how a page looks is kept': t(() => {
    expect(!sameMeaning('<p>a<b>b</b></p>', '<p>a <b>b</b></p>'), 'a space before an inline tag');
    expect(!sameMeaning('<pre>a  b</pre>', '<pre>a b</pre>'), 'preformatted text');
    expect(!sameMeaning('<p>a</p>', '<p>b</p>') && !sameMeaning('<p class="a">x</p>', '<p class="b">x</p>'), 'real differences');
  }),

  /*
    Sanitizing and validating
  */

  'rich text keeps formatting and loses everything that can run': t(() => {
    const clean = sanitizeMarkup('<p onclick="x()">Hi <b>there</b> <a href="javascript:alert(1)">bad</a> <a href="https://ok.example" target="_blank">ok</a><script>alert(1)</script><iframe src="/x"></iframe><img src="/a.png" onerror="x()"> {{name}}</p>');
    expect(!/onclick|script|iframe|javascript:|onerror/.test(clean), clean);
    expect(clean.includes('<b>there</b>') && clean.includes('{{name}}') && clean.includes('rel="noopener noreferrer"'), clean);
    expect(sanitizeText('<b>bold</b> & more') === 'bold & more', 'text');
  }),

  'what the editor sends is checked: unknown widgets, attributes, places and depth': t(() => {
    const [unknownError] = validateTree([{ id: 'a', type: 'nope', attrs: {}, slots: {} }], registry);
    expect(unknownError && /Unknown widget/.test(unknownError.msg), 'unknown type');
    const [placeError] = validateTree([{ id: 'a', type: 'accordion-item', attrs: {}, slots: {} }], registry);
    expect(placeError && /cannot go there/.test(placeError.msg), 'a section outside an accordion');
    const [, cleaned] = validateTree([{ id: 'ok', type: 'button', attrs: { label: 'Go', href: 'javascript:alert(1)', color: 'evil', onclick: 'x()' }, slots: {} }], registry);
    expect(cleaned[0].attrs.href === '' && cleaned[0].attrs.color === 'primary' === false && !('onclick' in cleaned[0].attrs), JSON.stringify(cleaned[0].attrs));
    expect(cleaned[0].attrs.color === '' , 'select value outside its options falls back to the default');
    const [, markup] = validateTree([{ id: 'm', type: 'markup', attrs: { html: '<p>x</p><script>alert(1)</script>' }, slots: {} }], registry);
    expect(!markup[0].attrs.html.includes('script'), 'markup cleaned');
    const [, embed] = validateTree([{ id: 'e', type: 'embed', attrs: { src: 'https://evil.example/x' }, slots: {} }], registry);
    expect(embed[0].attrs.src === '', 'embed address outside the providers is dropped');
    const [, repeat] = validateTree([{ id: 'r', type: 'repeat', attrs: { in: 'a b;c', as: 'x y' }, slots: {} }], registry);
    expect(repeat[0].attrs.in === '' && repeat[0].attrs.as === 'item', 'server widget values are strict');
    let deep = { id: 'leaf', type: 'group', attrs: {}, slots: {} };
    for(let index = 0; index < 100; index++) deep = { id: `g${index}`, type: 'group', attrs: {}, slots: { default: [deep] } };
    const [depthError] = validateTree([deep], registry);
    expect(depthError && /deep/.test(depthError.msg), 'depth 101 refused');
  }),

  'an unknown widget keeps its markup only when the page already had it': t(() => {
    const html = '<k-mystery a="1"><p>x</p></k-mystery>';
    const [, kept] = validateTree([{ id: 'u', type: 'unknown', attrs: { tag: 'k-mystery', html }, slots: {} }], registry, { preserved: new Set([html]) });
    expect(kept[0].attrs.html === html, 'preserved');
    const [, authored] = validateTree([{ id: 'u', type: 'unknown', attrs: { tag: 'k-x', html: '<k-x onclick="x()"></k-x><script>1</script>' }, slots: {} }], registry);
    expect(!/script|onclick/.test(authored[0].attrs.html), authored[0].attrs.html);
  }),

  'duplicate or malformed ids from the editor are replaced': t(() => {
    const [, cleaned] = validateTree([{ id: 'same', type: 'divider', attrs: {}, slots: {} }, { id: 'same', type: 'divider', attrs: {}, slots: {} }, { id: 'bad id!', type: 'divider', attrs: {}, slots: {} }], registry);
    expect(new Set(cleaned.map(node => node.id)).size === 3, 'ids not unique');
  }),

  /*
    Widgets declared by extensions
  */

  'an extension widget declaration is checked and namespaced': t(() => {
    const [error, widget] = normalizeExtensionWidget('my-ext', { key: 'banner', title: 'Banner', tag: 'my-banner', page_component: '/my-ext/Banner.js', attributes: [{ name: 'message', type: 'string', label: 'Message', default: 'Hi' }], slots: [{ name: 'default' }] });
    expect(!error && widget.key === 'my-ext:banner' && widget.owner === 'my-ext', error?.msg);
    for(const bad of [{ title: 'x', tag: 'my-x' }, { key: 'a', tag: 'my-x' }, { key: 'a', title: 'x', tag: 'Bad Tag' }, { key: 'a', title: 'x', tag: 'my-x' }, { key: 'a', title: 'x', tag: 'my-x', page_component: 'relative.js' }, { key: 'a', title: 'x', tag: 'my-x', page_component: '/x.js', attributes: [{ name: 'bad name' }] }]){
      expect(normalizeExtensionWidget('e', bad)[0], `accepted ${JSON.stringify(bad)}`);
    }
    const [, primitive] = normalizeExtensionWidget('e', { key: 'rule', title: 'Rule', tag: 'hr' });
    expect(primitive.tag === 'hr' && !primitive.page_component, 'primitive widget needs no component');
  }),

  'an extension widget renders as its tag with its attributes, and is read back by its tag': t(() => {
    const [, widget] = normalizeExtensionWidget('my-ext', {
      key: 'banner', title: 'Banner', tag: 'my-banner', page_component: '/my-ext/Banner.js',
      attributes: [{ name: 'message', type: 'string', default: 'Hi' }, { name: 'tone', type: 'select', default: 'info', options: [{ value: 'info' }, { value: 'warn' }] }, { name: 'dismissable', type: 'boolean' }],
      slots: [{ name: 'default' }, { name: 'footer' }]
    });
    const extended = buildRegistry([widget]);
    const tree = [createNode('my-ext:banner', { message: 'Careful', tone: 'warn', dismissable: true }, { default: [createNode('markup', { html: '<p>body</p>' })], footer: [createNode('button', { label: 'OK' })] })];
    const html = renderLocation(tree, { registry: extended });
    expect(html.includes('<my-banner message="Careful" tone="warn" dismissable>') && html.includes('slot="footer"') && html.includes('/my-ext/Banner.js'), html);
    const [error, back] = rebuild(html, extended);
    expect(!error && back[0].type === 'my-ext:banner' && back[0].attrs.tone === 'warn' && back[0].attrs.dismissable === true, error?.msg || JSON.stringify(back));
    expect(back[0].slots.footer[0].type === 'button' && back[0].slots.default[0].type === 'markup', 'slots read back');
    expect(sameMeaning(html, renderLocation(back, { registry: extended })), 'second render differs');
  }),

  /*
    The editor's operations
  */

  'adding places a widget after the target, into an empty container, or next to the nearest parent that takes it': t(() => {
    const tree = [createNode('group', {}, { default: [] }), createNode('accordion', {}, { default: [createNode('accordion-item', {}, { default: [createNode('divider')] })] })];
    const first = ops.addWidget(tree, registry, 'button', { targetId: tree[0].id });
    expect(first.id && tree.length === 2 && tree[0].slots.default[0].type === 'button', 'inside a container that is empty');
    const after = ops.addWidget(tree, registry, 'divider', { targetId: tree[0].id });
    expect(after.id && tree[1].type === 'divider', 'after a container that has something in it');
    const inside = ops.addWidget(tree, registry, 'spacer', { targetId: tree[0].id, inside: true });
    expect(inside.id && tree[0].slots.default[1].type === 'spacer', 'inside a container when asked');
    const climbs = ops.addWidget(tree, registry, 'button', { targetId: tree[2].slots.default[0].id });
    expect(climbs.id && tree[3].type === 'button', 'a section only holds sections, so it goes beside the accordion');
    const refused = ops.addWidget(tree, registry, 'accordion-item', {});
    expect(refused.error, 'a section cannot go at the top');
  }),

  'new accordions and tabs start with the sections they need': t(() => {
    expect(ops.defaultNode(registry, 'accordion').slots.default.length === 1, 'accordion');
    expect(ops.defaultNode(registry, 'tabs').slots.default.length === 2, 'tabs');
    expect(ops.defaultNode(registry, 'table').attrs.rows.length === 2, 'table');
    expect(ops.defaultNode(registry, 'hero').attrs.height === 'tall', 'defaults applied');
  }),

  'widgets move up, down, in and out, and the edges are respected': t(() => {
    const [a, b, c] = [createNode('divider'), createNode('divider'), createNode('divider')];
    const tree = [a, b, c, createNode('group')];
    expect(ops.moveBy(tree, registry, [a.id], 1) === true && tree[1] === a, 'down');
    expect(ops.moveBy(tree, registry, [b.id], -1) === 'Already first', 'first stays first');
    expect(ops.moveBy(tree, registry, [tree[3].id], 1) === 'Already last', 'last stays last');
    const group = createNode('group');
    const last = createNode('divider');
    const nest = [group, last];
    expect(ops.moveIn(nest, registry, last.id) === true && group.slots.default[0] === last && nest.length === 1, 'in');
    expect(typeof ops.moveIn(nest, registry, group.id) === 'string', 'nothing before the first widget to move into');
    expect(ops.moveOut(nest, registry, last.id) === true && nest[1] === last, 'out puts it just after its parent');
    expect(ops.moveOut(nest, registry, last.id) === 'Already at the top', 'the top level cannot move out');
  }),

  'a widget cannot be moved inside itself, and a refused move changes nothing': t(() => {
    const inner = createNode('group');
    const outer = createNode('group', {}, { default: [inner] });
    const tree = [outer, createNode('accordion', {}, { default: [] })];
    expect(typeof ops.moveWidget(tree, registry, outer.id, inner.id, 'default', 0) === 'string', 'into itself');
    expect(typeof ops.moveWidget(tree, registry, inner.id, tree[1].id, 'default', 0) === 'string', 'a group in an accordion');
    expect(outer.slots.default[0] === inner, 'the move that failed left the tree alone');
  }),

  'duplicating copies a widget with its children and new ids, and multi-select needs one parent': t(() => {
    const button = createNode('button', { label: 'A' });
    const tree = [createNode('group', {}, { default: [button] }), createNode('divider')];
    const result = ops.duplicateWidgets(tree, [tree[0].id]);
    expect(result.ids.length === 1 && tree.length === 3, 'copied');
    expect(tree[1].slots.default[0].attrs.label === 'A' && tree[1].slots.default[0].id !== button.id, 'children copied with new ids');
    expect(ops.sharePlace(tree, [tree[0].id, tree[2].id]) && !ops.sharePlace(tree, [tree[0].id, button.id]), 'sharePlace');
  }),

  'a widget can declare its own settings component, with its tag, and the two come together': t(() => {
    const base = { key: 'thing', title: 'Thing', tag: 'my-thing', page_component: '/p/thing.js' };
    const [, widget] = normalizeExtensionWidget('ext', { ...base, settings_component: '/p/ThingSettings.js', settings_tag: 'my-thing-settings' });
    expect(widget.settings_component === '/p/ThingSettings.js' && widget.settings_tag === 'my-thing-settings', JSON.stringify(widget));
    expect(normalizeExtensionWidget('ext', { ...base, settings_component: '/p/ThingSettings.js' })[0].code === 400, 'a component needs its tag');
    expect(normalizeExtensionWidget('ext', { ...base, settings_component: 'https://x.test/a.js', settings_tag: 'my-thing-settings' })[0].code === 400, 'a path on this site');
    expect(registry.get('content-slider').settings_tag === 'k-content-slider-settings', 'the Content slider has its own settings');
    const slider = createNode('content-slider');
    const tree = [slider];
    expect(!ops.addWidget(tree, registry, 'group', { targetId: slider.id, inside: true, slot: 'default' }).error && slider.slots.default.length === 1 && slider.slots.default[0].type === 'group', 'a slide is added inside the slider');
  }),

  'an image can have a shape, a fit and corners, written as a style and a class and read back': t(() => {
    const html = renderLocation([createNode('image', { src: '/a.png', alt: 'A', width: 300, ratio: '16/9', fit: 'contain', rounded: 'small' })], ctx);
    expect(html.includes('style="aspect-ratio: 16 / 9; object-fit: contain"') && html.includes('class="r"') && html.includes('width="300"'), html);
    const { tree, again } = roundTrip(html);
    expect(tree[0].type === 'image' && tree[0].attrs.ratio === '16/9' && tree[0].attrs.fit === 'contain' && tree[0].attrs.rounded === 'small' && sameMeaning(html, again), JSON.stringify(tree));
    expect(!renderLocation([createNode('image', { src: '/a.png', ratio: 'bogus', rounded: 'x' })], ctx).includes('style='), 'an unknown shape is not written');
    expect(renderLocation([createNode('image', { src: '/a.png', ratio: '1/1', rounded: 'round' })], ctx).includes('class="round"'), 'a circle');
    const [, cleaned] = validateTree([{ id: 'i', type: 'image', attrs: { src: '/a.png', ratio: '9/9', rounded: 'evil' }, slots: {} }], registry);
    expect(cleaned[0].attrs.ratio === '' && cleaned[0].attrs.rounded === '', JSON.stringify(cleaned[0].attrs));
  }),

  'a full width image gets the full class instead of a width and is read back': t(() => {
    const html = renderLocation([createNode('image', { src: '/a.png', alt: 'A', width: 300, full: true, ratio: '16/9', rounded: 'small' })], ctx);
    expect(html.includes('class="full r"') && !html.includes('width='), html);
    const { tree, again } = roundTrip(html);
    expect(tree[0].type === 'image' && tree[0].attrs.full === true && tree[0].attrs.rounded === 'small' && sameMeaning(html, again), JSON.stringify(tree));
  }),

  'a link button can open in a new tab, which is read back': t(() => {
    const html = renderLocation([createNode('button', { href: '/go', label: 'Go', newTab: true })], ctx);
    expect(html.includes('target="_blank" rel="noopener"'), html);
    const { tree, again } = roundTrip(html);
    expect(tree[0].attrs.newTab === true && sameMeaning(html, again), JSON.stringify(tree));
    expect(!renderLocation([createNode('button', { href: '/go', label: 'Go' })], ctx).includes('target'), 'by default it does not');
  }),

  'a row takes a layout: columns are added or removed and nothing in a removed column is lost': t(() => {
    const row = ops.defaultNode(registry, 'row');
    row.slots.default[1].slots.default = [createNode('divider')];
    ops.setColumnLayout(registry, row, ['4', '4', '4']);
    expect(row.slots.default.map(column => column.attrs.size).join() === '4,4,4', 'three thirds');
    row.slots.default[2].slots.default = [createNode('divider')];
    ops.setColumnLayout(registry, row, ['', '8']);
    expect(row.slots.default.length === 2 && row.slots.default[0].attrs.size === undefined && row.slots.default[1].attrs.size === '8', JSON.stringify(row.slots.default.map(column => column.attrs)));
    expect(row.slots.default[1].slots.default.length === 2, 'the content of the removed column is in the last one');
    ops.setColumnLayout(registry, row, ['']);
    expect(row.slots.default.length === 1 && row.slots.default[0].slots.default.length === 2, 'one column holds everything');
  }),

  'the widgets that have their own settings declare a component and a tag for it': t(() => {
    const withSettings = ['image', 'button', 'hero', 'accordion', 'tabs', 'row', 'column', 'content-slider'];
    for(const key of withSettings){
      const definition = registry.get(key);
      expect(definition.settings_tag && definition.settings_tag.startsWith('k-') && /^\/kempo\/sitebuilder\/components\/\w+Settings\.js$/.test(definition.settings_component), key);
    }
  }),

  'a photo viewer is one picture, or a gallery of them that is read back with its pictures and row size': t(() => {
    const one = renderLocation([createNode('photo-viewer', { images: [{ src: '/a.png', alt: 'A' }] })], ctx);
    expect(one.startsWith('<k-photo-viewer src="/a.png" alt="A"></k-photo-viewer>'), one);
    const gallery = renderLocation([createNode('photo-viewer', { images: [{ src: '/a.png', alt: 'A' }, { src: '/b.png' }], columns: '2' })], ctx);
    expect(gallery.startsWith('<div class="row">') && gallery.includes('<k-photo-viewer src="/a.png" alt="A" class="span-6 m-span-6 pq">') && gallery.includes('<k-photo-viewer src="/b.png" class="span-6 m-span-6 pq">'), gallery);
    const back = roundTrip(gallery);
    expect(back.tree[0].type === 'photo-viewer' && back.tree[0].attrs.images.length === 2 && back.tree[0].attrs.columns === '2' && sameMeaning(gallery, back.again), JSON.stringify(back.tree));
    const single = roundTrip(one);
    expect(single.tree[0].attrs.images[0].src === '/a.png' && sameMeaning(one, single.again), JSON.stringify(single.tree));
    const [, cleaned] = validateTree([{ id: 'p', type: 'photo-viewer', attrs: { images: [{ src: 'javascript:alert(1)', alt: 'x' }, { src: '/ok.png', alt: '<b>y</b>' }] }, slots: {} }], registry);
    expect(cleaned[0].attrs.images.length === 1 && cleaned[0].attrs.images[0].src === '/ok.png' && !cleaned[0].attrs.images[0].alt.includes('<'), JSON.stringify(cleaned[0].attrs));
    expect(roundTrip('<div class="row"><div class="col"><p>a</p></div></div>').tree[0].type === 'row', 'a row of columns is still a row');
  }),

  'a button is a link, or a real button with an ID that a script can find': t(() => {
    const html = renderLocation([createNode('button', { kind: 'button', id: 'buy', label: 'Buy', color: 'primary' })], ctx);
    expect(html === '<button type="button" id="buy" class="primary">Buy</button>', html);
    const { tree, again } = roundTrip(html);
    expect(tree[0].type === 'button' && tree[0].attrs.kind === 'button' && tree[0].attrs.id === 'buy' && sameMeaning(html, again), JSON.stringify(tree));
    expect(renderNodes([createNode('button', { kind: 'button', id: 'x' })], { registry, editor: true }).startsWith('<a class="btn"'), 'the editor draws a real button as a link look-alike so its text can be edited');
    expect(!renderLocation([createNode('button', { href: '/a', id: 'x' })], ctx).includes('id='), 'a link has no id');
    const [, cleaned] = validateTree([{ id: 'b', type: 'button', attrs: { kind: 'button', id: 'bad id!"', label: 'Go' }, slots: {} }], registry);
    expect(cleaned[0].attrs.id === 'badid', JSON.stringify(cleaned[0].attrs));
  }),

  'a row holds only columns, as many as are added, and a column renders its width': t(() => {
    const row = ops.defaultNode(registry, 'row');
    expect(row.slots.default.length === 2 && row.slots.default.every(column => column.type === 'column'), 'a new row has two columns');
    expect(canContain(registry, row, 'default', 'column') && !canContain(registry, row, 'default', 'button'), 'a row takes columns');
    expect(!canContain(registry, null, '', 'column') && canContain(registry, null, '', 'row'), 'a column only goes in a row');
    expect(canContain(registry, row.slots.default[0], 'default', 'row'), 'a row can go in a column');
    const html = renderLocation([createNode('row', {}, { default: [createNode('column', { size: '4' }), createNode('column', {}), createNode('column', { size: '8', stack: false })] })], ctx);
    expect(html.includes('<div class="span-4 m-span-12">') && html.includes('<div class="col m-span-12">') && html.includes('<div class="span-8">'), html);
    expect(slotsOf(registry.get('row')).length === 1, 'one slot');
    const page = [row];
    expect(!ops.addWidget(page, registry, 'column', { targetId: row.id }).error && row.slots.default.length === 3, 'adding a column with the row selected puts it in the row');
    expect(!ops.addWidget(page, registry, 'column', { targetId: row.slots.default[0].id }).error && row.slots.default.length === 4 && row.slots.default[1].type === 'column', 'adding a column with a column selected puts it after that one');
    expect(ops.addWidget(page, registry, 'column', {}).error, 'a column cannot go on the page itself');
  }),

  'what can go where: slots accept some widgets, and a section only goes in its parent': t(() => {
    const accordion = createNode('accordion');
    expect(canContain(registry, accordion, 'default', 'accordion-item') && !canContain(registry, accordion, 'default', 'button'), 'accordion');
    expect(!canContain(registry, null, '', 'accordion-item') && canContain(registry, null, '', 'button'), 'top level');
    expect(!canContain(registry, createNode('button'), 'default', 'divider'), 'a button has no slot');
  }),

  'undo and redo keep at most 50 steps and clear the redo steps on a new change': t(() => {
    const history = new History();
    const state = { n: 0 };
    for(let step = 0; step < 60; step++){
      history.push(state);
      state.n = step + 1;
    }
    expect(history.size === 50, `size ${history.size}`);
    let current = { ...state };
    for(let step = 0; step < 50; step++) current = history.undo(current);
    expect(current.n === 10 && !history.canUndo && history.canRedo, `reached ${current.n}`);
    current = history.redo(current);
    expect(current.n === 11, 'redo');
    history.push(current);
    expect(!history.canRedo, 'a new change clears redo');
    expect(history.undo({ n: 99 }).n === 11, 'undo gives back the state before the change');
  }),

  /*
    Page files
  */

  'a page file splits into its parts and goes back together, keeping the extra <page> attributes': t(() => {
    const raw = '<!--\n  owner: custom\n  name: Test\n-->\n<page template="split" title="Hi" status="published" public="true">\n<content>\n<p>a</p>\n</content>\n<content location="head">\n<meta name="x">\n</content>\n</page>\n';
    const parsed = parsePageFile(raw);
    expect(parsed.template === 'split' && parsed.title === 'Hi' && parsed.pageAttributes.status === 'published', JSON.stringify(parsed.pageAttributes));
    expect(parsed.blocks.length === 2 && parsed.blocks[1].location === 'head' && !parsed.extra, 'blocks');
    const again = composePageFile({ meta: parsed.meta, pageAttributes: parsed.pageAttributes, blocks: parsed.blocks });
    expect(again.includes('status="published"') && again.includes('<content location="head">'), again);
    expect(hashFile(raw) === hashFile(raw) && hashFile(raw) !== hashFile(raw + ' '), 'hash');
    expect(parsePageFile(raw + '<script>x</script>').extra.includes('script'), 'extra content outside the blocks is reported');
  }),

  'the core widget list is consistent: unique keys, declared slots, known attribute types': t(() => {
    const keys = coreWidgets.map(widget => widget.key);
    expect(new Set(keys).size === keys.length, 'duplicate keys');
    for(const widget of coreWidgets){
      expect(widget.title && widget.category, `${widget.key} needs a title and category`);
      for(const attribute of widget.attributes || []) expect(attribute.name && attribute.type, `${widget.key} has an attribute without a name or type`);
      for(const slot of widget.slots || []) expect(slot.name, `${widget.key} has a slot without a name`);
    }
    expect(createRegistry(coreWidgets).list().length === keys.length, 'registry size');
  })
};
