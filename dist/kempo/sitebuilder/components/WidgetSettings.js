import t from"/kempo-ui/components/ShadowComponent.js";import{html as e}from"/kempo-ui/lit-all.min.js";import{findNode as i}from"/kempo/sitebuilder/nodes.js";import{hintOf as s,titleOf as l}from"/admin/components/sitebuilder/labels.js";import"/admin/components/sitebuilder/SitebuilderFields.js";import"/kempo-ui/components/Icon.js";export default class d extends t{static properties={node:{attribute:!1},registry:{attribute:!1},host:{attribute:!1},version:{type:Number}};set(t,e,i=!0){this.host.setAttribute(this.node.id,t,e,i)}edit(t){this.host.change(e=>{const s=i(e,this.node.id);return s?t(s.node,e):"That widget no longer exists"})}addChild(t,e="default"){this.host.addChild(this.node.id,t,e)}select(t){this.host.select(t)}renderFields(t=[]){return e`<admin-sitebuilder-fields .node="${this.node}" .registry="${this.registry}" .host="${this.host}" .version="${this.version}" .exclude="${t}"></admin-sitebuilder-fields>`}renderChoice(t,i,s,{hint:l="",swatch:d=!1}={}){const n=String(this.node.attrs?.[t]??s[0]?.value??"");return e`
      <div class="mb">
        <label class="d-b mbq">${i}${l?e`<small class="d-b tc-muted">${l}</small>`:""}</label>
        <div class="${d?"d-f":"btn-grp"}">
          ${s.map(i=>e`
            <button class="${d?`${i.value} mrq mbq`:""} ${d||n!==String(i.value)?"":"primary"}" title="${i.label}" aria-pressed="${n===String(i.value)}" @click="${()=>this.set(t,i.value,!1)}">
              ${i.icon?e`<k-icon name="${i.icon}"></k-icon>`:""}${d&&n===String(i.value)?e`<k-icon name="check"></k-icon>`:""} ${i.label}
            </button>`)}
        </div>
      </div>`}renderChildren(t,{label:i="Contents",hint:d="",addType:n,addLabel:o="Add"}={}){const a=this.node.slots?.[t]||[];return e`
      <div class="mb">
        <label class="d-b mbq">${i}${d?e`<small class="d-b tc-muted">${d}</small>`:""}</label>
        ${a.length?e`
          <div class="mb">
            ${a.map((t,i)=>e`
              <div class="d-f mbq">
                <span class="flex">${i+1}. ${s(t)||l(this.registry,t)}</span>
                <button title="Select it" aria-label="Select ${l(this.registry,t)} ${i+1}" @click="${()=>this.select(t.id)}"><k-icon name="edit"></k-icon></button>
              </div>`)}
          </div>`:e`<p class="tc-muted">Nothing here yet.</p>`}
        ${n?e`<button @click="${()=>this.addChild(n,t)}"><k-icon name="add"></k-icon> ${o}</button>`:""}
      </div>`}}
//# sourceMappingURL=C:\Users\dusti\dev\kempo\dist\kempo\sitebuilder\components\WidgetSettings.js.map