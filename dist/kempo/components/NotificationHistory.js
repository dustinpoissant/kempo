import t from"/kempo-ui/components/LightComponent.js";import{html as e}from"/kempo-ui/lit-all.min.js";import"./NotificationList.js";const i=[["","Everything"],["notice","Notices"],["toast","Toasts"],["banner","Banners"],["modal","Pop-ups"],["inline","In-page messages"]],s=[["all","All, including dismissed"],["active","Still active"],["viewed","Viewed"],["acknowledged","Acknowledged"],["dismissed","Dismissed"],["expired","Expired"]];export default class a extends t{static properties={type:{type:String,reflect:!0},status:{type:String,reflect:!0},pageSize:{type:Number,attribute:"page-size"}};constructor(){super(),this.type="",this.status="all",this.pageSize=20}changeType=t=>{this.type=t.target.value};changeStatus=t=>{this.status=t.target.value};renderLightDom(){return e`
      <div class="d-f mb">
        <div class="mr">
          <label class="d-b mbq" for="notification-history-type">Kind</label>
          <select id="notification-history-type" @change=${this.changeType}>
            ${i.map(([t,i])=>e`<option value=${t} ?selected=${this.type===t}>${i}</option>`)}
          </select>
        </div>
        <div>
          <label class="d-b mbq" for="notification-history-status">Status</label>
          <select id="notification-history-status" @change=${this.changeStatus}>
            ${s.map(([t,i])=>e`<option value=${t} ?selected=${this.status===t}>${i}</option>`)}
          </select>
        </div>
      </div>
      <k-notification-list show-status paginated .type=${this.type} .status=${this.status} .pageSize=${this.pageSize}></k-notification-list>
    `}}customElements.define("k-notification-history",a);
//# sourceMappingURL=c:\Users\dusti\dev\kempo\dist\kempo\components\NotificationHistory.js.map