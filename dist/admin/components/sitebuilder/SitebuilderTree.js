import e from"/kempo-ui/components/ShadowComponent.js";import{html as t,css as r}from"/kempo-ui/lit-all.min.js";import{slotsOf as i}from"/kempo/sitebuilder/render.js";import{acceptingSlot as o}from"/kempo/sitebuilder/ops.js";import{hintOf as s,titleOf as a}from"./labels.js";import"/kempo-ui/components/Icon.js";export default class n extends e{static properties={nodes:{attribute:!1},registry:{attribute:!1},selection:{attribute:!1},host:{attribute:!1},collapsed:{state:!0},dropAt:{state:!0}};constructor(){super(),this.nodes=[],this.selection=[],this.collapsed=new Set,this.dropAt=null,this.dragId=null}static styles=r`
    :host { display: block; }
    ul { list-style: none; margin: 0; padding: 0; }
    ul ul { padding-left: 1rem; }
    .row { display: flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.375rem; border-radius: 0.25rem; cursor: pointer; border: 1px solid transparent; }
    .row:hover { background: var(--c_bg__alt, #8881); }
    .row.selected { background: var(--c_primary, #36f); color: #fff; }
    .row.before { border-top-color: var(--c_primary, #36f); }
    .row.after { border-bottom-color: var(--c_primary, #36f); }
    .row.inside { border-color: var(--c_primary, #36f); }
    .hint { opacity: 0.65; font-size: 0.85em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .slot { font-size: 0.8em; opacity: 0.6; padding: 0.25rem 0.375rem 0; }
    .twisty { width: 1rem; flex: none; background: none; border: 0; padding: 0; color: inherit; cursor: pointer; }
    .empty { padding: 0.75rem; opacity: 0.6; }
  `;updated(e){e.has("selection")&&this.selection?.length&&this.renderRoot.querySelector(".row.selected")?.scrollIntoView({block:"nearest"})}zoneOf(e,t,r){const i=t.getBoundingClientRect(),s=(e.clientY-i.top)/i.height,a=this.host.find(r),n=a&&null!==o(this.registry,a.node,this.dragType());return s<.3?"before":s>.7?"after":n?"inside":s<.5?"before":"after"}dragType(){return this.host.find(this.dragId)?.node.type}handleDragStart=(e,t)=>{this.dragId=t,e.dataTransfer.setData("text/plain",t),e.dataTransfer.effectAllowed="move"};handleDragOver=(e,t)=>{this.dragId&&t!==this.dragId&&(e.preventDefault(),this.dropAt={id:t,zone:this.zoneOf(e,e.currentTarget,t)})};handleDrop=(e,t)=>{e.preventDefault();const r=this.dropAt?.zone||"after",i=this.dragId;this.clearDrag(),i&&i!==t&&this.host.dropOn(i,t,r)};clearDrag=()=>{this.dragId=null,this.dropAt=null};toggle(e){const t=new Set(this.collapsed);t.has(e)?t.delete(e):t.add(e),this.collapsed=t}renderRow(e){const r=this.registry.get(e.type),o=i(r),n=o.some(t=>e.slots?.[t.name]?.length),d=this.selection.includes(e.id),l=this.dropAt?.id===e.id?this.dropAt.zone:"",p=s(e);return t`
      <li>
        <div class="row ${d?"selected":""} ${l}" draggable="true" data-id="${e.id}"
          @click="${t=>this.host.select(e.id,{additive:t.ctrlKey||t.metaKey||t.shiftKey})}"
          @dragstart="${t=>this.handleDragStart(t,e.id)}"
          @dragover="${t=>this.handleDragOver(t,e.id)}"
          @drop="${t=>this.handleDrop(t,e.id)}"
          @dragend="${this.clearDrag}">
          ${n?t`<button class="twisty no-btn" aria-label="Show or hide what is inside" @click="${t=>{t.stopPropagation(),this.toggle(e.id)}}"><k-icon name="chevron" direction="${this.collapsed.has(e.id)?"right":"down"}"></k-icon></button>`:t`<span class="twisty"></span>`}
          <k-icon name="${r?.icon||"help"}"></k-icon>
          <span>${a(this.registry,e)}</span>
          ${p?t`<span class="hint">${p}</span>`:""}
        </div>
        ${n&&!this.collapsed.has(e.id)?t`
          ${o.map(r=>e.slots?.[r.name]?.length?t`
            ${o.length>1?t`<div class="slot">${r.label||r.name}</div>`:""}
            <ul>${e.slots[r.name].map(e=>this.renderRow(e))}</ul>
          `:"")}
        `:""}
      </li>
    `}render(){return this.nodes?.length?t`<ul role="tree">${this.nodes.map(e=>this.renderRow(e))}</ul>`:t`<div class="empty">No widgets yet.</div>`}}customElements.define("admin-sitebuilder-tree",n);
//# sourceMappingURL=C:\Users\dusti\dev\kempo\dist\admin\components\sitebuilder\SitebuilderTree.js.map