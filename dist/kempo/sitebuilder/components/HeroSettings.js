import{html as e}from"/kempo-ui/lit-all.min.js";import l from"./WidgetSettings.js";export default class t extends l{render(){const l=Number(this.node.attrs?.overlay??40);return e`
      ${this.renderFields(["height","overlay"])}
      ${this.renderChoice("height","Height",[{value:"medium",label:"Medium"},{value:"tall",label:"Tall"},{value:"full",label:"Full screen"}])}
      <div class="mb">
        <label class="d-b mbq" for="sb-hero-overlay">Overlay darkness: ${l}<small class="d-b tc-muted">Darkens the picture so the text on it can be read.</small></label>
        <input id="sb-hero-overlay" type="range" class="full" min="0" max="90" .value="${String(l)}" @input="${e=>this.set("overlay",Number(e.target.value))}">
      </div>
    `}}customElements.define("k-hero-settings",t);
//# sourceMappingURL=c:\Users\dusti\dev\kempo\dist\kempo\sitebuilder\components\HeroSettings.js.map