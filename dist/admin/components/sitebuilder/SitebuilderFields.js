import t from"/kempo-ui/components/ShadowComponent.js";import{html as e}from"/kempo-ui/lit-all.min.js";import{attributeTypes as i,attributeDefault as s}from"/kempo/sitebuilder/attributes.js";import"/kempo-ui/components/Icon.js";import"/kempo-ui/components/Toggle.js";export default class a extends t{static properties={node:{attribute:!1},registry:{attribute:!1},host:{attribute:!1},version:{type:Number},exclude:{attribute:!1}};constructor(){super(),this.exclude=[]}set(t,e,i=!0){this.host.setAttribute(this.node.id,t,e,i)}async pickAsset(t){const e=t.picker||"image",i=await window.kempo.openAssetPicker({alt:this.node.attrs?.alt||"",kind:e});i&&(this.set(t.name,i.url,!1),"image"===e&&"src"===t.name&&!this.node.attrs?.alt&&i.alt&&this.set("alt",i.alt,!1))}renderField(t){const a=`sb-field-${t.name}`,l=this.node.attrs?.[t.name]??s(t),n=(i[t.type]||i.string).field,r=e`<label class="d-b mbq" for="${a}">${t.label||t.name}${t.hint?e`<small class="d-b tc-muted">${t.hint}</small>`:""}</label>`;if("toggle"===n)return e`<div class="d-f mb" style="align-items: center; gap: var(--spacer);"><k-toggle id="${a}" .value="${!!l}" @change="${e=>this.set(t.name,e.detail.value,!1)}"></k-toggle><label for="${a}">${t.label||t.name}</label></div>`;if("select"===n)return e`<div class="mb">${r}<select id="${a}" class="full" @change="${e=>this.set(t.name,e.target.value,!1)}">${(t.options||[]).map(t=>e`<option value="${t.value}" ?selected="${String(t.value)===String(l)}">${t.label}</option>`)}</select></div>`;if("textarea"===n)return e`<div class="mb">${r}<textarea id="${a}" class="full" rows="4" .value="${String(l??"")}" @input="${e=>this.set(t.name,e.target.value)}"></textarea></div>`;if("number"===n)return e`<div class="mb">${r}<input id="${a}" type="number" class="full" min="${t.min??""}" max="${t.max??""}" .value="${String(l??"")}" @input="${e=>this.set(t.name,e.target.value)}"></div>`;if("image"===n)return e`
        <div class="mb">${r}
          <input id="${a}" type="text" class="full" .value="${String(l??"")}" @input="${e=>this.set(t.name,e.target.value)}">
          ${window.kempo?.openAssetPicker?e`<button class="mtq" @click="${()=>this.pickAsset(t)}"><k-icon name="image"></k-icon> Choose from the media library</button>`:""}
        </div>`;const o=t.variables?"sb-variables":"name"===t.name&&"fragment"===this.node.type?"sb-fragments":"";return e`
      <div class="mb">${r}
        <input id="${a}" type="text" class="full" list="${o}" .value="${String(l??"")}" @input="${e=>this.set(t.name,e.target.value)}">
        ${t.picker&&window.kempo?.openAssetPicker?e`<button class="mtq" @click="${()=>this.pickAsset(t)}"><k-icon name="${"video"===t.picker?"video":"audio"===t.picker?"audio":"file"}"></k-icon> Choose from the media library</button>`:""}
      </div>`}renderTable(){const t=this.node.attrs?.rows?.length?this.node.attrs.rows:[["",""],["",""]],i=e=>this.set("rows",e(t.map(t=>[...t])),!1);return e`
      <div class="mb">
        <label class="d-b mbq">Rows and columns<small class="d-b tc-muted">Click a cell on the page to type in it.</small></label>
        <p class="tc-muted mb0">${t.length} rows, ${t[0].length} columns</p>
        <div class="btn-grp mt">
          <button @click="${()=>i(t=>[...t,Array(t[0].length).fill("")])}">Add row</button>
          <button ?disabled="${t.length<2}" @click="${()=>i(t=>t.slice(0,-1))}">Remove row</button>
        </div>
        <div class="btn-grp mt">
          <button @click="${()=>i(t=>t.map(t=>[...t,""]))}">Add column</button>
          <button ?disabled="${t[0].length<2}" @click="${()=>i(t=>t.map(t=>t.slice(0,-1)))}">Remove column</button>
        </div>
      </div>
    `}render(){if(!this.node)return"";const t=this.registry.get(this.node.type),i=e=>this.node.attrs?.[e]??s(t.attributes.find(t=>t.name===e)||{}),a=(t?.attributes||[]).filter(t=>!t.virtual&&!this.exclude.includes(t.name)&&Object.entries(t.when||{}).every(([t,e])=>String(i(t))===e));return e`
      ${a.map(t=>this.renderField(t))}
      ${t?.attributes?.some(t=>"table"===t.type)?this.renderTable():""}
      <datalist id="sb-variables">${(this.host.variables||[]).map(t=>e`<option value="${t}"></option>`)}</datalist>
      <datalist id="sb-fragments">${(this.host.fragments||[]).map(t=>e`<option value="${t}"></option>`)}</datalist>
    `}}customElements.define("admin-sitebuilder-fields",a);
//# sourceMappingURL=C:\Users\dusti\dev\kempo\dist\admin\components\sitebuilder\SitebuilderFields.js.map