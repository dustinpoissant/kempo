import ShadowComponent from '/kempo-ui/components/ShadowComponent.js';
import { html, nothing, live, repeat } from '/kempo-ui/lit-all.min.js';
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
  One menu and the places that show it, served at /admin/content/menus/[id]/. The id is a menu's id, or a place's name for a place with no menu yet,
  and that menu is made on the first link added. Adding a link to a place is the whole job: the menu
  behind it is made on the first one. Both the links and the places are saved as ordinary global content.
*/
export default class MenuEditor extends ShadowComponent {
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
    this.pages = [];
    this.can = { create: false, update: false, delete: false };
    this.id = decodeURIComponent(location.pathname.split('/admin/content/menus/')[1]?.replace(/\/$/, '') ?? '');
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

  get menu(){
    const menu = this.menus.find(m => m.id === this.id);
    if(menu) return menu;
    return this.place?.menuId ? this.menus.find(m => m.id === this.place.menuId) ?? null : null;
  }

  get place(){
    return this.locations.find(l => l.location === this.id) ?? null;
  }

  /* The places this menu is shown in, or the one place when it has no menu yet. */
  get shownHere(){
    if(this.menu) return this.locations.filter(l => l.menuId === this.menu.id);
    return this.place ? [this.place] : [];
  }

  iconOf = item => item.navItem ? this.navItems.find(n => n.key === item.navItem)?.icon : item.icon;

  iconSrcOf = item => item.navItem ? this.navItems.find(n => n.key === item.navItem)?.iconSrc : '';

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
      if(!confirmed) return;
      const [error] = await deleteMenu(menu.id);
      if(error){
        Toast.error(error.msg || 'That did not work');
        return;
      }
      window.location.href = '/admin/content/menus/';
    }
  );

  handleShowHere = (menu, place, e) => this.run(
    assignMenuLocation({ location: place.location, menuId: e.target.checked ? menu.id : '' }),
    e.target.checked ? `${place.label} now shows ${menu.name}` : `${place.label} no longer shows ${menu.name}`
  );

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
      <div class="d-f full" style="align-items: center; gap: var(--spacer_h);">
        <div class="flex">
          <strong class=${item.disabled || !item.available ? 'tc-muted' : ''}>${this.iconSrcOf(item) ? html`<k-icon src=${this.iconSrcOf(item)}></k-icon> ` : this.iconOf(item) ? html`<k-icon name=${this.iconOf(item)}></k-icon> ` : nothing}${item.label}</strong>
          <span class="tc-muted"> ${item.navItem ? (item.navItem.startsWith('kempo:') ? 'built in' : `from ${item.navItem.split(':')[0]}`) : item.href}</span>
          ${item.available ? nothing : html`<span class="tc-danger"> not on the site: its extension is disabled or removed</span>`}
          ${item.newTab ? html`<k-icon name="open_in_new"></k-icon>` : nothing}
          ${item.disabled ? html`<span class="tc-muted"> (hidden)</span>` : nothing}
        </div>
        ${this.can.update ? html`
          <div>
            ${item.editable && place ? html`<button class="btn" title="Edit" @click=${() => this.openLinkEditor(place, item)}><k-icon name="edit"></k-icon></button>` : nothing}
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

  renderPlaces(menu){
    const places = this.locations.filter(l => l.declared);
    return html`
      <h2>Locations</h2>
      ${places.length ? html`
        <p class="tc-muted mb">Tick the locations in your theme that show this menu. A location shows one menu at a time, so ticking one replaces the menu it showed.</p>
        ${places.map(place => html`
          <label class="checkbox mb">
            <input type="checkbox" ?disabled=${!this.can.update} .checked=${live(place.menuId === menu.id)} @change=${e => this.handleShowHere(menu, place, e)}> ${place.label}
            ${place.menuId && place.menuId !== menu.id ? html`<span class="tc-muted">(now shows ${this.menus.find(m => m.id === place.menuId)?.name})</span>` : nothing}
          </label>
        `)}
      ` : html`<p class="tc-muted">Your theme has no locations for a menu yet.</p>`}
    `;
  }

  renderPlaceExtras(place){
    return html`
      ${place.extensionItems.map(item => html`
        <div class="b p mbq"><strong>${item.label}</strong> <span class="tc-muted">${item.href} · added by ${item.owner}</span></div>
      `)}
      ${place.candidates.map(item => html`
        <div class="b p mbq d-f" style="align-items: center; gap: var(--spacer_h);">
          <div class="flex"><strong>${item.label}</strong> <span class="tc-muted">${item.href} · added as global content in ${place.label}</span></div>
          ${this.can.update ? html`<button class="btn" @click=${() => this.handleAdopt(place, item)}>Manage here</button>` : nothing}
        </div>
      `)}
    `;
  }

  render(){
    if(this.loading) return html`<p>Loading...</p>`;
    if(this.failed) return html`<p class="tc-danger">The menus could not be loaded.</p>`;
    const { menu, place } = this;
    if(!menu && !place) return html`<p>That menu was not found.</p>`;

    const shownHere = this.shownHere;
    const items = menu?.items ?? [];
    const addPlace = shownHere.find(p => p.declared);
    return html`
      <p><a class="btn mb" href="/admin/content/menus/"><k-icon name="arrow" direction="left"></k-icon> Menus</a></p>
      <div class="d-f mb" style="align-items: center; gap: var(--spacer_h);">
        <h1 class="flex mb0">${menu?.name ?? place.label}</h1>
        ${this.can.create && addPlace ? html`<button class="primary" @click=${() => this.openLinkEditor(addPlace)}><k-icon name="add"></k-icon> Add item</button>` : nothing}
      </div>

      ${menu ? this.renderPlaces(menu) : nothing}

      <h2>Links</h2>
      ${items.length ? html`
        <k-sortable data-menu=${menu.id} @sort=${this.handleSort}>
          ${repeat(items, item => item.id, item => this.renderLink(shownHere[0], item))}
        </k-sortable>
      ` : nothing}
      ${shownHere.map(p => this.renderPlaceExtras(p))}
      ${!items.length && !shownHere.some(p => p.extensionItems.length || p.candidates.length) ? html`<p class="tc-muted">Nothing here yet.</p>` : nothing}
      ${!shownHere.length && menu ? html`<p class="tc-muted">This menu is not shown anywhere, so its links cannot be added to. Tick a place above to show it.</p>` : nothing}

      ${this.can.delete && menu && !shownHere.length ? html`
        <p class="mt"><button class="danger" @click=${() => this.handleDeleteMenu(menu)}><k-icon name="delete"></k-icon> Delete this menu</button></p>
      ` : nothing}
    `;
  }
}

customElements.define('admin-menu-editor', MenuEditor);
