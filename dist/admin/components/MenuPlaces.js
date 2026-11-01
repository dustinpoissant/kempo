import e from"/kempo-ui/components/ShadowComponent.js";import{html as t,live as a}from"/kempo-ui/lit-all.min.js";import{listMenus as s,assignMenuLocation as o,getAllCurrentUserPermissions as n}from"/kempo/sdk.js";import i from"/kempo-ui/components/Toast.js";export default class l extends e{static properties={loading:{state:!0},menus:{state:!0},locations:{state:!0},canUpdate:{state:!0}};constructor(){super(),this.loading=!0,this.menus=[],this.locations=[],this.canUpdate=!1}async connectedCallback(){super.connectedCallback();const[,e]=await n();this.canUpdate=new Set(e?.permissions??[]).has("system:globals:update"),await this.load()}load=async()=>{const[e,t]=await s();this.loading=!1,e?i.error(e.msg||"Failed to load menus"):(this.menus=t.menus,this.locations=t.locations.filter(e=>e.declared))};handleChange=async(e,t)=>{const a=t.target,s=a.value,n=s?this.menus.find(e=>e.id===s).name:"nothing";a.disabled=!0;const[l]=await o({location:e.location,menuId:s});if(a.disabled=!1,l)return i.error(l.msg||"That did not work"),void await this.load();i.success(`${e.label} now shows ${n}`),await this.load(),this.dispatchEvent(new CustomEvent("placesChanged",{bubbles:!0}))};render(){return this.loading?t`<p>Loading...</p>`:t`
      <h2>Locations</h2>
      ${this.locations.length?t`
        <p class="tc-muted mb">The locations in your theme that can show a menu, and the menu each one shows. A location shows one menu at a time; None leaves it empty.</p>
        ${this.locations.map(e=>t`
          <label class="d-b mb">${e.label}
            <select class="full" ?disabled=${!this.canUpdate} @change=${t=>this.handleChange(e,t)}>
              <option value="" .selected=${a(!e.menuId)}>None</option>
              ${this.menus.map(s=>t`<option value=${s.id} .selected=${a(e.menuId===s.id)}>${s.name}</option>`)}
            </select>
          </label>
        `)}
      `:t`<p class="tc-muted">Your theme has no locations for a menu yet. Mark one with <code>&lt;location name="footer-links" label="Footer" menu="true" /&gt;</code>.</p>`}
    `}}customElements.define("admin-menu-places",l);
//# sourceMappingURL=C:\Users\dusti\dev\kempo\dist\admin\components\MenuPlaces.js.map