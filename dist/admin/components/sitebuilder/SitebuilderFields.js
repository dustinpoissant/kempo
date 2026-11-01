import t from"/kempo-ui/components/ShadowComponent.js";import{html as e}from"/kempo-ui/lit-all.min.js";import{attributeTypes as a,attributeDefault as i,parseColor as s,formatColor as l}from"/kempo/sitebuilder/attributes.js";import{COLUMN_WIDTH as n,columnWidths as r}from"/kempo/sitebuilder/tables.js";import"/kempo-ui/components/Icon.js";import"/kempo-ui/components/ColorPicker.js";import"/kempo-ui/components/Toggle.js";export default class o extends t{static properties={node:{attribute:!1},registry:{attribute:!1},host:{attribute:!1},version:{type:Number},exclude:{attribute:!1}};constructor(){super(),this.exclude=[]}set(t,e,a=!0){this.host.setAttribute(this.node.id,t,e,a)}async pickAsset(t){const e=t.picker||"image",a=await window.kempo.openAssetPicker({alt:this.node.attrs?.alt||"",kind:e});a&&(this.set(t.name,a.url,!1),"image"===e&&"src"===t.name&&!this.node.attrs?.alt&&a.alt&&this.set("alt",a.alt,!1))}renderField(t){const n=`sb-field-${t.name}`,r=this.node.attrs?.[t.name]??i(t),o=(a[t.type]||a.string).field,m=e`<label class="d-b mbq" for="${n}">${t.label||t.name}${t.hint?e`<small class="d-b tc-muted">${t.hint}</small>`:""}</label>`;if("toggle"===o)return e`<div class="d-f mb" style="align-items: center; gap: var(--spacer);"><k-toggle id="${n}" .value="${!!r}" @change="${e=>this.set(t.name,e.detail.value,!1)}"></k-toggle><label for="${n}">${t.label||t.name}</label></div>`;if("select"===o)return e`<div class="mb">${m}<select id="${n}" class="full" @change="${e=>this.set(t.name,e.target.value,!1)}">${(t.options||[]).map(t=>e`<option value="${t.value}" ?selected="${String(t.value)===String(r)}">${t.label}</option>`)}</select></div>`;if("textarea"===o)return e`<div class="mb">${m}<textarea id="${n}" class="full" rows="4" .value="${String(r??"")}" @input="${e=>this.set(t.name,e.target.value)}"></textarea></div>`;if("number"===o)return e`<div class="mb">${m}<input id="${n}" type="number" class="full" min="${t.min??""}" max="${t.max??""}" .value="${String(r??"")}" @input="${e=>this.set(t.name,e.target.value)}"></div>`;if("color"===o){const a=s(r),i=a||{red:0,green:0,blue:0,alpha:1};return e`
        <div class="mb">${m}
          <k-color-picker id="${n}" format="hex" .value="${l({...i,alpha:1})}" @input="${e=>this.set(t.name,l({red:e.target.red,green:e.target.green,blue:e.target.blue,alpha:i.alpha}))}"></k-color-picker>
          ${!1===t.alpha?"":e`
            <label class="d-b mtq mbq" for="${n}-opacity">Opacity (%)</label>
            <input id="${n}-opacity" type="number" class="full" min="0" max="100" .value="${a?String(Math.round(100*a.alpha)):"100"}" @input="${e=>this.set(t.name,l({...i,alpha:Math.max(0,Math.min(100,Number(e.target.value)||0))/100}))}">`}
          <button class="mtq" ?disabled="${!a}" @click="${()=>this.set(t.name,"",!1)}">Reset</button>
        </div>`}if("image"===o)return e`
        <div class="mb">${m}
          <input id="${n}" type="text" class="full" .value="${String(r??"")}" @input="${e=>this.set(t.name,e.target.value)}">
          ${window.kempo?.openAssetPicker?e`<button class="mtq" @click="${()=>this.pickAsset(t)}"><k-icon name="image"></k-icon> Choose from the media library</button>`:""}
        </div>`;const c=t.variables?"sb-variables":"name"===t.name&&"fragment"===this.node.type?"sb-fragments":"";return e`
      <div class="mb">${m}
        <input id="${n}" type="text" class="full" list="${c}" .value="${String(r??"")}" @input="${e=>this.set(t.name,e.target.value)}">
        ${t.picker&&window.kempo?.openAssetPicker?e`<button class="mtq" @click="${()=>this.pickAsset(t)}"><k-icon name="${"video"===t.picker?"video":"audio"===t.picker?"audio":"file"}"></k-icon> Choose from the media library</button>`:""}
      </div>`}renderTable(){const t=this.node.attrs?.rows?.length?this.node.attrs.rows:[["",""],["",""]],a=Math.max(...t.map(t=>t.length)),i=r(this.node.attrs?.widths,a),s=e=>this.set("rows",e(t.map(t=>[...t])),!1),l=(t,e,a)=>{const s=[...i],l=""===a?"px"===e?120:25:Math.max(0,Number(a));s[t]=e?`${l}${e}`:"",this.set("widths",s,!1)};return e`
      <div class="mb">
        <label class="d-b mbq">Rows and columns<small class="d-b tc-muted">Click a cell on the page to type in it.</small></label>
        <p class="tc-muted mb0">${t.length} rows, ${a} columns</p>
        <div class="btn-grp mt">
          <button @click="${()=>s(t=>[...t,Array(t[0].length).fill("")])}">Add row</button>
          <button ?disabled="${t.length<2}" @click="${()=>s(t=>t.slice(0,-1))}">Remove row</button>
        </div>
        <div class="btn-grp mt">
          <button @click="${()=>s(t=>t.map(t=>[...t,""]))}">Add column</button>
          <button ?disabled="${a<2}" @click="${()=>s(t=>t.map(t=>t.slice(0,-1)))}">Remove column</button>
        </div>
      </div>
      <div class="mb">
        <label class="d-b mbq">Column widths<small class="d-b tc-muted">Auto fits a column to its text. A percentage is a share of the table, and pixels are a fixed width.</small></label>
        ${i.map((t,a)=>{const i=n.exec(t),s=i?i[2]:"";return e`
            <div class="d-f mbq">
              <span class="mrq">Column ${a+1}</span>
              <select aria-label="Width of column ${a+1}" class="mrq" @change="${t=>l(a,t.target.value,t.target.parentElement.querySelector("input").value)}">
                <option value="" ?selected="${!s}">Auto</option>
                <option value="%" ?selected="${"%"===s}">Percentage</option>
                <option value="px" ?selected="${"px"===s}">Pixels</option>
              </select>
              <input type="number" min="0" class="flex" aria-label="Width of column ${a+1} in ${"px"===s?"pixels":"percent"}" ?disabled="${!s}" .value="${i?i[1]:""}" @input="${t=>l(a,s,t.target.value)}">
            </div>`})}
      </div>
    `}render(){if(!this.node)return"";const t=this.registry.get(this.node.type),a=e=>this.node.attrs?.[e]??i(t.attributes.find(t=>t.name===e)||{}),s=(t?.attributes||[]).filter(t=>!t.virtual&&!this.exclude.includes(t.name)&&Object.entries(t.when||{}).every(([t,e])=>String(a(t))===e));return e`
      ${s.map(t=>this.renderField(t))}
      ${t?.attributes?.some(t=>"table"===t.type)?this.renderTable():""}
      <datalist id="sb-variables">${(this.host.variables||[]).map(t=>e`<option value="${t}"></option>`)}</datalist>
      <datalist id="sb-fragments">${(this.host.fragments||[]).map(t=>e`<option value="${t}"></option>`)}</datalist>
    `}}customElements.define("admin-sitebuilder-fields",o);
//# sourceMappingURL=c:\Users\dusti\dev\kempo\dist\admin\components\sitebuilder\SitebuilderFields.js.map