import t from"./WidgetEditor.js";import{html as e,css as o}from"/kempo-ui/lit-all.min.js";import r from"/kempo-ui/components/HtmlEditor.js";import c from"/kempo-ui/utils/sanitizeHtml.js";import"/kempo-ui/components/Icon.js";r.controlSets.sitebuilder={topLeft:e`
    <k-control-group>
      <kc-bold></kc-bold>
      <kc-italic></kc-italic>
      <kc-underline></kc-underline>
      <kc-strikethrough></kc-strikethrough>
    </k-control-group>
    <kc-inline-code></kc-inline-code>
    <kc-menu>
      <k-icon slot="icon" name="format_paragraph"></k-icon>
      <span slot="label">Text Style</span>
      <kc-format-block tag="p">Paragraph</kc-format-block>
      <kc-format-block tag="h1">Heading 1</kc-format-block>
      <kc-format-block tag="h2">Heading 2</kc-format-block>
      <kc-format-block tag="h3">Heading 3</kc-format-block>
      <kc-format-block tag="h4">Heading 4</kc-format-block>
      <kc-format-block tag="blockquote">Blockquote</kc-format-block>
      <kc-code-block></kc-code-block>
    </kc-menu>
    <k-control-group>
      <kc-bullet-list></kc-bullet-list>
      <kc-number-list></kc-number-list>
    </k-control-group>
    <k-control-group>
      <kc-align-left></kc-align-left>
      <kc-align-center></kc-align-center>
      <kc-align-right></kc-align-right>
    </k-control-group>
    <kc-create-link></kc-create-link>
    <kc-insert-image></kc-insert-image>
    <kc-insert-table></kc-insert-table>
    <kc-clear-formatting></kc-clear-formatting>
    <k-control-group>
      <kc-undo></kc-undo>
      <kc-redo></kc-redo>
    </k-control-group>
  `,topRight:null,bottomLeft:null,bottomRight:null};const i=new Set(["P","BR","HR","H1","H2","H3","H4","H5","H6","UL","OL","LI","BLOCKQUOTE","PRE","CODE","EM","STRONG","B","I","U","S","SUB","SUP","SPAN","A","IMG","TABLE","THEAD","TBODY","TFOOT","TR","TH","TD"]),n=new Set(["class","dir","lang","style"]),l={A:new Set(["href","title","target","rel","name"]),IMG:new Set(["src","alt","title","width","height"]),OL:new Set(["start","type"]),LI:new Set(["value"]),TD:new Set(["colspan","rowspan","align"]),TH:new Set(["colspan","rowspan","scope","align"])};export const cleanMarkup=t=>c(t,{allowedTags:i,allowedAttrs:n,allowedAttrsPerTag:l});export default class a extends t{static properties={...t.properties,initial:{state:!0}};constructor(){super(),this.initial="",this.current="",this.touched=!1}static styles=o`
    :host { display: block; margin-bottom: var(--spacer, 1rem); }
    k-html-editor { display: block; height: auto; min-height: 5rem; }
  `;connectedCallback(){super.connectedCallback(),this.initial=this.innerHTML,this.current=this.initial,this.textContent="";for(const t of["pointerdown","keydown"])this.addEventListener(t,()=>{this.touched=!0},{capture:!0})}handleChange=t=>{if(t.stopPropagation(),!this.touched)return;const e=cleanMarkup(t.detail?.value??"");e!==this.current&&(this.current=e,this.emitChange({html:e}))};render(){return e`<k-html-editor controls="sitebuilder" layout="floating" .stylesheet="${":host { background: transparent; } .lexical-editor { background: transparent; }"}" .value="${this.initial}" @change="${this.handleChange}"></k-html-editor>`}}customElements.define("k-markup-editor",a);
//# sourceMappingURL=c:\Users\dusti\dev\kempo\dist\kempo\sitebuilder\components\MarkupEditor.js.map