import e from"/kempo-ui/components/pagebuilder/WidgetSettings.js";import{html as t}from"/kempo-ui/lit-all.min.js";import{listFragments as s}from"/kempo/sdk.js";let n=[];export const setVariables=e=>{n=e||[]};let a=null;const i=(e,s,n,a,{suggest:i=!1}={})=>{const l=`server-${s}`;return t`
    <div class="mb">
      <label class="d-b mbq" for="${l}">${n}<small class="d-b tc-muted">${a}</small></label>
      <input id="${l}" type="text" class="full" list="${i?"server-values":""}" .value="${String(e.node.attrs?.[s]??"")}" @input="${t=>e.set(s,t.target.value)}">
    </div>
  `},l=()=>t`<datalist id="server-values">${n.map(e=>t`<option value="${e}"></option>`)}</datalist>`;export class FragmentSettings extends e{static properties={...e.properties,list:{state:!0}};constructor(){super(),this.list=void 0}connectedCallback(){super.connectedCallback(),(a??=s().then(([e,t])=>e?null:(t.fragments||[]).filter(e=>!e.disabled)),a).then(e=>{this.list=e})}render(){if(void 0===this.list)return t`<p class="tc-muted">Loading the fragments</p>`;if(null===this.list)return i(this,"name","Fragment name","The name of a fragment, such as nav or footer.");const e=this.node.attrs?.name||"",s=this.list.find(t=>t.name===e);return t`
      <div class="mb">
        <label class="d-b mbq" for="server-fragment">Fragment<small class="d-b tc-muted">The shared content placed here, edited in one place. Fragments are made under Content, Fragments in the admin.</small></label>
        <select id="server-fragment" class="full" @change="${e=>this.set("name",e.target.value,!1)}">
          <option value="" ?selected="${!e}">Choose a fragment</option>
          ${this.list.map(s=>t`<option value="${s.name}" ?selected="${s.name===e}">${s.name}</option>`)}
          ${e&&!s?t`<option value="${e}" selected>${e} (not found)</option>`:""}
        </select>
        ${s?t`<a class="btn mtq" href="/admin/content/fragments/edit?fragment=${encodeURIComponent(s.file.replace(/\.fragment\.html$/,""))}" target="_blank" rel="noopener">Edit this fragment</a>`:""}
      </div>
    `}}export class ConditionalSettings extends e{render(){return t`
      ${i(this,"condition","Condition","The name of a value. Put ! in front to show the content when it is not set.",{suggest:!0})}
      ${l()}
    `}}export class RepeatSettings extends e{render(){return t`
      ${i(this,"in","List","The name of a value that holds a list.",{suggest:!0})}
      ${i(this,"as","Item name","What each item is called inside, as {{name}}.")}
      ${l()}
    `}}customElements.define("admin-pagebuilder-fragment-settings",FragmentSettings),customElements.define("admin-pagebuilder-conditional-settings",ConditionalSettings),customElements.define("admin-pagebuilder-repeat-settings",RepeatSettings);
//# sourceMappingURL=C:\Users\dusti\dev\kempo\dist\admin\components\pagebuilder\ServerWidgetSettings.js.map