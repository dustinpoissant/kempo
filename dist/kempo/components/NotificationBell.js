import t from"/kempo-ui/components/LightComponent.js";import{html as i,nothing as e}from"/kempo-ui/lit-all.min.js";import"/kempo-ui/components/Dropdown.js";import"/kempo-ui/components/Icon.js";import"./NotificationList.js";import{onNoticeCount as o}from"/kempo/notifications/client.js";import{markAllNotificationsViewed as n}from"/kempo/sdk.js";export default class s extends t{static properties={pageHref:{type:String,attribute:"page-href"},openDirection:{type:String,attribute:"open-direction"},buttonClass:{type:String,attribute:"button-class"},count:{state:!0}};#t=null;#i=null;constructor(){super(),this.pageHref="",this.openDirection="down right",this.buttonClass="",this.count=null}connectedCallback(){super.connectedCallback(),this.#t=o(t=>{this.count=t})}disconnectedCallback(){super.disconnectedCallback(),this.#t?.(),clearTimeout(this.#i)}handleOpened=t=>{if(t.target.closest("k-notification-bell")!==this)return;const i=this.querySelector("k-notification-list");i?.refresh(),clearTimeout(this.#i),this.#i=setTimeout(()=>i?.viewVisible(),1e3)};handleClosed=t=>{t.target.closest("k-notification-bell")===this&&clearTimeout(this.#i)};handleChange=t=>{this.count=t.detail.unread};markAll=async()=>{await n({type:"notice"}),await(this.querySelector("k-notification-list")?.refresh())};renderLightDom(){return null===this.count?e:i`
      <k-dropdown close-on-select="false" open-direction=${this.openDirection} @opened=${this.handleOpened} @closed=${this.handleClosed}>
        <button slot="trigger" class="no-btn d-f ${this.buttonClass}" aria-label=${this.count?`Notifications, ${this.count} unread`:"Notifications"}>
          <k-icon name="notifications"></k-icon>
          ${this.count?i`<span class="bg-danger round pxh ml" data-unread-badge>${this.count>99?"99+":this.count}</span>`:e}
        </button>
        <div @notifications-change=${this.handleChange}>
          <div class="d-f p b-bottom">
            <strong class="flex">Notifications</strong>
            <button class="link" ?disabled=${!this.count} @click=${this.markAll}>Mark all read</button>
          </div>
          <k-notification-list type="notice" compact page-size="8"></k-notification-list>
          ${this.pageHref?i`<div class="ta-center p"><a href=${this.pageHref}>View all</a></div>`:e}
        </div>
      </k-dropdown>
    `}}customElements.define("k-notification-bell",s);
//# sourceMappingURL=c:\Users\dusti\dev\kempo\dist\kempo\components\NotificationBell.js.map