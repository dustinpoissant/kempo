import o from"/kempo-ui/components/tableControls/TableControl.js";import{html as t}from"/kempo-ui/lit-all.min.js";import n from"/kempo-ui/components/Dialog.js";import e from"/kempo-ui/components/Toast.js";import"/kempo-ui/components/Icon.js";export default class s extends o{install=async()=>{this.record&&n.confirm(`Install "${this.record.name}"?`,async o=>{if(!o)return;const{installExtension:t}=await import("/kempo/sdk.js"),[n]=await t(this.record.name);n?e.error(n.msg||"Failed to install extension"):(e.success(`"${this.record.name}" installed successfully`),this.table.deleteRecord(this.record))})};render(){return t`
      <button class="no-btn icon-btn" title="Install Extension" @click="${this.install}">
        <k-icon name="download"></k-icon>
      </button>
    `}}customElements.define("admin-install-extension",s);
//# sourceMappingURL=C:\Users\dusti\dev\kempo\dist\admin\components\tableControls\InstallExtension.js.map