import{html as t}from"/kempo-ui/lit-all.min.js";import e from"./WidgetSettings.js";import"/kempo-ui/components/Icon.js";export default class i extends e{render(){const e=this.node.slots?.default||[];return t`
      ${this.renderFields()}
      <div class="mb">
        <label class="d-b mbq">Sections<small class="d-b tc-muted">Click a heading on the page to open or close its section.</small></label>
        ${e.map((e,i)=>t`
          <div class="d-f mbq">
            <span class="mrq">${i+1}.</span>
            <input type="text" class="flex mrq" aria-label="Heading of section ${i+1}" .value="${e.attrs?.title??"Section"}" @input="${t=>this.host.setAttribute(e.id,"title",t.target.value,!0)}">
            <button title="Select it" aria-label="Select section ${i+1}" @click="${()=>this.select(e.id)}"><k-icon name="edit"></k-icon></button>
          </div>`)}
        <button @click="${()=>this.addChild("accordion-item","default")}"><k-icon name="add"></k-icon> Add section</button>
      </div>
    `}}customElements.define("k-accordion-settings",i);
//# sourceMappingURL=c:\Users\dusti\dev\kempo\dist\kempo\sitebuilder\components\AccordionSettings.js.map