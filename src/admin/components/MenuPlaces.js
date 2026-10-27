import ShadowComponent from '/kempo-ui/components/ShadowComponent.js';
import { html, live } from '/kempo-ui/lit-all.min.js';
import { listMenus, assignMenuLocation, getAllCurrentUserPermissions } from '/kempo/sdk.js';
import Toast from '/kempo-ui/components/Toast.js';

/*
  The places in the theme that can show a menu, and the menu each one shows. A change is saved as soon as it is picked, and
  `placesChanged` tells the menus table to reload, since a menu's places are listed there.
*/
export default class MenuPlaces extends ShadowComponent {
  static properties = {
    loading: { state: true },
    menus: { state: true },
    locations: { state: true },
    canUpdate: { state: true }
  };

  constructor(){
    super();
    this.loading = true;
    this.menus = [];
    this.locations = [];
    this.canUpdate = false;
  }

  /*
    Lifecycle Callbacks
  */

  async connectedCallback(){
    super.connectedCallback();
    const [, permData] = await getAllCurrentUserPermissions();
    this.canUpdate = new Set(permData?.permissions ?? []).has('system:globals:update');
    await this.load();
  }

  /*
    Data
  */

  load = async () => {
    const [error, data] = await listMenus();
    this.loading = false;
    if(error){
      Toast.error(error.msg || 'Failed to load menus');
      return;
    }
    this.menus = data.menus;
    this.locations = data.locations.filter(l => l.declared);
  };

  /*
    Event Handlers
  */

  handleChange = async (place, e) => {
    const select = e.target;
    const menuId = select.value;
    const name = menuId ? this.menus.find(m => m.id === menuId).name : 'nothing';
    select.disabled = true;
    const [error] = await assignMenuLocation({ location: place.location, menuId });
    select.disabled = false;
    if(error){
      Toast.error(error.msg || 'That did not work');
      await this.load();
      return;
    }
    Toast.success(`${place.label} now shows ${name}`);
    await this.load();
    this.dispatchEvent(new CustomEvent('placesChanged', { bubbles: true }));
  };

  /*
    Rendering
  */

  render(){
    if(this.loading) return html`<p>Loading...</p>`;
    return html`
      <h2>Locations</h2>
      ${this.locations.length ? html`
        <p class="tc-muted mb">The locations in your theme that can show a menu, and the menu each one shows. A location shows one menu at a time; None leaves it empty.</p>
        ${this.locations.map(place => html`
          <label class="d-b mb">${place.label}
            <select class="full" ?disabled=${!this.canUpdate} @change=${e => this.handleChange(place, e)}>
              <option value="" .selected=${live(!place.menuId)}>None</option>
              ${this.menus.map(m => html`<option value=${m.id} .selected=${live(place.menuId === m.id)}>${m.name}</option>`)}
            </select>
          </label>
        `)}
      ` : html`<p class="tc-muted">Your theme has no locations for a menu yet. Mark one with <code>&lt;location name="footer-links" label="Footer" menu="true" /&gt;</code>.</p>`}
    `;
  }
}

customElements.define('admin-menu-places', MenuPlaces);
