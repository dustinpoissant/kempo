import n from"/kempo-ui/components/tableControls/TableControl.js";import{html as e}from"/kempo-ui/lit-all.min.js";import t from"/kempo-ui/components/Dialog.js";import o from"/kempo-ui/components/Toast.js";import"/kempo-ui/components/Icon.js";export default class s extends n{uninstall=async()=>{this.record&&t.confirm(`Uninstall "${this.record.name}"? This may delete extension data.`,async n=>{if(!n)return;const{uninstallExtension:e}=await import("/kempo/sdk.js"),[t]=await e(this.record.name);t?o.error(t.msg||"Failed to uninstall extension"):(o.success(`"${this.record.name}" uninstalled successfully`),this.table.deleteRecord(this.record))})};render(){return e`
      <button class="no-btn icon-btn" title="Uninstall Extension" @click="${this.uninstall}">
        <k-icon name="extension_remove"></k-icon>
      </button>
    `}}customElements.define("admin-uninstall-extension",s);
//# sourceMappingURL=C:\Users\dusti\dev\kempo\dist\admin\components\tableControls\UninstallExtension.js.map