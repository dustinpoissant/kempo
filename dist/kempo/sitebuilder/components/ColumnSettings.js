import{html as e}from"/kempo-ui/lit-all.min.js";import l from"./WidgetSettings.js";const s=[{value:"",label:"Fill"},{value:"3",label:"1/4"},{value:"4",label:"1/3"},{value:"6",label:"1/2"},{value:"8",label:"2/3"},{value:"9",label:"3/4"},{value:"12",label:"Full"}];export default class t extends l{render(){const l=String(this.node.attrs?.size??""),t=!s.some(e=>e.value===l);return e`
      ${this.renderChoice("size","Width",s,{hint:"Fill shares the space the other columns leave."})}
      ${t?e`
        <div class="mb">
          <label class="d-b mbq" for="sb-column-size">Exact width<small class="d-b tc-muted">Out of 12.</small></label>
          <select id="sb-column-size" class="full" @change="${e=>this.set("size",e.target.value,!1)}">
            ${Array.from({length:12},(e,l)=>String(l+1)).map(s=>e`<option value="${s}" ?selected="${s===l}">${s} of 12</option>`)}
          </select>
        </div>`:""}
      ${this.renderFields(["size"])}
    `}}customElements.define("k-column-settings",t);
//# sourceMappingURL=c:\Users\dusti\dev\kempo\dist\kempo\sitebuilder\components\ColumnSettings.js.map