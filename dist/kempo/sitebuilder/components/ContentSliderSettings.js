import{html as e}from"/kempo-ui/lit-all.min.js";import i from"./WidgetSettings.js";export default class d extends i{render(){return e`
      ${this.renderFields()}
      ${this.renderChildren("default",{label:"Slides",hint:"Each widget inside the slider is a slide. A new slide is a Group you can put other widgets in.",addType:"group",addLabel:"Add slide"})}
    `}}customElements.define("k-content-slider-settings",d);
//# sourceMappingURL=c:\Users\dusti\dev\kempo\dist\kempo\sitebuilder\components\ContentSliderSettings.js.map