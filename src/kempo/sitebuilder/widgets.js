import { escapeAttribute, escapeText } from './html.js';
import { attributeString, mark, renderSlot } from './render.js';

/*
  The widgets kempo ships. An extension declares its own in `page_widgets` in kempo-config.json with the same fields
  (see docs/sitebuilder.md); these are written here because a few of them render more than one element or change
  their slots, which a declaration cannot say.

  type: 'primitive' (a native element, no page JavaScript), 'component' (a web component the page loads) or
  'server' (renders to one of the server's template tags, which the server resolves on every request).
*/

const PADDING = { '': '', small: 'ph', medium: 'p' };
const BACKGROUNDS = ['alt', 'primary', 'secondary', 'success', 'warning', 'danger'];
const ALIGNS = ['left', 'center', 'right'];

export const COLUMN_SIZES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

export const IMAGE_RATIOS = ['', '1/1', '4/3', '3/2', '16/9', '21/9', '3/4', '2/3'];

export const VIDEO_RATIOS = ['', '16/9', '21/9', '4/3', '1/1', '3/4', '9/16'];

export const VIDEO_CONTROLS = ['', 'minimal', 'normal', 'full'];

/* Photos per row, and the kempo-css width of each. */
export const GALLERY_SPANS = { 2: 6, 3: 4, 4: 3, 6: 2 };

export const GROUP_ELEMENTS = ['div', 'section', 'article', 'header', 'footer', 'aside', 'main', 'nav'];

export const BUTTON_COLORS = ['primary', 'secondary', 'success', 'warning', 'danger'];

const options = (values, labels = {}) => values.map(value => ({ value, label: labels[value] ?? (value ? value[0].toUpperCase() + value.slice(1) : 'None') }));

/* Placeholder for a thing only the server can resolve. */
const placeholder = (node, ctx, label, detail, container = false) =>
  `<div class="sb-placeholder"${mark(node, ctx, ` data-sb-label="${escapeAttribute(label)}"${container ? ' data-sb-slot="default"' : ''}`)}>${container ? '' : escapeText(detail)}${container ? renderSlot(node, 'default', ctx, false) : ''}</div>`;

const accordionIds = (index = 0) => `panel-${index + 1}`;

export const groupClasses = attrs => [
  PADDING[attrs.padding || ''],
  attrs.background ? `bg-${attrs.background}` : '',
  attrs.align ? `ta-${attrs.align}` : '',
  ...String(attrs.extraClass || '').split(/\s+/)
].filter(Boolean);

export const groupAttributes = classes => {
  const attrs = { padding: '', background: '', align: '', extraClass: [] };
  for(const name of classes){
    const padding = Object.keys(PADDING).find(key => key && PADDING[key] === name);
    if(padding && !attrs.padding) attrs.padding = padding;
    else if(name.startsWith('bg-') && BACKGROUNDS.includes(name.slice(3)) && !attrs.background) attrs.background = name.slice(3);
    else if(name.startsWith('ta-') && ALIGNS.includes(name.slice(3)) && !attrs.align) attrs.align = name.slice(3);
    else attrs.extraClass.push(name);
  }
  attrs.extraClass = attrs.extraClass.join(' ');
  return attrs;
};

const coreWidgets = [

  /*
    Text
  */
  {
    key: 'markup',
    title: 'Text',
    description: 'Paragraphs, headings, lists, quotes and code, with bold, italic and links.',
    icon: 'format_paragraph',
    category: 'text',
    keywords: ['paragraph', 'heading', 'list', 'quote', 'code', 'markup', 'text'],
    tag: null,
    editor_tag: 'k-markup-editor',
    editor_component: '/kempo/sitebuilder/components/MarkupEditor.js',
    attributes: [{ name: 'html', type: 'text', virtual: true }],
    render: (node, ctx) => {
      const html = ctx.sanitize ? ctx.sanitize(node.attrs?.html || '') : (node.attrs?.html || '');
      return ctx.editor ? `<k-markup-editor${mark(node, ctx)}>${html}</k-markup-editor>` : html;
    }
  },

  /*
    Media
  */
  {
    key: 'image',
    title: 'Image',
    description: 'A picture.',
    icon: 'image',
    category: 'media',
    keywords: ['picture', 'photo', 'img'],
    tag: 'img',
    settings_tag: 'k-image-settings',
    settings_component: '/kempo/sitebuilder/components/ImageSettings.js',
    attributes: [
      { name: 'src', type: 'image', label: 'Image' },
      { name: 'alt', type: 'string', label: 'Alternative text', hint: 'Describes the picture for people who cannot see it.' },
      { name: 'full', type: 'boolean', label: 'Full width', hint: 'Fills the width of its place. The picture keeps its aspect ratio.' },
      { name: 'width', type: 'number', label: 'Width (pixels)', min: 1, max: 4000, when: { full: 'false' } },
      { name: 'ratio', type: 'select', label: 'Aspect ratio', default: '', options: options(IMAGE_RATIOS, { '': 'Original', '1/1': 'Square (1:1)', '4/3': 'Standard (4:3)', '3/2': 'Photo (3:2)', '16/9': 'Widescreen (16:9)', '21/9': 'Cinema (21:9)', '3/4': 'Portrait (3:4)', '2/3': 'Tall portrait (2:3)' }) },
      { name: 'fit', type: 'select', label: 'Fit', default: '', options: options(['', 'contain'], { '': 'Fill and crop', contain: 'Show all' }) },
      { name: 'rounded', type: 'select', label: 'Corners', default: '', options: options(['', 'small', 'round'], { '': 'Square', small: 'Rounded', round: 'Circle' }) }
    ],
    render: (node, ctx, definition) => {
      const attrs = node.attrs || {};
      if(!attrs.src){
        return `<div style="padding: 1rem; border: 1px dashed #888; text-align: center; opacity: 0.7"${mark(node, ctx)}>Choose an image.</div>`;
      }
      const ratio = IMAGE_RATIOS.includes(attrs.ratio) ? attrs.ratio : '';
      const full = attrs.full === true || attrs.full === 'true';
      const classes = [full ? 'full' : '', attrs.rounded === 'round' ? 'round' : attrs.rounded === 'small' ? 'r' : ''].filter(Boolean).join(' ');
      const style = ratio ? ` style="aspect-ratio: ${ratio.replace('/', ' / ')}; object-fit: ${attrs.fit === 'contain' ? 'contain' : 'cover'}"` : '';
      return `<img${attributeString(definition, node, ctx, ['full', 'ratio', 'fit', 'rounded', ...(full ? ['width'] : [])])}${classes ? ` class="${classes}"` : ''}${style}${mark(node, ctx)}>`;
    }
  },
  {
    key: 'video',
    title: 'Video',
    description: 'A video file, or a YouTube or Vimeo address.',
    icon: 'play',
    category: 'media',
    keywords: ['movie', 'youtube', 'vimeo', 'mp4'],
    tag: 'k-video-player',
    page_component: '/kempo/components/VideoPlayer.js',
    attributes: [
      { name: 'src', type: 'url', label: 'Video URL', hint: 'A video file, or a YouTube or Vimeo address.', picker: 'video' },
      { name: 'poster', type: 'image', label: 'Poster image', hint: 'Shown before the video plays. Video files only.' },
      { name: 'width', type: 'number', label: 'Maximum width (pixels)', hint: 'Leave empty to fill the width of its place.', min: 100, max: 4000 },
      { name: 'align', type: 'select', label: 'Position', hint: 'Where a video narrower than its place sits.', default: 'left', options: options(ALIGNS) },
      { name: 'ratio', type: 'select', label: 'Aspect ratio', hint: 'Original keeps the video\'s own.', default: '', options: options(VIDEO_RATIOS, { '': 'Original', '16/9': 'Widescreen (16:9)', '21/9': 'Cinema (21:9)', '4/3': 'Standard (4:3)', '1/1': 'Square (1:1)', '3/4': 'Portrait (3:4)', '9/16': 'Tall portrait (9:16)' }) },
      { name: 'fit', type: 'select', label: 'Fit', hint: 'How a video file fills the aspect ratio.', default: '', options: options(['', 'cover'], { '': 'Show all', cover: 'Fill and crop' }) },
      { name: 'controls', type: 'select', label: 'Controls', default: 'normal', options: options(VIDEO_CONTROLS, { '': 'Off', minimal: 'Minimal', normal: 'Normal', full: 'Full' }) },
      { name: 'skip', type: 'number', label: 'Skip buttons (seconds)', hint: 'How far the skip back and forward buttons jump.', min: 1, max: 120, default: 10, when: { controls: 'full' } },
      { name: 'neverHide', type: 'boolean', label: 'Never hide the controls', hint: 'Keep controls visible while the video plays. Video files only.' },
      { name: 'hideAfter', attr: 'hide-after', type: 'number', label: 'Hide the controls after (seconds)', hint: 'While the video plays and the pointer is still. Video files only.', min: 1, max: 30, default: 3, when: { neverHide: 'false' } },
      { name: 'autoplay', type: 'boolean', label: 'Play automatically', hint: 'Browsers only start a video by themselves when it is muted, so it is muted too.' },
      { name: 'loop', type: 'boolean', label: 'Loop' },
      { name: 'muted', type: 'boolean', label: 'Muted' },
      { name: 'remember', type: 'boolean', label: 'Remember where the viewer stopped', hint: 'Video files only.' },
      { name: 'preload', type: 'select', label: 'Loading', hint: 'How much of a video file loads before it is played.', default: 'metadata', options: options(['none', 'metadata', 'auto'], { none: 'Nothing', metadata: 'Its length and first picture', auto: 'All of it' }) }
    ]
  },
  {
    key: 'audio',
    title: 'Audio',
    description: 'An audio player.',
    icon: 'volume_up',
    category: 'media',
    keywords: ['sound', 'music', 'podcast', 'mp3'],
    tag: 'k-audio',
    attributes: [
      { name: 'src', type: 'url', label: 'Audio URL', picker: 'audio' },
      { name: 'controls', type: 'select', label: 'Controls', default: 'normal', options: options(VIDEO_CONTROLS, { '': 'Off', minimal: 'Minimal', normal: 'Normal', full: 'Full' }) },
      { name: 'autoplay', type: 'boolean', label: 'Play automatically' },
      { name: 'loop', type: 'boolean', label: 'Loop' },
      { name: 'muted', type: 'boolean', label: 'Muted' },
      { name: 'preload', type: 'select', label: 'Loading', default: 'metadata', options: options(['none', 'metadata', 'auto'], { none: 'Nothing', metadata: 'Its length', auto: 'All' }) }
    ],
    render: (node, ctx, definition) => `<k-audio${attributeString(definition, node, ctx)}${mark(node, ctx)}></k-audio>`
  },
  {
    key: 'file',
    title: 'File',
    description: 'A link to download a file.',
    icon: 'download',
    category: 'media',
    keywords: ['download', 'attachment', 'pdf', 'document'],
    tag: 'a',
    editable: 'label',
    attributes: [
      { name: 'href', type: 'url', label: 'File address' },
      { name: 'label', type: 'string', label: 'Link text', default: 'Download' }
    ],
    render: (node, ctx) => {
      const href = node.attrs?.href ? ` href="${escapeAttribute(node.attrs.href)}"` : '';
      return `<a${href} download${mark(node, ctx, ' data-sb-edit="label"')}>${escapeText(node.attrs?.label ?? 'Download')}</a>`;
    }
  },
  {
    key: 'photo-viewer',
    title: 'Photo viewer',
    description: 'One picture, or a gallery of them, that open large when they are clicked and can be paged through.',
    icon: 'fullscreen',
    category: 'media',
    keywords: ['gallery', 'lightbox', 'photo', 'zoom', 'images'],
    tag: 'k-photo-viewer',
    page_component: '/kempo-ui/components/PhotoViewer.js',
    settings_tag: 'k-photo-viewer-settings',
    settings_component: '/kempo/sitebuilder/components/PhotoViewerSettings.js',
    attributes: [
      { name: 'images', type: 'text', virtual: true },
      { name: 'columns', type: 'select', label: 'Photos per row', default: '3', options: options(Object.keys(GALLERY_SPANS)) }
    ],
    render: (node, ctx) => {
      const images = Array.isArray(node.attrs?.images) ? node.attrs.images : [];
      const viewer = (image, extra = '') => `<k-photo-viewer${image?.src ? ` src="${escapeAttribute(image.src)}"` : ''}${image?.alt ? ` alt="${escapeAttribute(image.alt)}"` : ''}${extra}></k-photo-viewer>`;
      if(images.length <= 1) return viewer(images[0], mark(node, ctx));
      const span = GALLERY_SPANS[node.attrs?.columns] || GALLERY_SPANS[3];
      return `<div class="row"${mark(node, ctx)}>\n${images.map(image => viewer(image, ` class="span-${span} m-span-6 pq"`)).join('\n')}\n</div>`;
    }
  },
  {
    key: 'hero',
    title: 'Hero',
    description: 'A large background image with content on top of it.',
    icon: 'wysiwyg',
    category: 'media',
    keywords: ['banner', 'cover', 'header', 'background'],
    tag: 'k-hero',
    page_component: '/kempo/components/Hero.js',
    settings_tag: 'k-hero-settings',
    settings_component: '/kempo/sitebuilder/components/HeroSettings.js',
    attributes: [
      { name: 'image', type: 'image', label: 'Background image' },
      { name: 'height', type: 'select', label: 'Height', default: 'tall', options: options(['full', 'tall', 'medium'], { full: 'Full screen', tall: 'Tall', medium: 'Medium' }) },
      { name: 'overlay', type: 'number', label: 'Overlay darkness (0 to 90)', default: 40, min: 0, max: 90 }
    ],
    slots: [{ name: 'default', label: 'Content' }]
  },
  {
    key: 'embed',
    title: 'Embed',
    description: 'A YouTube, Vimeo or Spotify embed.',
    icon: 'code_blocks',
    category: 'media',
    keywords: ['iframe', 'youtube', 'vimeo', 'spotify', 'embed'],
    tag: 'k-embed',
    page_component: '/kempo/components/Embed.js',
    attributes: [
      { name: 'src', type: 'url', label: 'Address', hint: 'The address of a YouTube, Vimeo or Spotify page.' },
      { name: 'title', type: 'string', label: 'Title' }
    ]
  },

  /*
    Layout
  */
  {
    key: 'group',
    title: 'Group',
    description: 'A box that holds other widgets.',
    icon: 'frame_source',
    category: 'layout',
    keywords: ['container', 'section', 'box', 'div', 'wrapper'],
    tag: 'div',
    attributes: [
      { name: 'element', type: 'select', label: 'HTML element', default: 'div', options: options(GROUP_ELEMENTS, { div: 'div (a plain box)' }) },
      { name: 'padding', type: 'select', label: 'Padding', default: '', options: options(['', 'small', 'medium']) },
      { name: 'background', type: 'select', label: 'Background', default: '', options: options(['', ...BACKGROUNDS]) },
      { name: 'align', type: 'select', label: 'Text alignment', default: '', options: options(['', ...ALIGNS], { '': 'Default' }) },
      { name: 'extraClass', type: 'string', label: 'Other classes', hint: 'Extra kempo-css classes, separated by spaces.' }
    ],
    slots: [{ name: 'default', label: 'Content' }],
    render: (node, ctx, definition) => {
      const classes = groupClasses(node.attrs || {});
      const children = renderSlot(node, 'default', ctx);
      const tag = GROUP_ELEMENTS.includes(node.attrs?.element) ? node.attrs.element : 'div';
      return `<${tag}${classes.length ? ` class="${escapeAttribute(classes.join(' '))}"` : ''}${mark(node, ctx, ctx.editor ? ' data-sb-slot="default"' : '')}>${children ? `\n${children}\n` : ''}</${tag}>`;
    }
  },
  {
    key: 'row',
    title: 'Row',
    description: 'Side by side columns that stack on a phone. Add a column for each part.',
    icon: 'row',
    category: 'layout',
    keywords: ['columns', 'grid', 'split', 'side by side'],
    tag: 'div',
    settings_tag: 'k-row-settings',
    settings_component: '/kempo/sitebuilder/components/RowSettings.js',
    slots: [{ name: 'default', label: 'Columns', accepts: ['column'] }],
    render: (node, ctx) => {
      const children = renderSlot(node, 'default', ctx);
      return `<div class="row"${mark(node, ctx, ctx.editor ? ' data-sb-slot="default"' : '')}>${children ? `\n${children}\n` : ''}</div>`;
    }
  },
  {
    key: 'column',
    title: 'Column',
    description: 'One column of a row. It fills the space the other columns leave unless it has a width.',
    icon: 'column',
    category: 'layout',
    keywords: ['row', 'width', 'split'],
    only_in: ['row'],
    tag: 'div',
    settings_tag: 'k-column-settings',
    settings_component: '/kempo/sitebuilder/components/ColumnSettings.js',
    attributes: [
      { name: 'size', type: 'select', label: 'Width', hint: 'Out of 12. Columns without a width share the space that is left.', default: '', options: options(['', ...COLUMN_SIZES], { '': 'Fill the space', ...Object.fromEntries(COLUMN_SIZES.map(size => [size, `${size} of 12`])) }) },
      { name: 'stack', type: 'boolean', label: 'Stack on a phone', default: true }
    ],
    slots: [{ name: 'default', label: 'Content' }],
    render: (node, ctx) => {
      const classes = [COLUMN_SIZES.includes(node.attrs?.size) ? `span-${node.attrs.size}` : 'col', node.attrs?.stack === false ? '' : 'm-span-12'].filter(Boolean);
      const children = renderSlot(node, 'default', ctx);
      return `<div class="${classes.join(' ')}"${mark(node, ctx, ctx.editor ? ' data-sb-slot="default"' : '')}>${children ? `\n${children}\n` : ''}</div>`;
    }
  },
  {
    key: 'spacer',
    title: 'Spacer',
    description: 'Empty space between widgets.',
    icon: 'unfold_more',
    category: 'layout',
    keywords: ['gap', 'space', 'margin', 'padding'],
    tag: 'div',
    attributes: [
      { name: 'size', type: 'select', label: 'Size', default: 'medium', options: options(['small', 'medium', 'large']) }
    ],
    render: (node, ctx) => {
      const size = node.attrs?.size || 'medium';
      if(size === 'small') return `<div class="pyh"${mark(node, ctx)}></div>`;
      if(size === 'large') return `<div class="py"${mark(node, ctx)}><div class="py"></div></div>`;
      return `<div class="py"${mark(node, ctx)}></div>`;
    }
  },
  {
    key: 'divider',
    title: 'Divider',
    description: 'A horizontal line.',
    icon: 'wrap_text',
    category: 'layout',
    keywords: ['line', 'rule', 'separator', 'hr'],
    tag: 'hr'
  },

  /*
    Content
  */
  {
    key: 'button',
    title: 'Button',
    description: 'A link that looks like a button, or a real button that a script can use.',
    icon: 'open_in_browser',
    category: 'content',
    keywords: ['link', 'call to action', 'cta', 'script'],
    tag: 'a',
    editable: 'label',
    settings_tag: 'k-button-settings',
    settings_component: '/kempo/sitebuilder/components/ButtonSettings.js',
    attributes: [
      { name: 'kind', type: 'select', label: 'Type', default: 'link', options: [{ value: 'link', label: 'Link' }, { value: 'button', label: 'Button' }] },
      { name: 'href', type: 'url', label: 'URL', when: { kind: 'link' } },
      { name: 'newTab', type: 'boolean', label: 'Open in a new tab', when: { kind: 'link' } },
      { name: 'id', type: 'id', label: 'ID', hint: 'A script on the page can find this button by its ID, to make it do something.', when: { kind: 'button' } },
      { name: 'label', type: 'string', label: 'Button text', default: 'Button' },
      { name: 'color', type: 'select', label: 'Color', default: '', options: options(['', ...BUTTON_COLORS], { '': 'Default' }) }
    ],
    render: (node, ctx) => {
      const text = escapeText(node.attrs?.label ?? 'Button');
      const color = BUTTON_COLORS.includes(node.attrs?.color) ? node.attrs.color : '';
      const real = node.attrs?.kind === 'button';
      if(real && !ctx.editor) return `<button type="button"${node.attrs?.id ? ` id="${escapeAttribute(node.attrs.id)}"` : ''}${color ? ` class="${color}"` : ''}>${text}</button>`;
      const href = !real && node.attrs?.href ? ` href="${escapeAttribute(node.attrs.href)}"${node.attrs.newTab ? ' target="_blank" rel="noopener"' : ''}` : '';
      return `<a class="btn${color ? ` ${color}` : ''}"${href}${mark(node, ctx, ' data-sb-edit="label"')}>${text}</a>`;
    }
  },
  {
    key: 'table',
    title: 'Table',
    description: 'Rows and columns of text.',
    icon: 'table',
    category: 'content',
    keywords: ['grid', 'rows', 'columns', 'data', 'spreadsheet'],
    tag: 'table',
    attributes: [
      { name: 'header', type: 'boolean', label: 'First row is a heading', default: true },
      { name: 'rows', type: 'table', label: 'Cells', virtual: true }
    ],
    render: (node, ctx) => {
      const rows = Array.isArray(node.attrs?.rows) && node.attrs.rows.length ? node.attrs.rows : [['', ''], ['', '']];
      const header = node.attrs?.header !== false;
      const cell = (tag, text, rowIndex, columnIndex) => `<${tag}${ctx.editor ? ` data-sb-cell="${rowIndex},${columnIndex}"` : ''}>${escapeText(text)}</${tag}>`;
      const line = (row, rowIndex, tag) => `<tr>${row.map((text, columnIndex) => cell(tag, text, rowIndex, columnIndex)).join('')}</tr>`;
      const head = header ? `<thead>\n${line(rows[0], 0, 'th')}\n</thead>\n` : '';
      const bodyRows = (header ? rows.slice(1) : rows).map((row, index) => line(row, index + (header ? 1 : 0), 'td'));
      return `<table${mark(node, ctx)}>\n${head}<tbody>\n${bodyRows.join('\n')}\n</tbody>\n</table>`;
    }
  },
  {
    key: 'search',
    title: 'Search',
    description: 'A search box that goes to your search page.',
    icon: 'search',
    category: 'content',
    keywords: ['find', 'query'],
    tag: 'form',
    attributes: [
      { name: 'action', type: 'url', label: 'Search page', default: '/search' },
      { name: 'placeholder', type: 'string', label: 'Placeholder', default: 'Search' },
      { name: 'button', type: 'string', label: 'Button text', default: 'Search' }
    ],
    render: (node, ctx) => {
      const action = node.attrs?.action || '/search';
      const placeholder = node.attrs?.placeholder ?? 'Search';
      const button = node.attrs?.button ?? 'Search';
      return `<form action="${escapeAttribute(action)}" method="get" role="search"${mark(node, ctx)}><input type="search" name="q" placeholder="${escapeAttribute(placeholder)}"> <button class="primary">${escapeText(button)}</button></form>`;
    }
  },
  {
    key: 'social-icons',
    title: 'Social icons',
    description: 'Links to your social profiles.',
    icon: 'public',
    category: 'content',
    keywords: ['facebook', 'twitter', 'instagram', 'youtube', 'linkedin', 'github', 'follow'],
    tag: 'k-social-icons',
    page_component: '/kempo/components/SocialIcons.js',
    attributes: ['facebook', 'x', 'instagram', 'youtube', 'linkedin', 'tiktok', 'github'].map(name => ({ name, type: 'url', label: name === 'x' ? 'X' : name[0].toUpperCase() + name.slice(1) }))
  },

  /*
    Interactive (kempo-ui components)
  */
  {
    key: 'accordion',
    title: 'Accordion',
    description: 'Sections that open and close.',
    icon: 'unfold_more',
    category: 'interactive',
    keywords: ['collapse', 'faq', 'expand', 'panels'],
    tag: 'k-accordion',
    page_component: '/kempo-ui/components/Accordion.js',
    settings_tag: 'k-accordion-settings',
    settings_component: '/kempo/sitebuilder/components/AccordionSettings.js',
    attributes: [{ name: 'multiple', type: 'boolean', label: 'Allow several open at once' }],
    slots: [{ name: 'default', label: 'Sections', accepts: ['accordion-item'] }]
  },
  {
    key: 'accordion-item',
    title: 'Accordion section',
    description: 'One section of an accordion.',
    icon: 'unfold_less',
    category: 'interactive',
    only_in: ['accordion'],
    tag: 'k-accordion-header',
    page_component: '/kempo-ui/components/Accordion.js',
    editable: 'title',
    attributes: [{ name: 'title', type: 'string', label: 'Heading', default: 'Section' }],
    slots: [{ name: 'default', label: 'Content' }],
    render: (node, ctx, definition, info) => {
      const id = accordionIds(info?.index);
      const children = renderSlot(node, 'default', ctx, false);
      const header = `<k-accordion-header for-panel="${id}"${ctx.editor ? ' active' : ''}${mark(node, ctx, ' data-sb-edit="title"')}>${escapeText(node.attrs?.title ?? 'Section')}</k-accordion-header>`;
      const panel = `<k-accordion-panel name="${id}"${mark(node, ctx, ctx.editor ? ' data-sb-slot="default"' : '')}>${children ? `\n${children}\n` : ''}</k-accordion-panel>`;
      return `${header}\n${panel}`;
    }
  },
  {
    key: 'tabs',
    title: 'Tabs',
    description: 'Content split into tabs.',
    icon: 'table-visibility',
    category: 'interactive',
    keywords: ['tabbed', 'panels'],
    tag: 'k-tabs',
    page_component: '/kempo-ui/components/Tabs.js',
    settings_tag: 'k-tabs-settings',
    settings_component: '/kempo/sitebuilder/components/TabsSettings.js',
    slots: [{ name: 'default', label: 'Tabs', accepts: ['tab-item'] }]
  },
  {
    key: 'tab-item',
    title: 'Tab',
    description: 'One tab.',
    icon: 'label',
    category: 'interactive',
    only_in: ['tabs'],
    tag: 'k-tab',
    page_component: '/kempo-ui/components/Tabs.js',
    editable: 'label',
    attributes: [{ name: 'label', type: 'string', label: 'Tab name', default: 'Tab' }],
    slots: [{ name: 'default', label: 'Content' }],
    render: (node, ctx, definition, info) => {
      const id = `tab-${(info?.index ?? 0) + 1}`;
      const children = renderSlot(node, 'default', ctx, false);
      const tab = `<k-tab for="${id}"${mark(node, ctx, ' data-sb-edit="label"')}>${escapeText(node.attrs?.label ?? 'Tab')}</k-tab>`;
      const content = `<k-tab-content name="${id}"${mark(node, ctx, ctx.editor ? ' data-sb-slot="default"' : '')}>${children ? `\n${children}\n` : ''}</k-tab-content>`;
      return `${tab}\n${content}`;
    }
  },
  {
    key: 'card',
    title: 'Card',
    description: 'A bordered box with an optional label.',
    icon: 'cards',
    category: 'interactive',
    keywords: ['box', 'panel', 'tile'],
    tag: 'k-card',
    page_component: '/kempo-ui/components/Card.js',
    attributes: [{ name: 'label', type: 'string', label: 'Label' }],
    slots: [{ name: 'default', label: 'Content' }]
  },
  {
    key: 'content-slider',
    title: 'Content slider',
    description: 'A swipeable carousel. Each widget inside is one slide.',
    icon: 'fast_forward',
    category: 'interactive',
    keywords: ['carousel', 'slideshow', 'slides'],
    tag: 'k-content-slider',
    page_component: '/kempo-ui/components/ContentSlider.js',
    settings_tag: 'k-content-slider-settings',
    settings_component: '/kempo/sitebuilder/components/ContentSliderSettings.js',
    attributes: [
      { name: 'controls', type: 'boolean', label: 'Show arrows', default: true, format: 'text' },
      { name: 'loop', type: 'boolean', label: 'Loop', default: false, format: 'text' }
    ],
    slots: [{ name: 'default', label: 'Slides' }]
  },
  {
    key: 'show-more',
    title: 'Show more',
    description: 'Long content that is cut short with a toggle to read the rest.',
    icon: 'show',
    category: 'interactive',
    keywords: ['read more', 'expand', 'truncate'],
    tag: 'k-show-more',
    page_component: '/kempo-ui/components/ShowMore.js',
    attributes: [{ name: 'opened', type: 'boolean', label: 'Start open' }],
    slots: [{ name: 'default', label: 'Content' }]
  },
  {
    key: 'icon',
    title: 'Icon',
    description: 'A small symbol.',
    icon: 'star',
    category: 'interactive',
    keywords: ['symbol', 'glyph'],
    tag: 'k-icon',
    page_component: '/kempo-ui/components/Icon.js',
    attributes: [{ name: 'name', type: 'string', label: 'Icon name', hint: 'The name of one of the site\'s icons.' }]
  },

  /*
    Server widgets: they write the server's own template tags, which the server resolves on every request.
  */
  {
    key: 'fragment',
    title: 'Fragment',
    description: 'A shared piece of content, edited in one place.',
    icon: 'file-text',
    category: 'server',
    keywords: ['include', 'partial', 'snippet', 'reusable', 'disclaimer'],
    server: true,
    tag: 'fragment',
    attributes: [{ name: 'name', type: 'string', label: 'Fragment name', hint: 'The name of a fragment, such as nav or footer.' }],
    render: (node, ctx) => (ctx.editor
      ? placeholder(node, ctx, 'Fragment', node.attrs?.name || '(no name)')
      : `<fragment name="${escapeAttribute(node.attrs?.name || '')}" />`)
  },
  {
    key: 'location',
    title: 'Location',
    description: 'A place other extensions can add content to.',
    icon: 'map',
    category: 'server',
    keywords: ['slot', 'insertion point', 'hook'],
    server: true,
    tag: 'location',
    attributes: [{ name: 'name', type: 'string', label: 'Location name', hint: 'Leave empty for the default location.' }],
    render: (node, ctx) => (ctx.editor
      ? placeholder(node, ctx, 'Location', node.attrs?.name || '(default)')
      : `<location${node.attrs?.name ? ` name="${escapeAttribute(node.attrs.name)}"` : ''} />`)
  },
  {
    key: 'conditional',
    title: 'Conditional',
    description: 'Shows its content only when a value is set.',
    icon: 'help',
    category: 'server',
    keywords: ['if', 'condition', 'show when'],
    server: true,
    tag: 'if',
    attributes: [{ name: 'condition', type: 'string', label: 'Condition', hint: 'The name of a value. Put ! in front to show the content when it is not set.', variables: true }],
    slots: [{ name: 'default', label: 'Content' }],
    render: (node, ctx) => {
      if(ctx.editor) return placeholder(node, ctx, `If ${node.attrs?.condition || '…'}`, '', true);
      const children = renderSlot(node, 'default', ctx, false);
      return `<if condition="${escapeAttribute(node.attrs?.condition || '')}">${children ? `\n${children}\n` : ''}</if>`;
    }
  },
  {
    key: 'repeat',
    title: 'Repeat',
    description: 'Repeats its content for each item in a list.',
    icon: 'repeat',
    category: 'server',
    keywords: ['foreach', 'loop', 'each', 'list'],
    server: true,
    tag: 'foreach',
    attributes: [
      { name: 'in', type: 'string', label: 'List', hint: 'The name of a value that holds a list.', variables: true },
      { name: 'as', type: 'string', label: 'Item name', hint: 'What each item is called inside, as {{name}}.' }
    ],
    slots: [{ name: 'default', label: 'Content' }],
    render: (node, ctx) => {
      if(ctx.editor) return placeholder(node, ctx, `Repeat ${node.attrs?.as || 'item'} in ${node.attrs?.in || '…'}`, '', true);
      const children = renderSlot(node, 'default', ctx, false);
      return `<foreach in="${escapeAttribute(node.attrs?.in || '')}" as="${escapeAttribute(node.attrs?.as || 'item')}">${children ? `\n${children}\n` : ''}</foreach>`;
    }
  },

  /*
    Anything the builder could not give a widget: kept exactly as it was.
  */
  {
    key: 'unknown',
    title: 'Unknown widget',
    description: 'Content from an extension that is not installed. It is kept as it was.',
    icon: 'warning',
    category: 'hidden',
    tag: null,
    attributes: [
      { name: 'tag', type: 'string', virtual: true },
      { name: 'html', type: 'text', virtual: true }
    ],
    render: (node, ctx) => (ctx.editor
      ? placeholder(node, ctx, 'Unknown widget', `<${node.attrs?.tag || 'element'}> is not available, so it is kept as it was.`)
      : (node.attrs?.html || ''))
  }
];

export default coreWidgets;
