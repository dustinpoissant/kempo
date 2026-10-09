import t from"/kempo-ui/components/LightComponent.js";import{html as i,nothing as e}from"/kempo-ui/lit-all.min.js";import"/kempo-ui/components/Dropdown.js";import"/kempo-ui/components/Icon.js";import"./NotificationList.js";import{getUnreadNotificationCount as n,markAllNotificationsRead as s}from"/kempo/sdk.js";export default class o extends t{static properties={pageHref:{type:String,attribute:"page-href"},interval:{type:Number},openDirection:{type:String,attribute:"open-direction"},count:{state:!0},signedOut:{state:!0}};#t=null;constructor(){super(),this.pageHref="",this.interval=6e4,this.openDirection="down right",this.count=0,this.signedOut=!1}connectedCallback(){super.connectedCallback(),window.addEventListener("focus",this.refreshCount),document.addEventListener("visibilitychange",this.handleVisibility),this.refreshCount(),this.interval>0&&(this.#t=setInterval(this.handleTick,this.interval))}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("focus",this.refreshCount),document.removeEventListener("visibilitychange",this.handleVisibility),clearInterval(this.#t)}refreshCount=async()=>{const[t,i]=await n();if(t)return this.signedOut=401===t.code,void(this.signedOut&&(this.count=0));this.signedOut=!1,this.count=i.count};handleTick=()=>{document.hidden||this.refreshCount()};handleVisibility=()=>{document.hidden||this.refreshCount()};handleOpened=t=>{t.target.closest("k-notification-bell")===this&&(this.querySelector("k-notification-list")?.refresh(),this.refreshCount())};handleChange=t=>{this.count=t.detail.unread};markAll=async()=>{await s(),await(this.querySelector("k-notification-list")?.refresh())};renderLightDom(){return this.signedOut?e:i`
      <k-dropdown close-on-select="false" open-direction=${this.openDirection} @opened=${this.handleOpened}>
        <button slot="trigger" class="no-btn d-f" aria-label=${this.count?`Notifications, ${this.count} unread`:"Notifications"}>
          <k-icon name="notifications"></k-icon>
          ${this.count?i`<span class="bg-danger round pxh ml" data-unread-badge>${this.count>99?"99+":this.count}</span>`:e}
        </button>
        <div @notifications-change=${this.handleChange}>
          <div class="d-f p b-bottom">
            <strong class="flex">Notifications</strong>
            <button class="link" ?disabled=${!this.count} @click=${this.markAll}>Mark all read</button>
          </div>
          <k-notification-list compact page-size="8"></k-notification-list>
          ${this.pageHref?i`<div class="ta-center p"><a href=${this.pageHref}>View all</a></div>`:e}
        </div>
      </k-dropdown>
    `}}customElements.define("k-notification-bell",o);
//# sourceMappingURL=C:\Users\dusti\dev\kempo-notifications\dist\kempo\components\NotificationBell.js.map