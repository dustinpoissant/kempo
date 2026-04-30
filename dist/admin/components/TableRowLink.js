import t from"/kempo-ui/components/tableControls/TableControl.js";import{html as e}from"/kempo-ui/lit-all.min.js";import"/kempo-ui/components/Icon.js";export default class i extends t{static get properties(){return{urlPattern:{type:String,attribute:"url-pattern"},fieldName:{type:String,attribute:"field-name"}}}constructor(){super(),this.fieldName="id",this.maxWidth=40}navigate=()=>{if(!this.record)return;const t=this.record[this.fieldName];if(!t)return;const e=this.urlPattern.replace(`{${this.fieldName}}`,t);window.location.href=e};render(){return e`
      <button class="no-btn icon-btn" @click="${this.navigate}">
        <slot>
          <k-icon name="visibility"></k-icon>
        </slot>
      </button>
    `}}customElements.define("admin-table-row-link",i);
//# sourceMappingURL=C:\Users\dusti\dev\kempo\dist\admin\components\TableRowLink.js.map