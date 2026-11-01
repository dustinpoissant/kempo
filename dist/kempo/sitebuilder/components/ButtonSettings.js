import{html as e}from"/kempo-ui/lit-all.min.js";import r from"./WidgetSettings.js";export default class t extends r{render(){const r=[{value:"",label:"Default"},...["primary","secondary","success","warning","danger"].map(e=>({value:e,label:e[0].toUpperCase()+e.slice(1)}))];return e`
      ${this.renderFields(["color"])}
      ${this.renderChoice("color","Color",r,{swatch:!0})}
    `}}customElements.define("k-button-settings",t);
//# sourceMappingURL=c:\Users\dusti\dev\kempo\dist\kempo\sitebuilder\components\ButtonSettings.js.map