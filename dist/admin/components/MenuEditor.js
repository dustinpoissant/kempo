import e from"/kempo-ui/components/ShadowComponent.js";import{html as t,nothing as n,live as a,repeat as s}from"/kempo-ui/lit-all.min.js";import{listMenus as i,deleteMenu as l,assignMenuLocation as o,saveMenuItem as d,deleteMenuItems as c,setMenuItemEnabled as r,reorderMenuItems as m,adoptMenuItem as h,getAllCurrentUserPermissions as u}from"/kempo/sdk.js";import p from"/kempo-ui/components/Dialog.js";import b from"/kempo-ui/components/Toast.js";import"/kempo-ui/components/Icon.js";import"/kempo-ui/components/Sortable.js";import"/kempo-ui/components/Combobox.js";export default class k extends e{static properties={loading:{state:!0},failed:{state:!0},menus:{state:!0},locations:{state:!0},navItems:{state:!0},can:{state:!0}};constructor(){super(),this.loading=!0,this.failed=!1,this.menus=[],this.locations=[],this.navItems=[],this.pages=[],this.can={create:!1,update:!1,delete:!1},this.id=decodeURIComponent(location.pathname.split("/admin/content/menus/")[1]?.replace(/\/$/,"")??"")}async connectedCallback(){super.connectedCallback();const[,e]=await u(),t=new Set(e?.permissions??[]);this.can={create:t.has("system:globals:create"),update:t.has("system:globals:update"),delete:t.has("system:globals:delete")},await this.load()}load=async()=>{const[e,t]=await i();this.loading=!1,this.failed=Boolean(e),e?b.error(e.msg||"Failed to load menus"):(this.menus=t.menus,this.locations=t.locations,this.navItems=t.navItems,this.pages=t.pages??[])};run=async(e,t)=>{const[n]=await e;return n?(b.error(n.msg||"That did not work"),await this.load(),!1):(t&&b.success(t),await this.load(),!0)};get pageOptions(){return this.pages.map(e=>({value:e.url,label:`${e.title} (${e.url})`}))}get menu(){const e=this.menus.find(e=>e.id===this.id);return e||(this.place?.menuId?this.menus.find(e=>e.id===this.place.menuId)??null:null)}get place(){return this.locations.find(e=>e.location===this.id)??null}get shownHere(){return this.menu?this.locations.filter(e=>e.menuId===this.menu.id):this.place?[this.place]:[]}iconOf=e=>e.navItem?this.navItems.find(t=>t.key===e.navItem)?.icon:e.icon;iconSrcOf=e=>e.navItem?this.navItems.find(t=>t.key===e.navItem)?.iconSrc:"";handleSort=async e=>{const t=e.currentTarget,n=[...t.querySelectorAll("k-sortable-item")].map(e=>e.dataset.id);await this.run(m({menuId:t.dataset.menu,ids:n}))};handleToggle=e=>this.run(r({id:e.id,enabled:e.disabled}));handleDeleteItem=e=>p.confirm(`Delete "${e.label}" from the menu?`,async t=>{t&&await this.run(c([e.id]),"Item deleted")});handleDeleteMenu=e=>p.confirm(`Delete the unused "${e.name}" menu and its ${e.items.length} item${1===e.items.length?"":"s"}? This cannot be undone.`,async t=>{if(!t)return;const[n]=await l(e.id);n?b.error(n.msg||"That did not work"):window.location.href="/admin/content/menus/"});handleShowHere=(e,t,n)=>this.run(o({location:t.location,menuId:n.target.checked?e.id:""}),n.target.checked?`${t.label} now shows ${e.name}`:`${t.label} no longer shows ${e.name}`);handleAdopt=(e,t)=>this.run(h({id:t.id,menuName:e.label}),`"${t.label}" can now be reordered and edited here`);showKind=(e,t)=>{const n=this.navItems.find(e=>e.key===t);e.querySelector("#menu-link-fields").hidden=Boolean(n);const a=e.querySelector("#menu-kind-description");a.hidden=!n,a.textContent=n?n.description||`${n.label} from ${n.extension}.`:""};openLinkEditor=(e,a)=>{const s=Boolean(a),i=p.create(t`
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
    `,{title:s?"Edit link":`Add an item to ${e.label}`,confirmText:s?"Save":"Add item",cancelText:"Cancel",confirmAction:async()=>{const t=i.querySelector("#menu-href").value,n=i.querySelector("#menu-kind")?.value;await this.run(d(n?{location:e.location,navItem:n}:{id:a?.id,location:e.location,label:i.querySelector("#menu-label").value,href:this.pageOptions.find(e=>e.label===t)?.value??t,icon:i.querySelector("#menu-icon").value.trim(),newTab:i.querySelector("#menu-new-tab").checked}),s?"Link saved":"Item added")&&i.close()}}),l=document.createElement("k-combobox");l.id="menu-href",l.className="full",l.setAttribute("placeholder","/about"),l.setOptions(this.pageOptions),i.querySelector("#menu-href-wrap").appendChild(l),a?.href&&(l.value=a.href)};renderLink(e,a){const s=t`
      <div class="d-f full" style="align-items: center; gap: var(--spacer_h);">
        <div class="flex">
          <strong class=${a.disabled||!a.available?"tc-muted":""}>${this.iconSrcOf(a)?t`<k-icon src=${this.iconSrcOf(a)}></k-icon> `:this.iconOf(a)?t`<k-icon name=${this.iconOf(a)}></k-icon> `:n}${a.label}</strong>
          <span class="tc-muted"> ${a.navItem?a.navItem.startsWith("kempo:")?"built in":`from ${a.navItem.split(":")[0]}`:a.href}</span>
          ${a.available?n:t`<span class="tc-danger"> not on the site: its extension is disabled or removed</span>`}
          ${a.newTab?t`<k-icon name="open_in_new"></k-icon>`:n}
          ${a.disabled?t`<span class="tc-muted"> (hidden)</span>`:n}
        </div>
        ${this.can.update?t`
          <div>
            ${a.editable&&e?t`<button class="btn" title="Edit" @click=${()=>this.openLinkEditor(e,a)}><k-icon name="edit"></k-icon></button>`:n}
            <button class="btn" title=${a.disabled?"Show on the site":"Hide from the site"} @click=${()=>this.handleToggle(a)}><k-icon name=${a.disabled?"show":"hide"}></k-icon></button>
            ${this.can.delete?t`<button class="btn danger" title="Delete" @click=${()=>this.handleDeleteItem(a)}><k-icon name="delete"></k-icon></button>`:n}
          </div>
        `:n}
      </div>
    `;return this.can.update?t`<k-sortable-item data-id=${a.id}>${s}</k-sortable-item>`:t`<div class="b p mbq">${s}</div>`}renderPlaces(e){const s=this.locations.filter(e=>e.declared);return t`
      <h2>Locations</h2>
      ${s.length?t`
        <p class="tc-muted mb">Tick the locations in your theme that show this menu. A location shows one menu at a time, so ticking one replaces the menu it showed.</p>
        ${s.map(s=>t`
          <label class="checkbox mb">
            <input type="checkbox" ?disabled=${!this.can.update} .checked=${a(s.menuId===e.id)} @change=${t=>this.handleShowHere(e,s,t)}> ${s.label}
            ${s.menuId&&s.menuId!==e.id?t`<span class="tc-muted">(now shows ${this.menus.find(e=>e.id===s.menuId)?.name})</span>`:n}
          </label>
        `)}
      `:t`<p class="tc-muted">Your theme has no locations for a menu yet.</p>`}
    `}renderPlaceExtras(e){return t`
      ${e.extensionItems.map(e=>t`
        <div class="b p mbq"><strong>${e.label}</strong> <span class="tc-muted">${e.href} · added by ${e.owner}</span></div>
      `)}
      ${e.candidates.map(a=>t`
        <div class="b p mbq d-f" style="align-items: center; gap: var(--spacer_h);">
          <div class="flex"><strong>${a.label}</strong> <span class="tc-muted">${a.href} · added as global content in ${e.label}</span></div>
          ${this.can.update?t`<button class="btn" @click=${()=>this.handleAdopt(e,a)}>Manage here</button>`:n}
        </div>
      `)}
    `}render(){if(this.loading)return t`<p>Loading...</p>`;if(this.failed)return t`<p class="tc-danger">The menus could not be loaded.</p>`;const{menu:e,place:a}=this;if(!e&&!a)return t`<p>That menu was not found.</p>`;const i=this.shownHere,l=e?.items??[],o=i.find(e=>e.declared);return t`
      <p><a class="btn mb" href="/admin/content/menus/"><k-icon name="arrow" direction="left"></k-icon> Menus</a></p>
      <div class="d-f mb" style="align-items: center; gap: var(--spacer_h);">
        <h1 class="flex mb0">${e?.name??a.label}</h1>
        ${this.can.create&&o?t`<button class="primary" @click=${()=>this.openLinkEditor(o)}><k-icon name="add"></k-icon> Add item</button>`:n}
      </div>

      ${e?this.renderPlaces(e):n}

      <h2>Links</h2>
      ${l.length?t`
        <k-sortable data-menu=${e.id} @sort=${this.handleSort}>
          ${s(l,e=>e.id,e=>this.renderLink(i[0],e))}
        </k-sortable>
      `:n}
      ${i.map(e=>this.renderPlaceExtras(e))}
      ${l.length||i.some(e=>e.extensionItems.length||e.candidates.length)?n:t`<p class="tc-muted">Nothing here yet.</p>`}
      ${!i.length&&e?t`<p class="tc-muted">This menu is not shown anywhere, so its links cannot be added to. Tick a place above to show it.</p>`:n}

      ${this.can.delete&&e&&!i.length?t`
        <p class="mt"><button class="danger" @click=${()=>this.handleDeleteMenu(e)}><k-icon name="delete"></k-icon> Delete this menu</button></p>
      `:n}
    `}}customElements.define("admin-menu-editor",k);
//# sourceMappingURL=C:\Users\dusti\dev\kempo\dist\admin\components\MenuEditor.js.map