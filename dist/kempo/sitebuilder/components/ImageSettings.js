import{html as e}from"/kempo-ui/lit-all.min.js";import t from"./WidgetSettings.js";export default class l extends t{render(){const t=this.node.attrs?.ratio||"",l=this.registry.get("image").attributes.find(e=>"ratio"===e.name).options;return e`
      ${this.renderFields(["ratio","fit","rounded"])}
      <div class="mb">
        <label class="d-b mbq" for="sb-image-ratio">Aspect ratio<small class="d-b tc-muted">Crops the picture to this ratio. Original keeps its own.</small></label>
        <select id="sb-image-ratio" class="full" @change="${e=>this.set("ratio",e.target.value,!1)}">
          ${l.map(l=>e`<option value="${l.value}" ?selected="${l.value===t}">${l.label}</option>`)}
        </select>
      </div>
      ${t?this.renderChoice("fit","Fit",[{value:"",label:"Fill and crop"},{value:"contain",label:"Show all"}],{hint:"How the picture fills the aspect ratio."}):""}
      ${this.renderChoice("rounded","Corners",[{value:"",label:"Square"},{value:"small",label:"Rounded"},{value:"round",label:"Circle"}])}
    `}}customElements.define("k-image-settings",l);
//# sourceMappingURL=c:\Users\dusti\dev\kempo\dist\kempo\sitebuilder\components\ImageSettings.js.map