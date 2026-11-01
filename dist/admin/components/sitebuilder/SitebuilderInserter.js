import t from"/kempo-ui/components/ShadowComponent.js";import{html as e,css as s}from"/kempo-ui/lit-all.min.js";import i from"./widgetIcon.js";const r={text:"Text",media:"Media",layout:"Layout",content:"Content",interactive:"Interactive",server:"Server"},o=Object.keys(r);export default class a extends t{static properties={registry:{attribute:!1},host:{attribute:!1},query:{state:!0}};constructor(){super(),this.query=""}static styles=s`
    :host { display: block; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr)); gap: 0.5rem; }
    .grid button { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; padding: 0.75rem 0.5rem; text-align: center; height: 100%; }
    .grid small { opacity: 0.65; }
  `;focusSearch(){this.renderRoot.querySelector("input")?.focus()}matches(t){const e=this.query.trim().toLowerCase();return!e||[t.title,t.description,...t.keywords||[]].some(t=>String(t||"").toLowerCase().includes(e))}groups(){const t=this.registry.list().filter(t=>"hidden"!==t.category&&this.host.canAdd(t.key)&&this.matches(t)),e=new Map;for(const s of t)e.has(s.category)||e.set(s.category,[]),e.get(s.category).push(s);const s=new Map(t.filter(t=>t.category_title).map(t=>[t.category,t.category_title]));return[...e.keys()].sort((t,e)=>{const s=o.indexOf(t),i=o.indexOf(e);return(-1===s?99:s)-(-1===i?99:i)}).map(t=>({name:t,title:r[t]||s.get(t)||t[0].toUpperCase()+t.slice(1).replace(/[-_]+/g," "),widgets:e.get(t)}))}render(){const t=this.groups();return e`
      <div class="p">
        <input type="search" class="full mb" placeholder="Search widgets" aria-label="Search widgets" .value="${this.query}" @input="${t=>{this.query=t.target.value}}" @keydown="${e=>{"Enter"===e.key&&t.length&&this.host.insert(t[0].widgets[0].key)}}">
        ${t.length?t.map(t=>e`
          <h6 class="mb">${t.title}</h6>
          <div class="grid mb">
            ${t.widgets.map(t=>e`
              <button @click="${()=>this.host.insert(t.key)}" title="${t.description||""}">
                ${i(t,"extension")}
                <span>${t.title}</span>
              </button>
            `)}
          </div>
        `):e`<p class="tc-muted">No widget matches that.</p>`}
      </div>
    `}}customElements.define("admin-sitebuilder-inserter",a);
//# sourceMappingURL=c:\Users\dusti\dev\kempo\dist\admin\components\sitebuilder\SitebuilderInserter.js.map