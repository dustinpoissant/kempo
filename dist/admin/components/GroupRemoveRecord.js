import e from"/kempo-ui/components/tableControls/TableControl.js";import{html as o}from"/kempo-ui/lit-all.min.js";import"/kempo-ui/components/Icon.js";export default class t extends e{remove=()=>{this.record&&this.table.deleteRecord(this.record)};render(){return"system:Users"===this.record?.name?o``:o`
      <button class="no-btn icon-btn" @click="${this.remove}">
        <k-icon name="delete"></k-icon>
      </button>
    `}}customElements.define("admin-group-remove-record",t);
//# sourceMappingURL=C:\Users\dusti\dev\kempo\dist\admin\components\GroupRemoveRecord.js.map