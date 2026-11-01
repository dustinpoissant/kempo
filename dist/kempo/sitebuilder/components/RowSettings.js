import{html as e}from"/kempo-ui/lit-all.min.js";import t from"./WidgetSettings.js";import{setColumnLayout as s}from"/kempo/sitebuilder/ops.js";const l=[["1 column",[""]],["2 columns",["",""]],["3 columns",["","",""]],["4 columns",["","","",""]],["1/3 + 2/3",["4","8"]],["2/3 + 1/3",["8","4"]],["1/4 + 3/4",["3","9"]],["3/4 + 1/4",["9","3"]]];export default class i extends t{render(){return e`
      ${this.renderFields()}
      <div class="mb">
        <label class="d-b mbq">Layout<small class="d-b tc-muted">Sets how many columns there are and how wide. Anything in a column that goes is moved into the last one.</small></label>
        <div class="d-f">
          ${l.map(([t,l])=>e`<button class="mrq mbq" @click="${()=>this.edit(e=>s(this.registry,e,l))}">${t}</button>`)}
        </div>
      </div>
      ${this.renderChildren("default",{label:"Columns",hint:"Select a column to set its width.",addType:"column",addLabel:"Add column"})}
    `}}customElements.define("k-row-settings",i);
//# sourceMappingURL=C:\Users\dusti\dev\kempo\dist\kempo\sitebuilder\components\RowSettings.js.map