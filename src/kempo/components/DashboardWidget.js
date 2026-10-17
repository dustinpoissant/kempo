import LightComponent from '/kempo-ui/components/LightComponent.js';
import { html, nothing } from '/kempo-ui/lit-all.min.js';
import '/kempo-ui/components/Icon.js';
import Dialog from '/kempo-ui/components/Dialog.js';
import { currentUserHasPermission } from '/kempo/sdk.js';

/*
  The base class for an admin dashboard widget. Extend it, define your element, and register the widget
  with `registerDashboardWidget` (or `kempo.widgets` in package.json).

  The dashboard creates the element only when the user has the widget on screen, and sets `width` and
  `height` (in blocks) on it, so a widget never loads data for a tile that is hidden. Override:

    `load()`           fetch what the widget needs and assign it to reactive properties. Throw to show
                       the failure message with a retry button. Runs when the element connects and
                       again on `refresh()`.
    `renderContent()`  return the markup for a loaded widget. Use `width` and `height` to show more
                       when there is room.

  Declare your own properties by spreading the base ones:
  `static properties = { ...DashboardWidget.properties, items: { state: true } }`.

  The widget fills a bordered tile and owns everything inside it, its header included. `renderHeader()`
  returns the header region; the default is the widget's icon and title from `definition` (the registered
  widget, set by the dashboard). Override it to add buttons, filters or a different title, and use
  `renderTitle()` to keep the default title inside your own header.

  Call to action. A widget may offer one primary thing to do, drawn the same way in every tile as a button
  in a footer. It is optional. Set `this.cta` in the constructor (or override `getCta()` when it depends on
  state) to `{ label, icon, href }` for a link, or `{ label, icon, onClick }` for a callback, and add
  `permission` to show it only to people who hold that permission. For a callback that needs input, call
  `openForm()` to get a standard dialog.

  Header actions are separate: links declared on the registration (`actions`), or returned from
  `actions()`, appear as small buttons beside the title.

  Call `super.updated(changed)` if you override `updated()`.
*/
export default class DashboardWidget extends LightComponent {
  static properties = {
    width: { type: Number, reflect: true },
    height: { type: Number, reflect: true },
    definition: { attribute: false },
    loading: { state: true },
    failure: { state: true },
    ctaAllowed: { state: true }
  };

  constructor(){
    super();
    this.width = 2;
    this.height = 1;
    this.definition = null;
    this.cta = null;
    this.loading = true;
    this.failure = '';
    this.ctaAllowed = false;
  }

  /*
    Lifecycle Callbacks
  */

  connectedCallback(){
    super.connectedCallback();
    this.classList.add('d-b');
    this.style.height = '100%';
    this.refresh();
    this.checkCta();
  }

  /*
    Public Methods
  */

  load = async () => {};

  refresh = async () => {
    try {
      await this.load();
      this.failure = '';
    } catch(error) {
      this.failure = error?.message || 'Could not load this widget.';
    }
    this.loading = false;
  };

  getCta(){
    return this.cta;
  }

  actions(){
    return [];
  }

  /*
    Resolves an SDK call, which returns `[error, data]`, to its data, or throws the error's message so
    `load()` can stay a straight line.
  */
  unwrap = async request => {
    const [error, data] = await request;
    if(error) throw new Error(error.msg || 'Request failed');
    return data;
  };

  /*
    Opens a standard dialog with a few fields and a confirm button.

    `fields` are `{ name, label, type, placeholder, value, options, required }` where `type` is `text`
    (default), `email`, `password` or `select` (then `options` is `[{ value, label }]`). `submit` receives
    `{ [name]: value }` and returns nothing on success, which closes the dialog, or an error message, which
    is shown in the dialog and keeps it open with what was typed.
  */
  openForm = ({ title, fields, confirmText = 'Save', submit }) => {
    const content = document.createElement('div');
    content.className = 'p';
    const inputs = {};

    fields.forEach(({ name, label, type = 'text', placeholder = '', value = '', options = [] }) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'mb';
      const caption = Object.assign(document.createElement('label'), { className: 'd-b mbq', textContent: label });
      let input;

      if(type === 'select'){
        input = document.createElement('select');
        input.className = 'full';
        options.forEach(option => input.append(Object.assign(document.createElement('option'), { value: option.value, textContent: option.label, selected: option.value === value })));
      } else {
        input = Object.assign(document.createElement('input'), { type, className: 'full', placeholder, value });
      }

      inputs[name] = input;
      wrapper.append(caption, input);
      content.append(wrapper);
    });

    const error = Object.assign(document.createElement('p'), { className: 'tc-danger m0', role: 'alert' });
    content.append(error);

    const dialog = Dialog.create(content, {
      title,
      confirmText,
      cancelText: 'Cancel',
      confirmAction: async event => {
        event.keepDialogOpen = true;
        error.textContent = '';
        const values = Object.fromEntries(fields.map(({ name }) => [name, inputs[name].value.trim()]));
        const missing = fields.find(({ name, required = true }) => required && !values[name]);

        if(missing){
          error.textContent = `${missing.label} is required.`;
          return;
        }

        const message = await submit(values);

        if(message) error.textContent = message;
        else dialog.close();
      }
    });

    Object.values(inputs)[0]?.focus();
    return dialog;
  };

  /*
    Utility Functions
  */

  checkCta = async () => {
    const permission = this.getCta()?.permission;

    if(!permission){
      this.ctaAllowed = true;
      return;
    }

    const [error, data] = await currentUserHasPermission({ permission });
    this.ctaAllowed = !error && !!data?.hasPermission;
  };

  /*
    Rendering
  */

  renderTitle = () => html`
    ${this.definition?.iconSrc ? html`<k-icon class="mr" src=${this.definition.iconSrc}></k-icon>` : this.definition?.icon ? html`<k-icon class="mr" name=${this.definition.icon}></k-icon>` : nothing}
    <strong class="flex">${this.definition?.title ?? ''}</strong>
  `;

  renderActions = () => {
    const compact = this.width < 2;
    return [...(this.definition?.actions ?? []), ...this.actions()].map(({ label, icon, iconSrc, href, onClick, primary }) => {
      const content = iconSrc || icon
        ? html`${iconSrc ? html`<k-icon src=${iconSrc}></k-icon>` : html`<k-icon name=${icon}></k-icon>`}${compact ? nothing : html` ${label}`}`
        : label;
      const classes = `btn ml ${primary ? 'primary' : ''}`;
      return href
        ? html`<a class=${classes} href=${href} title=${label} aria-label=${label}>${content}</a>`
        : html`<button class=${classes} title=${label} aria-label=${label} @click=${onClick}>${content}</button>`;
    });
  };

  renderHeader(){
    return html`<header class="d-f px pyh bb" style="align-items: center;">${this.renderTitle()}${this.renderActions()}</header>`;
  }

  renderContent(){
    return nothing;
  }

  renderBody(){
    if(this.failure){
      return html`
        <p class="tc-danger" role="alert">${this.failure}</p>
        <button @click=${this.refresh}>Try again</button>
      `;
    }
    if(this.loading) return html`<p class="tc-muted">Loading&hellip;</p>`;
    return this.renderContent();
  }

  renderFooter = () => {
    const cta = this.getCta();

    if(!cta || !this.ctaAllowed || this.failure) return nothing;

    const content = html`${cta.iconSrc ? html`<k-icon src=${cta.iconSrc}></k-icon> ` : cta.icon ? html`<k-icon name=${cta.icon}></k-icon> ` : nothing}${cta.label}`;

    return html`
      <footer class="d-f px pyh bt" style="justify-content: flex-end;">
        ${cta.href
          ? html`<a class="btn primary" href=${cta.href}>${content}</a>`
          : html`<button class="primary" @click=${cta.onClick}>${content}</button>`}
      </footer>
    `;
  };

  renderLightDom(){
    return html`
      <div style="display: flex; flex-direction: column; height: 100%; min-height: 0;">
        ${this.renderHeader()}
        <div class="p" style="flex: 1; min-height: 0; overflow: auto;">${this.renderBody()}</div>
        ${this.renderFooter()}
      </div>
    `;
  }
}
