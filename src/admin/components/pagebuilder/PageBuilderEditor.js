import ShadowComponent from '/kempo-ui/components/ShadowComponent.js';
import { html, css } from '/kempo-ui/lit-all.min.js';
import PageBuilder from '/kempo-ui/components/PageBuilder.js';
import PageBuilderFields from '/kempo-ui/components/pagebuilder/PageBuilderFields.js';
import Toast from '/kempo-ui/components/Toast.js';
import { getSitebuilderWidgets, listSitebuilderTemplates, createSitebuilderTemplate, deleteSitebuilderTemplate } from '/kempo/sdk.js';
import serverWidgets from '/kempo/pagebuilder/serverWidgets.js';
import coreWidgets from '/kempo/pagebuilder/coreWidgets.js';
import rawHtml from '/kempo/pagebuilder/rawHtml.js';
import { setVariables } from './ServerWidgetSettings.js';
import '/kempo-ui/components/Icon.js';
import '/kempo/components/IconPicker.js';
import './controls/PageControl.js';
import './controls/LocationControl.js';

/*
  The widgets and pickers kempo adds to kempo-ui's page builder. This is done once per page load, before the first
  builder is drawn, so a page never opens with a widget it does not know yet:

    - kempo's server widgets (fragment, location, conditional, repeat);
    - the HTML widget written to the page as it is, with no element around it (see rawHtml.js);
    - the widgets the enabled extensions declare (page_widgets), which the server sends as kempo-ui widget definitions;
    - the media library for image, video and audio settings, and the site's own icon picker for icon settings.
*/

/* The page is drawn in the builder's frame with the site's own stylesheet, which the admin does not use itself. */
const SITE_STYLES = ['/styles.css'];

let prepared = null;

const ICON_FOR_KIND = { image: 'image', video: 'video', audio: 'audio', '': 'download' };

const mediaPicker = kind => ({ id, value, change }) => html`
  <input id="${id}" type="text" class="full" .value="${value}" @input="${event => change(event.target.value, true)}">
  ${window.kempo?.openAssetPicker ? html`<button class="mtq" @click="${async () => {
    const choice = await window.kempo.openAssetPicker({ kind });
    if(choice) change(choice.url, false);
  }}"><k-icon name="${ICON_FOR_KIND[kind] ?? 'download'}"></k-icon> Choose from the media library</button>` : ''}
`;

/* An icon setting holds a kempo-ui icon name, or `src:` and the address of an SVG file. The site's picker works with addresses. */
const iconPicker = ({ id, value, change }) => {
  const text = String(value ?? '');
  const address = text.startsWith('src:') ? text.slice(4) : (text ? `/kempo-ui/icons/${text}.svg` : '');
  return html`<k-icon-picker id="${id}" .value="${address}" allow-none @change="${event => change(event.detail.value ? `src:${event.detail.value}` : '', false)}"></k-icon-picker>`;
};

const prepare = () => {
  prepared ??= (async () => {
    for(const config of [...serverWidgets, ...coreWidgets]) PageBuilder.addWidget(config);
    PageBuilder.addWidget({ ...PageBuilder.widgets.find(widget => widget.name === 'html'), ...rawHtml });
    const [, data] = await getSitebuilderWidgets();
    for(const config of data?.widgets || []){
      try {
        PageBuilder.addWidget(config);
      } catch(error) {
        console.warn(`The page widget "${config.name}" was not added: ${error.message}`);
      }
    }
    PageBuilderFields.pickers.image = mediaPicker('image');
    PageBuilderFields.pickers.video = mediaPicker('video');
    PageBuilderFields.pickers.audio = mediaPicker('audio');
    PageBuilderFields.pickers.file = mediaPicker('');
    PageBuilderFields.pickers.icon = iconPicker;
  })();
  return prepared;
};

const titleOf = location => location.label || (location.name === 'default' ? 'Content' : location.name[0].toUpperCase() + location.name.slice(1));

/*
  The admin's page editor around kempo-ui's <k-page-builder>. The builder edits one list of widgets at a time, so this
  holds the list of every content location of the page and shows the chosen one. It is given `data` (what the server
  returned when the page was opened) and `host`, the page editor, whose save() writes the page. The host asks for
  getTrees() and, once the server has stored them, calls markSaved().
*/
export default class PageBuilderEditor extends ShadowComponent {
  static properties = {
    data: { attribute: false },
    host: { attribute: false },
    meta: { attribute: false },
    saving: { type: Boolean },
    ready: { state: true },
    location: { state: true },
    templates: { state: true }
  };

  static styles = css`
    :host { display: block; height: 100%; }
    k-page-builder { height: 100%; }
  `;

  constructor() {
    super();
    this.ready = false;
    this.location = 'default';
    this.templates = [];
    this.saving = false;
    this.trees = {};
    this.savedJson = '';
    this.loaded = null;
    this.sentPage = null;
    this.generation = 0;
    this.shown = '';
  }

  /*
    Lifecycle Callbacks
  */
  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('beforeunload', this.handleBeforeUnload);
    window.addEventListener('hashchange', this.handleHashChange);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    window.removeEventListener('hashchange', this.handleHashChange);
  }

  updated(changed) {
    super.updated(changed);
    /* The host keeps the hash up to date after each save by copying `data`, so a new opening of the page is told by its trees. */
    if(changed.has('data') && this.data && this.data.trees !== this.loaded?.trees) this.start();
    this.show();
  }

  /*
    Public Methods
  */
  get dirty() {
    return JSON.stringify(this.trees) !== this.savedJson;
  }

  /* What is sent to the server is what counts as saved once it is stored, whatever is changed while it is on its way. */
  getTrees() {
    this.sentPage = structuredClone(this.renderRoot.querySelector('k-page-builder')?.value ?? null);
    return structuredClone(this.trees);
  }

  markSaved() {
    this.savedJson = JSON.stringify(this.trees);
    this.renderRoot.querySelector('k-page-builder')?.markSaved(this.sentPage ?? undefined);
  }

  /*
    Protected Members
  */
  visualLocations() {
    return (this.data?.locations || []).filter(location => !location.code);
  }

  /* The content area being edited is the address hash (#scripts), as kempo-ui's tabs do it. The first area has no hash. */
  locationFromHash() {
    const visual = this.visualLocations();
    const name = decodeURIComponent(window.location.hash.slice(1));
    return visual.some(location => location.name === name) ? name : (visual[0]?.name || 'default');
  }

  goTo(name) {
    const hash = name === this.visualLocations()[0]?.name ? '' : `#${encodeURIComponent(name)}`;
    window.history.pushState(null, '', `${window.location.pathname}${window.location.search}${hash}`);
    this.location = name;
  }

  async start() {
    this.loaded = this.data;
    this.generation++;
    await prepare();
    const [, listing] = await listSitebuilderTemplates();
    this.templates = listing?.templates || [];
    setVariables(this.data.page?.variables);
    this.trees = structuredClone(this.data.trees || {});
    for(const { name } of this.visualLocations()) this.trees[name] = this.trees[name] || [];
    this.savedJson = JSON.stringify(this.trees);
    this.location = this.locationFromHash();
    this.shown = '';
    this.ready = true;
  }

  /* The builder is given a page only when the page or the location changes, so setting it never clears its undo history or its unsaved mark by accident. */
  show() {
    const builder = this.renderRoot.querySelector('k-page-builder');
    const key = `${this.generation}:${this.location}`;
    if(!builder || !this.ready || this.shown === key) return;
    this.shown = key;
    const { title = '', description = '' } = this.meta || {};
    builder.value = { attrs: { title, description }, slots: { default: structuredClone(this.trees[this.location] || []) } };
  }

  /*
    Event Handlers
  */
  handleBeforeUnload = event => {
    if(!this.dirty && !this.host?.extrasDirty) return;
    event.preventDefault();
    event.returnValue = '';
  };

  handleChange = event => {
    const { value } = event.detail;
    this.trees[this.location] = structuredClone(value.slots?.default || []);
    const { title = '', description = '' } = value.attrs || {};
    if(title !== (this.meta?.title ?? '') || description !== (this.meta?.description ?? '')) this.host.setMeta({ title, description });
  };

  /* The page is stored on the server, which can refuse it, so the builder is told it is saved (markSaved) only when it was. */
  handleSaveRequest = () => this.host.save();

  handleLocation = event => this.goTo(event.detail.value);

  handleHashChange = () => {
    if(this.ready) this.location = this.locationFromHash();
  };

  handleTemplateSave = async event => {
    const { name, nodes } = event.detail;
    const [error, saved] = await createSitebuilderTemplate({ name, nodes });
    if(error) {
      Toast.error(error.msg || 'The template could not be saved');
      return;
    }
    this.templates = [saved, ...this.templates];
  };

  handleTemplateRemove = async event => {
    const template = this.templates[event.detail.index];
    if(!template) return;
    const [error] = await deleteSitebuilderTemplate(template.id);
    if(error) {
      Toast.error(error.msg || 'The template could not be removed');
      return;
    }
    this.templates = this.templates.filter(other => other !== template);
  };

  /*
    Render
  */
  /*
    The controls kempo adds to the builder's bar are kempo-ui controls, in two spots. The first (links back and to the page, and
    the content area) has a priority, so it stays in the bar after the builder's own undo and redo. The second (the page's own
    actions) has a negative one, so it is the first to move into the bar's "more" menu when the bar is narrow.
  */
  renderLocations() {
    const visual = this.visualLocations();
    if(visual.length < 2) return '';
    return html`<admin-pb-location slot="left-end" priority="8" .locations="${visual.map(location => ({ name: location.name, label: titleOf(location) }))}" .value="${this.location}" @change="${this.handleLocation}"></admin-pb-location>`;
  }

  /*
    The page's own settings the builder does not have (its name and template, and who made it), in the builder's page
    settings panel, below the title and description: it is shown while no widget is selected.
  */
  renderPageSettings() {
    const host = this.host;
    const page = host.page;
    const system = page.owner === 'system';
    const meta = this.meta;
    const info = (label, value) => html`<div class="mbq"><span class="tc-muted">${label}</span> ${value || ''}</div>`;
    return html`
      <div slot="page-settings" class="mb">
        <div class="mb">
          <label class="d-b mbq" for="pb-page-name">Name<small class="d-b tc-muted">How the page is listed in the admin. Visitors never see it.</small></label>
          <input id="pb-page-name" type="text" class="full" .value="${meta.name || ''}" ?disabled="${system}" @input="${event => host.setMeta({ name: event.target.value })}">
        </div>
        <div class="mb">
          <label class="d-b mbq" for="pb-page-template">Template<small class="d-b tc-muted">The layout the page is drawn in. Changing it can change which content areas the page has.</small></label>
          <select id="pb-page-template" class="full" @change="${event => host.setMeta({ template: event.target.value })}">
            ${host.templateChoices().map(choice => html`<option value="${choice.name}" .selected="${choice.name === meta.template}">${choice.label}</option>`)}
          </select>
        </div>
        ${system ? '' : info('Author', page.author)}
        ${info('Owner', page.owner)}
        ${info('Created', page.createdAt ? new Date(page.createdAt).toLocaleString() : '')}
        ${info('Updated', page.updatedAt ? new Date(page.updatedAt).toLocaleString() : '')}
        ${Object.entries(page.extraMetadata || {}).map(([key, value]) => info(key, value))}
      </div>
    `;
  }

  renderPageActions() {
    const host = this.host;
    const system = host.page?.owner === 'system';
    const hasHead = (this.data?.locations || []).some(location => location.code && location.name === 'head');
    const action = (icon, label, run, extra = {}) => html`<admin-pb-control slot="right-start" priority="-1" icon="${icon}" label="${label}" ?danger="${extra.danger}" .action="${run}"></admin-pb-control>`;
    return html`
      ${hasHead ? action('code', 'Head code', () => host.openCode('head')) : ''}
      ${action('content_copy', 'Copy page', host.handleCopy)}
      ${system ? '' : action('drive_file_move', 'Move page', host.handleMove)}
      ${system ? '' : action('repeat', 'Replace another page', host.handleReplace)}
      ${system ? '' : action('delete', 'Delete page', host.handleDelete, { danger: true })}
    `;
  }

  render() {
    if(!this.ready) return html`<div class="p">Loading the editor</div>`;
    const host = this.host;
    return html`
      <k-page-builder
        .templates="${this.templates.map(({ name, nodes }) => ({ name, nodes }))}"
        .stylesheets="${SITE_STYLES}"
        @change="${this.handleChange}"
        @saverequest="${this.handleSaveRequest}"
        @template-save="${this.handleTemplateSave}"
        @template-remove="${this.handleTemplateRemove}"
      >
        <admin-pb-control slot="left-end" priority="8" icon="arrow" direction="left" label="Back to the pages" href="/admin/content/pages"></admin-pb-control>
        <admin-pb-control slot="left-end" priority="8" icon="open_in_browser" label="Open the page in a new tab" href="${host.getPageUrl()}" target="_blank"></admin-pb-control>
        ${this.renderLocations()}
        ${this.renderPageActions()}
        ${this.renderPageSettings()}
      </k-page-builder>
    `;
  }
}

customElements.define('admin-page-builder', PageBuilderEditor);
