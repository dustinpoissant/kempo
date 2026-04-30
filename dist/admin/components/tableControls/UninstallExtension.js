import n from"/kempo-ui/components/tableControls/TableControl.js";import{html as t}from"/kempo-ui/lit-all.min.js";import e from"/kempo-ui/components/Dialog.js";import o from"/kempo-ui/components/Toast.js";import"/kempo-ui/components/Icon.js";export default class s extends n{uninstall=async()=>{this.record&&e.confirm(`Uninstall "${this.record.name}"? This may delete extension data.`,async n=>{if(!n)return;const{uninstallExtension:t}=await import("/kempo/sdk.js"),[e]=await t(this.record.name);e?o.error(e.msg||"Failed to uninstall extension"):(o.success(`"${this.record.name}" uninstalled successfully`),this.table.deleteRecord(this.record))})};render(){return t`
      <button class="no-btn icon-btn" title="Uninstall Extension" @click="${this.uninstall}">
        <k-icon name="delete"></k-icon>
      </button>
    `}}customElements.define("admin-uninstall-extension",s);
//# sourceMappingURL=C:\Users\dusti\dev\kempo\dist\admin\components\tableControls\UninstallExtension.js.map