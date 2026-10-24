import e from"/kempo-ui/components/ShadowComponent.js";import{html as t,nothing as n,live as a}from"/kempo-ui/lit-all.min.js";import{listMenus as s,deleteMenu as i,assignMenuLocation as l,saveMenuItem as o,deleteMenuItems as d,setMenuItemEnabled as c,reorderMenuItems as m,adoptMenuItem as r,getAllCurrentUserPermissions as h}from"/kempo/sdk.js";import u from"/kempo-ui/components/Dialog.js";import p from"/kempo-ui/components/Toast.js";import"/kempo-ui/components/Icon.js";import"/kempo-ui/components/Sortable.js";import"/kempo-ui/components/Combobox.js";export default class b extends e{static properties={loading:{state:!0},failed:{state:!0},menus:{state:!0},locations:{state:!0},navItems:{state:!0},can:{state:!0}};constructor(){super(),this.loading=!0,this.failed=!1,this.menus=[],this.locations=[],this.navItems=[],this.can={create:!1,update:!1,delete:!1},this.pages=[]}async connectedCallback(){super.connectedCallback();const[,e]=await h(),t=new Set(e?.permissions??[]);this.can={create:t.has("system:globals:create"),update:t.has("system:globals:update"),delete:t.has("system:globals:delete")},await this.load()}load=async()=>{const[e,t]=await s();this.loading=!1,this.failed=Boolean(e),e?p.error(e.msg||"Failed to load menus"):(this.menus=t.menus,this.locations=t.locations,this.navItems=t.navItems,this.pages=t.pages??[])};run=async(e,t)=>{const[n]=await e;return n?(p.error(n.msg||"That did not work"),await this.load(),!1):(t&&p.success(t),await this.load(),!0)};get pageOptions(){return this.pages.map(e=>({value:e.url,label:`${e.title} (${e.url})`}))}iconOf=e=>e.navItem?this.navItems.find(t=>t.key===e.navItem)?.icon:e.icon;iconSrcOf=e=>e.navItem?this.navItems.find(t=>t.key===e.navItem)?.iconSrc:"";menuAt=e=>this.menus.find(t=>t.id===e.menuId);otherPlaces=e=>this.locations.filter(t=>t.menuId&&t.menuId===e.menuId&&t!==e);handleSort=async e=>{const t=e.currentTarget,n=[...t.querySelectorAll("k-sortable-item")].map(e=>e.dataset.id);await this.run(m({menuId:t.dataset.menu,ids:n}))};handleToggle=e=>this.run(c({id:e.id,enabled:e.disabled}));handleDeleteItem=e=>u.confirm(`Delete "${e.label}" from the menu?`,async t=>{t&&await this.run(d([e.id]),"Item deleted")});handleDeleteMenu=e=>u.confirm(`Delete the unused "${e.name}" menu and its ${e.items.length} item${1===e.items.length?"":"s"}? This cannot be undone.`,async t=>{t&&await this.run(i(e.id),"Menu deleted")});handleMenuChange=(e,t)=>this.run(l({location:e.location,menuId:t.target.value}));handleAdopt=(e,t)=>this.run(r({id:t.id,menuName:e.label}),`"${t.label}" can now be reordered and edited here`);showKind=(e,t)=>{const n=this.navItems.find(e=>e.key===t);e.querySelector("#menu-link-fields").hidden=Boolean(n);const a=e.querySelector("#menu-kind-description");a.hidden=!n,a.textContent=n?n.description||`${n.label} from ${n.extension}.`:""};openLinkEditor=(e,a)=>{const s=Boolean(a),i=u.create(t`
      <div class="p">
        ${!s&&this.navItems.length?t`
          <div class="mb">
            <label class="d-b mbq" for="menu-kind">What to add<small class="d-b tc-muted">A link to a page or address, or something an installed extension offers, such as a cart.</small></label>
            <select id="menu-kind" class="full" @change=${e=>this.showKind(i,e.target.value)}>
              <option value="">A link</option>
              ${[...new Set(this.navItems.map(e=>e.extension))].map(e=>t`
                <optgroup label=${"kempo"===e?"Built in":e}>
                  ${this.navItems.filter(t=>t.extension===e).map(e=>t`<option value=${e.key}>${e.label}</option>`)}
                </optgroup>
              `)}
            </select>
          </div>
          <p id="menu-kind-description" class="tc-muted mb" hidden></p>
        `:n}
        <div id="menu-link-fields">
        <div class="mb">
          <label class="d-b mbq" for="menu-label">Label</label>
          <input type="text" id="menu-label" class="full" placeholder="About" .value=${a?.label??""}>
        </div>
        <div class="mb">
          <label class="d-b mbq" for="menu-href">Link<small class="d-b tc-muted">Choose one of your pages, or type any address.</small></label>
          <div id="menu-href-wrap"></div>
        </div>
        <div class="mb">
          <label class="d-b mbq" for="menu-icon">Icon (optional)<small class="d-b tc-muted">The name of an icon, such as <strong>home</strong> or <strong>star</strong>.</small></label>
          <input type="text" id="menu-icon" class="full" .value=${a?.icon??""}>
        </div>
        <label class="checkbox"><input type="checkbox" id="menu-new-tab" ?checked=${a?.newTab}> Open in a new tab</label>
        </div>
      </div>
    `,{title:s?"Edit link":`Add an item to ${e.label}`,confirmText:s?"Save":"Add item",cancelText:"Cancel",confirmAction:async()=>{const t=i.querySelector("#menu-href").value,n=i.querySelector("#menu-kind")?.value;await this.run(o(n?{location:e.location,navItem:n}:{id:a?.id,location:e.location,label:i.querySelector("#menu-label").value,href:this.pageOptions.find(e=>e.label===t)?.value??t,icon:i.querySelector("#menu-icon").value.trim(),newTab:i.querySelector("#menu-new-tab").checked}),s?"Link saved":"Item added")&&i.close()}}),l=document.createElement("k-combobox");l.id="menu-href",l.className="full",l.setAttribute("placeholder","/about"),l.setOptions(this.pageOptions),i.querySelector("#menu-href-wrap").appendChild(l),a?.href&&(l.value=a.href)};renderLink(e,a){const s=t`
      <div class="d-f" style="align-items: center; gap: var(--spacer_h);">
        <div class="flex">
          <strong class=${a.disabled||!a.available?"tc-muted":""}>${this.iconSrcOf(a)?t`<k-icon src=${this.iconSrcOf(a)}></k-icon> `:this.iconOf(a)?t`<k-icon name=${this.iconOf(a)}></k-icon> `:n}${a.label}</strong>
          <span class="tc-muted"> ${a.navItem?a.navItem.startsWith("kempo:")?"built in":`from ${a.navItem.split(":")[0]}`:a.href}</span>
          ${a.available?n:t`<span class="tc-danger"> not on the site: its extension is disabled or removed</span>`}
          ${a.newTab?t`<k-icon name="open_in_new"></k-icon>`:n}
          ${a.disabled?t`<span class="tc-muted"> (hidden)</span>`:n}
        </div>
        ${this.can.update?t`
          <div>
            ${a.editable?t`<button class="btn" title="Edit" @click=${()=>this.openLinkEditor(e,a)}><k-icon name="edit"></k-icon></button>`:n}
            <button class="btn" title=${a.disabled?"Show on the site":"Hide from the site"} @click=${()=>this.handleToggle(a)}><k-icon name=${a.disabled?"show":"hide"}></k-icon></button>
            ${this.can.delete?t`<button class="btn danger" title="Delete" @click=${()=>this.handleDeleteItem(a)}><k-icon name="delete"></k-icon></button>`:n}
          </div>
        `:n}
      </div>
    `;return this.can.update?t`<k-sortable-item data-id=${a.id}>${s}</k-sortable-item>`:t`<div class="b p mbq">${s}</div>`}renderPlace(e){const s=this.menuAt(e),i=this.otherPlaces(e);return t`
      <div class="mb">
        <div class="d-f mb" style="align-items: center; gap: var(--spacer_h);">
          <div class="flex">
            <h2 class="mb0">${e.label}</h2>
            ${e.declared?n:t`<span class="tc-danger">The theme no longer has this place (<strong>${e.location}</strong>), so nothing shows there.</span>`}
            ${i.length?t`<span class="tc-muted">Shows the same links as ${i.map(e=>e.label).join(", ")}.</span>`:n}
          </div>
          ${this.can.create&&e.declared?t`<button class="primary" @click=${()=>this.openLinkEditor(e)}><k-icon name="add"></k-icon> Add item</button>`:n}
        </div>
        ${s?.items.length?t`
          <k-sortable data-menu=${s.id} @sort=${this.handleSort}>
            ${s.items.map(t=>this.renderLink(e,t))}
          </k-sortable>
        `:n}
        ${e.extensionItems.map(e=>t`
          <div class="b p mbq"><strong>${e.label}</strong> <span class="tc-muted">${e.href} · added by ${e.owner}</span></div>
        `)}
        ${e.candidates.map(a=>t`
          <div class="b p mbq d-f" style="align-items: center; gap: var(--spacer_h);">
            <div class="flex"><strong>${a.label}</strong> <span class="tc-muted">${a.href} · added as global content</span></div>
            ${this.can.update?t`<button class="btn" @click=${()=>this.handleAdopt(e,a)}>Manage here</button>`:n}
          </div>
        `)}
        ${s?.items.length||e.extensionItems.length||e.candidates.length?n:t`<p class="tc-muted">Nothing here yet.</p>`}
        ${this.can.update&&this.menus.length>1?t`
          <label class="d-b mtq tc-muted">Show the links of another place here
            <select @change=${t=>this.handleMenuChange(e,t)}>
              <option value="" .selected=${a(!e.menuId)}>This place's own links</option>
              ${this.menus.map(n=>t`<option value=${n.id} .selected=${a(e.menuId===n.id)}>${n.name}</option>`)}
            </select>
          </label>
        `:n}
      </div>
    `}renderUnused(){const e=this.menus.filter(e=>!e.locations.length);return e.length?t`
      <h2>Not shown anywhere</h2>
      <p class="tc-muted">These menus are not shown in any place. Pick one in a place's dropdown above to use it again, or delete it.</p>
      ${e.map(e=>t`
        <div class="b p mbq d-f" style="align-items: center; gap: var(--spacer_h);">
          <div class="flex"><strong>${e.name}</strong> <span class="tc-muted">${e.items.length} item${1===e.items.length?"":"s"}</span></div>
          ${this.can.delete?t`<button class="btn danger" title="Delete menu" @click=${()=>this.handleDeleteMenu(e)}><k-icon name="delete"></k-icon></button>`:n}
        </div>
      `)}
    `:n}render(){return this.loading?t`<p>Loading...</p>`:this.failed?t`<h1>Menus</h1><p class="tc-danger">The menus could not be loaded.</p>`:t`
      <h1>Menus</h1>
      ${this.locations.length?t`
        ${this.locations.map(e=>this.renderPlace(e))}
        ${this.renderUnused()}
      `:t`
        <p>Your theme does not have a place for a menu yet.</p>
        <p class="tc-muted">Mark a place in your navigation, for example <code>&lt;location name="main-nav-links" label="Main menu" menu="true" /&gt;</code> in your navigation fragment, and it will be listed here.</p>
      `}
    `}}customElements.define("admin-menus",b);
//# sourceMappingURL=c:\Users\dusti\dev\kempo\dist\admin\components\Menus.js.map