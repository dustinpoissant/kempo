import t from"/kempo-ui/components/ShadowComponent.js";import{html as e}from"/kempo-ui/lit-all.min.js";import{cleanMargin as a}from"/kempo/sitebuilder/margins.js";const s=[["","None"],["q","¼"],["h","½"],["f","Full"],["a","Auto"]];export default class i extends t{static properties={node:{attribute:!1},host:{attribute:!1},version:{type:Number}};setSide(t,e){this.host.setAttribute(this.node.id,"margin",{...a(this.node.attrs?.margin),[t]:e},!1)}render(){if(!this.node)return"";const t=a(this.node.attrs?.margin),i=a=>e`
      <select class="full" aria-label="Margin ${a}" title="Margin ${a}" @change="${t=>this.setSide(a,t.target.value)}">
        ${s.map(([s,i])=>e`<option value="${s}" ?selected="${t[a]===s}">${i}</option>`)}
      </select>`;return e`
      <div class="mb">
        <label class="d-b mbq">Margin<small class="d-b tc-muted">The space outside the widget on each side: none, a quarter, a half, a whole space or auto. Auto on left and right centers a widget that is narrower than its place.</small></label>
        <div class="d-g" style="grid-template-columns: 1fr 1.5fr 1fr; gap: var(--spacer_q); align-items: center;">
          <span></span>${i("top")}<span></span>
          ${i("left")}<div class="b r p ta-center tc-muted">Widget</div>${i("right")}
          <span></span>${i("bottom")}<span></span>
        </div>
      </div>
    `}}customElements.define("admin-sitebuilder-margin",i);
//# sourceMappingURL=c:\Users\dusti\dev\kempo\dist\admin\components\sitebuilder\SitebuilderMargin.js.map