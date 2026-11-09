/*
  The widgets only kempo (cms) has: they write the server's own template tags, which the server resolves on every
  request. Each is a widget definition for kempo-ui's page builder (see kempo-ui's `PageBuilder.addWidget`). This module
  imports nothing, so the server and the admin both register the same list, each with its own `addWidget`.

  In the builder a server widget is drawn as a bordered box saying what it is, so a person can see where it is and select
  it; the page gets the tag itself.
*/

const placeholder = (node, ctx, definition, label, container = false) => {
  const marks = ctx.mark(node, definition, container ? ' data-pb-slot="default"' : '');
  const children = container ? ctx.children(node, 'default') : '';
  return `<div class="b r p mb"${marks}><div class="tc-muted${container ? ' mbq' : ''}" contenteditable="false">${ctx.escapeText(label)}</div>${children}</div>`;
};

/*
  Server tags take no classes or styles: the server replaces them, so nothing is written on them. Each has a settings element
  (admin components, loaded only in the builder) that suggests the site's fragments and the page's values.
*/
const plain = { display: '', hideStyles: ['box', 'background', 'textColour', 'align', 'id', 'classes'] };
const settingsModule = '/admin/components/pagebuilder/ServerWidgetSettings.js';

export default [
  {
    name: 'fragment',
    title: 'Fragment',
    description: 'A shared piece of content, edited in one place.',
    icon: 'file-text',
    category: 'server',
    categoryTitle: 'Server',
    ...plain,
    keywords: ['include', 'partial', 'snippet', 'reusable', 'disclaimer'],
    tag: 'fragment',
    settings: settingsModule,
    settingsTag: 'admin-pagebuilder-fragment-settings',
    attributes: [{ name: 'name', type: 'string', label: 'Fragment name', hint: 'The name of a fragment, such as nav or footer.' }],
    render: (node, ctx, info, definition) => (ctx.editor
      ? placeholder(node, ctx, definition, `Fragment: ${node.attrs?.name || '(no name)'}`)
      : `<fragment name="${ctx.escapeAttribute(node.attrs?.name || '')}" />`)
  },
  {
    name: 'location',
    title: 'Location',
    description: 'A place other extensions can add content to.',
    icon: 'map',
    category: 'server',
    categoryTitle: 'Server',
    ...plain,
    keywords: ['slot', 'insertion point', 'hook'],
    tag: 'location',
    attributes: [
      { name: 'name', type: 'string', label: 'Location name', hint: 'Leave empty for the default location.' },
      { name: 'label', type: 'string', label: 'Label', hint: 'How it is named when someone chooses a place to add content to. Optional.' }
    ],
    render: (node, ctx, info, definition) => (ctx.editor
      ? placeholder(node, ctx, definition, `Location: ${node.attrs?.name || '(default)'}`)
      : `<location${node.attrs?.name ? ` name="${ctx.escapeAttribute(node.attrs.name)}"` : ''}${node.attrs?.label ? ` label="${ctx.escapeAttribute(node.attrs.label)}"` : ''} />`)
  },
  {
    name: 'conditional',
    title: 'Conditional',
    description: 'Shows its content only when a value is set.',
    icon: 'help',
    category: 'server',
    categoryTitle: 'Server',
    ...plain,
    keywords: ['if', 'condition', 'show when'],
    tag: 'if',
    settings: settingsModule,
    settingsTag: 'admin-pagebuilder-conditional-settings',
    attributes: [{ name: 'condition', type: 'string', label: 'Condition', hint: 'The name of a value. Put ! in front to show the content when it is not set.' }],
    slots: [{ name: 'default', label: 'Content' }],
    render: (node, ctx, info, definition) => {
      if(ctx.editor) return placeholder(node, ctx, definition, `If ${node.attrs?.condition || '…'}`, true);
      const children = ctx.children(node, 'default');
      return `<if condition="${ctx.escapeAttribute(node.attrs?.condition || '')}">${children ? `\n${children}\n` : ''}</if>`;
    }
  },
  {
    name: 'repeat',
    title: 'Repeat',
    description: 'Repeats its content for each item in a list.',
    icon: 'repeat',
    category: 'server',
    categoryTitle: 'Server',
    ...plain,
    keywords: ['foreach', 'loop', 'each', 'list'],
    tag: 'foreach',
    settings: settingsModule,
    settingsTag: 'admin-pagebuilder-repeat-settings',
    attributes: [
      { name: 'in', type: 'string', label: 'List', hint: 'The name of a value that holds a list.' },
      { name: 'as', type: 'string', label: 'Item name', hint: 'What each item is called inside, as {{name}}.' }
    ],
    slots: [{ name: 'default', label: 'Content' }],
    render: (node, ctx, info, definition) => {
      if(ctx.editor) return placeholder(node, ctx, definition, `Repeat ${node.attrs?.as || 'item'} in ${node.attrs?.in || '…'}`, true);
      const children = ctx.children(node, 'default');
      return `<foreach in="${ctx.escapeAttribute(node.attrs?.in || '')}" as="${ctx.escapeAttribute(node.attrs?.as || 'item')}">${children ? `\n${children}\n` : ''}</foreach>`;
    }
  }
];
