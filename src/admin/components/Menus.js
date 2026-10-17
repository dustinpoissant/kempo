import ShadowComponent from '/kempo-ui/components/ShadowComponent.js';
import { html, nothing, live } from '/kempo-ui/lit-all.min.js';
import {
  listMenus, deleteMenu, assignMenuLocation,
  saveMenuItem, deleteMenuItems, setMenuItemEnabled, reorderMenuItems, adoptMenuItem,
  getAllCurrentUserPermissions
} from '/kempo/sdk.js';
import Dialog from '/kempo-ui/components/Dialog.js';
import Toast from '/kempo-ui/components/Toast.js';
import '/kempo-ui/components/Icon.js';
import '/kempo-ui/components/Sortable.js';
import '/kempo-ui/components/Combobox.js';

/*
  The places in the theme that show a menu (marked `menu="true"`, see Menus in the docs), each with
  its links. Adding a link to a place is the whole job: the menu behind it is made on the first one.
  A place can show another place's links instead, and a menu that no place shows is listed at the end.
  Both are saved as ordinary global content, so nothing here needs the theme to know about menus.
*/
export default class Menus extends ShadowComponent {
  static properties = {
    loading: { state: true },
    failed: { state: true },
    menus: { state: true },
    locations: { state: true },
    navItems: { state: true },
    can: { state: true }
  };

  constructor(){
    super();
    this.loading = true;
    this.failed = false;
    this.menus = [];
    this.locations = [];
    this.navItems = [];
    this.can = { create: false, update: false, delete: false };
    this.pages = [];
  }

  /*
    Lifecycle Callbacks
  */

  async connectedCallback(){
    super.connectedCallback();
    const [, permData] = await getAllCurrentUserPermissions();
    const perms = new Set(permData?.permissions ?? []);
    this.can = {
      create: perms.has('system:globals:create'),
      update: perms.has('system:globals:update'),
      delete: perms.has('system:globals:delete')
    };
    await this.load();
  }

  /*
    Data
  */

  load = async () => {
    const [error, data] = await listMenus();
    this.loading = false;
    this.failed = Boolean(error);
    if(error){
      Toast.error(error.msg || 'Failed to load menus');
      return;
    }
    this.menus = data.menus;
    this.locations = data.locations;
    this.navItems = data.navItems;
    this.pages = data.pages ?? [];
  };

  run = async (request, success) => {
    const [error] = await request;
    if(error){
      Toast.error(error.msg || 'That did not work');
      await this.load();
      return false;
    }
    if(success) Toast.success(success);
    await this.load();
    return true;
  };

  /* Every page a link can go to, the site's and its extensions' (/products/, /categories/), for the Link box. */
  get pageOptions(){
    return this.pages.map(page => ({ value: page.url, label: `${page.title} (${page.url})` }));
  }

  iconOf = item => item.navItem ? this.navItems.find(n => n.key === item.navItem)?.icon : item.icon;

  iconSrcOf = item => item.navItem ? this.navItems.find(n => n.key === item.navItem)?.iconSrc : '';

  menuAt = place => this.menus.find(m => m.id === place.menuId);

  otherPlaces = place => this.locations.filter(l => l.menuId && l.menuId === place.menuId && l !== place);

  /*
    Event Handlers
  */

  handleSort = async e => {
    const list = e.currentTarget;
    const ids = [...list.querySelectorAll('k-sortable-item')].map(item => item.dataset.id);
    await this.run(reorderMenuItems({ menuId: list.dataset.menu, ids }));
  };

  handleToggle = item => this.run(setMenuItemEnabled({ id: item.id, enabled: item.disabled }));

  handleDeleteItem = item => Dialog.confirm(`Delete "${item.label}" from the menu?`, async confirmed => {
    if(confirmed) await this.run(deleteMenuItems([item.id]), 'Item deleted');
  });

  handleDeleteMenu = menu => Dialog.confirm(
    `Delete the unused "${menu.name}" menu and its ${menu.items.length} item${menu.items.length === 1 ? '' : 's'}? This cannot be undone.`,
    async confirmed => {
      if(confirmed) await this.run(deleteMenu(menu.id), 'Menu deleted');
    }
  );

  handleMenuChange = (place, e) => this.run(assignMenuLocation({ location: place.location, menuId: e.target.value }));

  handleAdopt = (place, item) => this.run(adoptMenuItem({ id: item.id, menuName: place.label }), `"${item.label}" can now be reordered and edited here`);

  showKind = ($dialog, key) => {
    const supplied = this.navItems.find(n => n.key === key);
    $dialog.querySelector('#menu-link-fields').hidden = Boolean(supplied);
    const $description = $dialog.querySelector('#menu-kind-description');
    $description.hidden = !supplied;
    $description.textContent = supplied ? supplied.description || `${supplied.label} from ${supplied.extension}.` : '';
  };

  openLinkEditor = (place, item) => {
    const editing = Boolean(item);
    const $dialog = Dialog.create(html`
      <div class="p">
        ${!editing && this.navItems.length ? html`
          <div class="mb">
            <label class="d-b mbq" for="menu-kind">What to add<small class="d-b tc-muted">A link to a page or address, or something an installed extension offers, such as a cart.</small></label>
            <select id="menu-kind" class="full" @change=${e => this.showKind($dialog, e.target.value)}>
              <option value="">A link</option>
              ${[...new Set(this.navItems.map(n => n.extension))].map(extension => html`
                <optgroup label=${extension === 'kempo' ? 'Built in' : extension}>
                  ${this.navItems.filter(n => n.extension === extension).map(n => html`<option value=${n.key}>${n.label}</option>`)}
                </optgroup>
              `)}
            </select>
          </div>
          <p id="menu-kind-description" class="tc-muted mb" hidden></p>
        ` : nothing}
        <div id="menu-link-fields">
        <div class="mb">
          <label class="d-b mbq" for="menu-label">Label</label>
          <input type="text" id="menu-label" class="full" placeholder="About" .value=${item?.label ?? ''}>
        </div>
        <div class="mb">
          <label class="d-b mbq" for="menu-href">Link<small class="d-b tc-muted">Choose one of your pages, or type any address.</small></label>
          <div id="menu-href-wrap"></div>
        </div>
        <div class="mb">
          <label class="d-b mbq" for="menu-icon">Icon (optional)<small class="d-b tc-muted">The name of an icon, such as <strong>home</strong> or <strong>star</strong>.</small></label>
          <input type="text" id="menu-icon" class="full" .value=${item?.icon ?? ''}>
        </div>
        <label class="checkbox"><input type="checkbox" id="menu-new-tab" ?checked=${item?.newTab}> Open in a new tab</label>
        </div>
      </div>
    `, {
      title: editing ? 'Edit link' : `Add an item to ${place.label}`,
      confirmText: editing ? 'Save' : 'Add item',
      cancelText: 'Cancel',
      confirmAction: async () => {
        // A combobox reports the label of a chosen option, so a chosen page is mapped back to its address.
        const chosen = $dialog.querySelector('#menu-href').value;
        const navItem = $dialog.querySelector('#menu-kind')?.value;
        const saved = await this.run(navItem ? saveMenuItem({ location: place.location, navItem }) : saveMenuItem({
          id: item?.id,
          location: place.location,
          label: $dialog.querySelector('#menu-label').value,
          href: this.pageOptions.find(o => o.label === chosen)?.value ?? chosen,
          icon: $dialog.querySelector('#menu-icon').value.trim(),
          newTab: $dialog.querySelector('#menu-new-tab').checked
        }), editing ? 'Link saved' : 'Item added');
        if(saved) $dialog.close();
      }
    });

    const $href = document.createElement('k-combobox');
    $href.id = 'menu-href';
    $href.className = 'full';
    $href.setAttribute('placeholder', '/about');
    $href.setOptions(this.pageOptions);
    $dialog.querySelector('#menu-href-wrap').appendChild($href);
    if(item?.href) $href.value = item.href;
  };

  /*
    Rendering
  */

  renderLink(place, item){
    const body = html`
      <div class="d-f" style="align-items: center; gap: var(--spacer_h);">
        <div class="flex">
          <strong class=${item.disabled || !item.available ? 'tc-muted' : ''}>${this.iconSrcOf(item) ? html`<k-icon src=${this.iconSrcOf(item)}></k-icon> ` : this.iconOf(item) ? html`<k-icon name=${this.iconOf(item)}></k-icon> ` : nothing}${item.label}</strong>
          <span class="tc-muted"> ${item.navItem ? (item.navItem.startsWith('kempo:') ? 'built in' : `from ${item.navItem.split(':')[0]}`) : item.href}</span>
          ${item.available ? nothing : html`<span class="tc-danger"> not on the site: its extension is disabled or removed</span>`}
          ${item.newTab ? html`<k-icon name="open_in_new"></k-icon>` : nothing}
          ${item.disabled ? html`<span class="tc-muted"> (hidden)</span>` : nothing}
        </div>
        ${this.can.update ? html`
          <div>
            ${item.editable ? html`<button class="btn" title="Edit" @click=${() => this.openLinkEditor(place, item)}><k-icon name="edit"></k-icon></button>` : nothing}
            <button class="btn" title=${item.disabled ? 'Show on the site' : 'Hide from the site'} @click=${() => this.handleToggle(item)}><k-icon name=${item.disabled ? 'show' : 'hide'}></k-icon></button>
            ${this.can.delete ? html`<button class="btn danger" title="Delete" @click=${() => this.handleDeleteItem(item)}><k-icon name="delete"></k-icon></button>` : nothing}
          </div>
        ` : nothing}
      </div>
    `;
    return this.can.update
      ? html`<k-sortable-item data-id=${item.id}>${body}</k-sortable-item>`
      : html`<div class="b p mbq">${body}</div>`;
  }

  renderPlace(place){
    const menu = this.menuAt(place);
    const shared = this.otherPlaces(place);
    return html`
      <div class="mb">
        <div class="d-f mb" style="align-items: center; gap: var(--spacer_h);">
          <div class="flex">
            <h2 class="mb0">${place.label}</h2>
            ${place.declared ? nothing : html`<span class="tc-danger">The theme no longer has this place (<strong>${place.location}</strong>), so nothing shows there.</span>`}
            ${shared.length ? html`<span class="tc-muted">Shows the same links as ${shared.map(l => l.label).join(', ')}.</span>` : nothing}
          </div>
          ${this.can.create && place.declared ? html`<button class="primary" @click=${() => this.openLinkEditor(place)}><k-icon name="add"></k-icon> Add item</button>` : nothing}
        </div>
        ${menu?.items.length ? html`
          <k-sortable data-menu=${menu.id} @sort=${this.handleSort}>
            ${menu.items.map(item => this.renderLink(place, item))}
          </k-sortable>
        ` : nothing}
        ${place.extensionItems.map(item => html`
          <div class="b p mbq"><strong>${item.label}</strong> <span class="tc-muted">${item.href} · added by ${item.owner}</span></div>
        `)}
        ${place.candidates.map(item => html`
          <div class="b p mbq d-f" style="align-items: center; gap: var(--spacer_h);">
            <div class="flex"><strong>${item.label}</strong> <span class="tc-muted">${item.href} · added as global content</span></div>
            ${this.can.update ? html`<button class="btn" @click=${() => this.handleAdopt(place, item)}>Manage here</button>` : nothing}
          </div>
        `)}
        ${!menu?.items.length && !place.extensionItems.length && !place.candidates.length ? html`<p class="tc-muted">Nothing here yet.</p>` : nothing}
        ${this.can.update && this.menus.length > 1 ? html`
          <label class="d-b mtq tc-muted">Show the links of another place here
            <select @change=${e => this.handleMenuChange(place, e)}>
              <option value="" .selected=${live(!place.menuId)}>This place's own links</option>
              ${this.menus.map(m => html`<option value=${m.id} .selected=${live(place.menuId === m.id)}>${m.name}</option>`)}
            </select>
          </label>
        ` : nothing}
      </div>
    `;
  }

  renderUnused(){
    const unused = this.menus.filter(m => !m.locations.length);
    if(!unused.length) return nothing;
    return html`
      <h2>Not shown anywhere</h2>
      <p class="tc-muted">These menus are not shown in any place. Pick one in a place's dropdown above to use it again, or delete it.</p>
      ${unused.map(menu => html`
        <div class="b p mbq d-f" style="align-items: center; gap: var(--spacer_h);">
          <div class="flex"><strong>${menu.name}</strong> <span class="tc-muted">${menu.items.length} item${menu.items.length === 1 ? '' : 's'}</span></div>
          ${this.can.delete ? html`<button class="btn danger" title="Delete menu" @click=${() => this.handleDeleteMenu(menu)}><k-icon name="delete"></k-icon></button>` : nothing}
        </div>
      `)}
    `;
  }

  render(){
    if(this.loading) return html`<p>Loading...</p>`;
    if(this.failed) return html`<h1>Menus</h1><p class="tc-danger">The menus could not be loaded.</p>`;
    return html`
      <h1>Menus</h1>
      ${this.locations.length ? html`
        ${this.locations.map(place => this.renderPlace(place))}
        ${this.renderUnused()}
      ` : html`
        <p>Your theme does not have a place for a menu yet.</p>
        <p class="tc-muted">Mark a place in your navigation, for example <code>&lt;location name="main-nav-links" label="Main menu" menu="true" /&gt;</code> in your navigation fragment, and it will be listed here.</p>
      `}
    `;
  }
}

customElements.define('admin-menus', Menus);
