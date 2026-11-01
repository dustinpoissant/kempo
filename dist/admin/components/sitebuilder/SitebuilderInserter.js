import t from"/kempo-ui/components/ShadowComponent.js";import{html as e,css as i}from"/kempo-ui/lit-all.min.js";import"/kempo-ui/components/Icon.js";const s={text:"Text",media:"Media",layout:"Layout",content:"Content",interactive:"Interactive",server:"Server"},r=Object.keys(s);export default class o extends t{static properties={registry:{attribute:!1},host:{attribute:!1},query:{state:!0}};constructor(){super(),this.query=""}static styles=i`
    :host { display: block; min-width: min(40rem, 80vw); }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr)); gap: 0.5rem; }
    .grid button { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; padding: 0.75rem 0.5rem; text-align: center; height: 100%; }
    .grid small { opacity: 0.65; }
  `;firstUpdated(){this.renderRoot.querySelector("input")?.focus()}matches(t){const e=this.query.trim().toLowerCase();return!e||[t.title,t.description,...t.keywords||[]].some(t=>String(t||"").toLowerCase().includes(e))}groups(){const t=this.registry.list().filter(t=>"hidden"!==t.category&&this.host.canAdd(t.key)&&this.matches(t)),e=new Map;for(const i of t)e.has(i.category)||e.set(i.category,[]),e.get(i.category).push(i);return[...e.keys()].sort((t,e)=>{const i=r.indexOf(t),s=r.indexOf(e);return(-1===i?99:i)-(-1===s?99:s)}).map(t=>({name:t,title:s[t]||t[0].toUpperCase()+t.slice(1),widgets:e.get(t)}))}render(){const t=this.groups();return e`
      <div class="p">
        <input type="search" class="full mb" placeholder="Search widgets" aria-label="Search widgets" .value="${this.query}" @input="${t=>{this.query=t.target.value}}">
        ${t.length?t.map(t=>e`
          <h6 class="mb">${t.title}</h6>
          <div class="grid mb">
            ${t.widgets.map(t=>e`
              <button @click="${()=>this.host.insert(t.key)}" title="${t.description||""}">
                ${t.iconSrc?e`<k-icon src="${t.iconSrc}"></k-icon>`:e`<k-icon name="${t.icon||"extension"}"></k-icon>`}
                <span>${t.title}</span>
              </button>
            `)}
          </div>
        `):e`<p class="tc-muted">No widget matches that.</p>`}
      </div>
    `}}customElements.define("admin-sitebuilder-inserter",o);
//# sourceMappingURL=C:\Users\dusti\dev\kempo\dist\admin\components\sitebuilder\SitebuilderInserter.js.map