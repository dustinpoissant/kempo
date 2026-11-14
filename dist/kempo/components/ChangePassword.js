import s from"/kempo-ui/components/LightComponent.js";import{html as e}from"/kempo-ui/lit-all.min.js";import t from"/kempo-ui/components/Toast.js";import"/kempo-ui/components/Dialog.js";import"/kempo-ui/components/Toggle.js";import{changePassword as r}from"../sdk.js";import{refresh as o}from"../notifications/client.js";class a extends s{open=async()=>{await this.updateComplete,this.querySelector("k-dialog").open()};submit=async s=>{s.preventDefault();const e=s.target,a=e.elements.confirmPassword;if(e.elements.newPassword.value!==a.value)return a.classList.add("error"),a.setCustomValidity("Your new password and confirmation password do not match"),void a.reportValidity();this.querySelector("k-dialog").close();const[i]=await r({currentPassword:e.elements.currentPassword.value,newPassword:e.elements.newPassword.value,logoutAll:e.querySelector("k-toggle").value});i?t.error(i.msg):(e.reset(),o())};clearMismatch=s=>{s.target.classList.remove("error"),s.target.setCustomValidity("")};renderDialog(){return e`
      <k-dialog>
        <h5 slot="title" class="pyh px m0">Change Password</h5>
        <form class="p" @submit=${this.submit}>
          <div class="mb">
            <label for="k-change-current" class="d-b mb-sm">Current Password</label>
            <input type="password" id="k-change-current" name="currentPassword" required class="w-full p-sm br">
          </div>
          <div class="mb">
            <label for="k-change-new" class="d-b mb-sm">New Password</label>
            <input type="password" id="k-change-new" name="newPassword" required minlength="8" class="w-full p-sm br">
          </div>
          <div class="mb">
            <label for="k-change-confirm" class="d-b mb-sm">Confirm New Password</label>
            <input type="password" id="k-change-confirm" name="confirmPassword" required minlength="8" class="w-full p-sm br" @input=${this.clearMismatch}>
          </div>
          <k-toggle>Logout all other devices</k-toggle>
          <div class="ta-right">
            <button type="submit" class="primary">Change Password</button>
          </div>
        </form>
      </k-dialog>
    `}renderLightDom(){return this.renderDialog()}}customElements.define("k-change-password-dialog",a),customElements.define("k-change-password",class extends a{static properties={label:{type:String},buttonClass:{type:String,attribute:"button-class"}};constructor(){super(),this.label="Change Password",this.buttonClass="btn"}renderLightDom(){return e`
      <button type="button" class=${this.buttonClass} @click=${this.open}>${this.label}</button>
      ${this.renderDialog()}
    `}});
//# sourceMappingURL=c:\Users\dusti\dev\kempo\dist\kempo\components\ChangePassword.js.map