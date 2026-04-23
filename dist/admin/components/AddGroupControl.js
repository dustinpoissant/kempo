import TableControl from"/kempo-ui/components/tableControls/TableControl.js";import{html}from"/kempo-ui/lit-all.min.js";import"/kempo-ui/components/Icon.js";export default class AddGroupControl extends TableControl{render(){return html`
      <button class="no-btn icon-btn" title="Add to Group">
        <k-icon name="add"></k-icon>
      </button>
    `}}customElements.define("admin-add-group-control",AddGroupControl);
//# sourceMappingURL=AddGroupControl.js.map