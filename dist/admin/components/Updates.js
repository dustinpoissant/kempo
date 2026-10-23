import e from"/kempo-ui/components/ShadowComponent.js";import{html as t,nothing as s}from"/kempo-ui/lit-all.min.js";import"/kempo-ui/components/Spinner.js";import"/kempo-ui/components/Dialog.js";import"/kempo-ui/components/Icon.js";import a from"/kempo-ui/components/Toast.js";import{getUpdateStatus as n,checkForUpdate as i,prepareUpdate as r,applyUpdate as o,rollbackUpdate as c,discardUpdate as l}from"/kempo/sdk.js";const h="kempo-after-update",d=e=>e?new Date(e).toLocaleString():"never",p=e=>new Promise(t=>setTimeout(t,e)),m=(e,t,s)=>`${e} ${1===e?t:s}`,g=(e,t)=>e.split(".").map(Number).reduce((e,s,a)=>e||s-Number(t.split(".")[a]),0)<0;export default class u extends e{static properties={status:{state:!0},error:{state:!0},checking:{state:!0},phase:{state:!0},stalled:{state:!0},action:{state:!0},chosen:{state:!0}};constructor(){super(),this.status=null,this.error="",this.checking=!1,this.phase="idle",this.stalled=!1,this.action="update",this.chosen=null}connectedCallback(){super.connectedCallback(),this.load()}load=async()=>{const[e,t]=await n();e?this.error=e.msg||"The update status could not be loaded":(this.error="",this.status=t,this.selectNew(t),this.reportOutcome())};updatable=e=>[...e.updateAvailable?[{key:"kempo",name:"Kempo",from:e.runningVersion,to:e.latestVersion,major:e.major}]:[],...(e.extensionUpdates?.updates??[]).map(e=>({key:e.name,name:e.name,from:e.installedVersion,to:e.latestVersion,major:e.major,needs:e.kempoRequired}))];selectNew=e=>{this.seen??=new Set;const t=new Set(this.chosen??[]);for(const{key:s}of this.updatable(e))this.seen.has(s)||(this.seen.add(s),t.add(s));this.chosen=t};blocked=(e,t)=>Boolean(e.needs)&&g(t.runningVersion,e.needs)&&!(this.chosen.has("kempo")&&t.updateAvailable&&!g(t.latestVersion,e.needs));chosenItems=()=>this.updatable(this.status).filter(e=>this.chosen.has(e.key)&&!this.blocked(e,this.status));toggle=e=>{const t=new Set(this.chosen);t.has(e)?t.delete(e):t.add(e),this.chosen=t};reportOutcome=()=>{try{const e=JSON.parse(sessionStorage.getItem(h)||"null");if(!e)return;sessionStorage.removeItem(h);this.status.lastUpdate&&!this.status.lastUpdate.ok&&this.status.lastUpdate.at>e.at?a.error("The update did not work, so the site went back to how it was"):a.success(e.message)}catch{}};check=async()=>{this.checking=!0;const[e,t]=await i();if(this.checking=!1,e)return void a.error(e.msg);this.status=t,this.selectNew(t);const s=t.checkError||t.extensionUpdates?.checkError;s?a.error(s):this.updatable(t).length||t.staged||a.success("Everything is up to date")};selection=()=>{const e=this.chosenItems();return{version:e.some(e=>"kempo"===e.key)?this.status.latestVersion:null,extensions:e.filter(e=>"kempo"!==e.key).map(e=>e.key)}};prepare=async()=>{this.phase="preparing";const[e]=await r(this.selection());this.phase="idle",e?a.error(e.msg):await this.load()};discard=async()=>{const[e]=await l();e?a.error(e.msg):await this.load()};openConfirm=e=>{this.action=e,this.renderRoot.querySelector("#confirmDialog").open()};confirmed=async()=>{const{staged:e,bootId:t,mode:s,lastUpdate:n}=this.status;let i,r,l;if(this.stalled=!1,"back"===this.action)this.phase="going-back",[i,r]=await c({data:Boolean(n?.breaking)}),l="The site is back on what it ran before the last update";else if("release"===s)this.phase="switching",[i,r]=await o({confirm:{forced:e.plan.files.forced.length>0,breaking:e.plan.breaking}}),l=`Updated: ${e.packages.join(", ")}`;else{this.phase="installing";const{version:e,extensions:t}=this.selection();[i,r]=await o({version:e,extensions:t}),l=`Updated: ${this.chosenItems().map(e=>`${e.name} ${e.to}`).join(", ")}`}if(i)return this.phase="idle",void a.error(i.msg);if(this.phase="restarting",await this.waitForServer(t)){try{sessionStorage.setItem(h,JSON.stringify({message:l,at:new Date(Date.now()-5e3).toISOString(),to:r.to}))}catch{}window.location.reload()}else this.stalled=!0};waitForServer=async e=>{const t=Date.now();let s=!1;for(;Date.now()-t<6e5;){await p(2e3);try{const t=await fetch("/kempo/api/updates?offline=true",{credentials:"same-origin",cache:"no-store"});if(t.ok){if((await t.json()).bootId!==e)return!0}else if(t.status>=500)s=!0;else if(s)return!0}catch{s=!0}}return!1};renderBusy(){const[e,s]={preparing:["Downloading the updates…","Your site keeps working while this happens. It can take a few minutes."],installing:["Installing the updates…","This can take a minute."],switching:["Switching to the updates…","This can take a minute."],"going-back":["Going back…","This can take a minute."],restarting:["Restarting the server…","This page reloads by itself when the site is back, and updated extensions are brought up to date first."]}[this.phase];return t`
      <div class="b r p mb" role="status">
        <p class="d-f mb"><k-spinner class="mr"></k-spinner><strong>${e}</strong></p>
        <p class="tc-muted">${s} Please keep this page open.</p>
      </div>
    `}renderStalled(){return t`
      <div class="b r p mb" role="alert">
        <p class="tc-danger mb"><strong>The server did not come back within ten minutes.</strong></p>
        <p class="mb">Check that the server process is running; if it is managed by pm2, systemd or Docker, check that it restarts when it exits.</p>
        <button class="primary" @click=${()=>window.location.reload()}>Reload this page</button>
      </div>
    `}renderRestartNote(e){return"respawn"===e.restart?t`The site is unavailable for a few seconds while the server restarts.`:t`The server restarts, which takes a few seconds, and the site is unavailable until it is back.`}renderPlan(e){const{update:a,add:n,edited:i,forced:r}=e.files,o=e.upgrades.filter(e=>e.breaking),c=e.extensions.filter(e=>e.breaking),l=!(a.length||n.length||i.length||r.length||e.upgrades.length||e.extensions.length),h={permissions:["permission","permissions"],settings:["setting","settings"],groups:["group","groups"],widgets:["dashboard widget","dashboard widgets"],jobs:["scheduled job","scheduled jobs"]},d=e=>Object.entries(e.adds).filter(([,e])=>e).map(([e,t])=>m(t,...h[e])).join(", ");return t`
      <ul class="mb">
        ${l?t`<li>Nothing changes except the code.</li>`:s}
        ${e.extensions.map(e=>t`<li>${e.name} ${e.from} <k-icon name="arrow" direction="right"></k-icon> ${e.to}${d(e)?t` <span class="tc-muted">adds ${d(e)}</span>`:s}</li>`)}
        ${a.length?t`<li>${m(a.length,"starter file","starter files")} you have not edited will be updated.</li>`:s}
        ${n.length?t`<li>${m(n.length,"new file","new files")} will be added.</li>`:s}
        ${i.length?t`<li>${m(i.length,"file","files")} you have edited will stay as you made ${1===i.length?"it":"them"}, even though Kempo has a newer version: <span class="tc-muted">${i.join(", ")}</span></li>`:s}
        ${r.length?t`<li class="tc-warning"><k-icon name="warning"></k-icon> ${m(r.length,"file","files")} you have edited must be replaced for security reasons. Your version is saved first: <span class="tc-muted">${r.join(", ")}</span></li>`:s}
        ${o.length?t`<li class="tc-warning"><k-icon name="warning"></k-icon> Kempo changes your data${o.some(e=>e.description)?t` (${o.map(e=>e.description).filter(Boolean).join("; ")})`:s}.</li>`:s}
        ${c.length?t`<li class="tc-warning"><k-icon name="warning"></k-icon> ${c.map(e=>e.name).join(", ")} ${1===c.length?"is a breaking update that":"are breaking updates that"} may change your data.</li>`:s}
        ${e.breaking?t`<li class="tc-warning"><k-icon name="warning"></k-icon> A backup of the database is taken first. Going back later restores it, which loses anything entered after the update.</li>`:s}
      </ul>
    `}renderStaged(e){const{staged:s}=e;return t`
      <div class="b r p mb">
        <h2 class="h4 mb">${m(s.packages.length,"update is","updates are")} ready</h2>
        <p class="tc-muted mb">${s.packages.join(", ")}. ${1===s.packages.length?"It is":"They are"} downloaded next to your running site, which has not changed. Switching will:</p>
        ${this.renderPlan(s.plan)}
        <p class="tc-muted mb">${this.renderRestartNote(e)}</p>
        <button class="primary mr" @click=${()=>this.openConfirm("update")}>Switch now</button>
        <button @click=${this.discard}>Not now</button>
      </div>
    `}renderRow(e,a){const n=this.blocked(e,a);return t`
      <label class="d-f mb">
        <input type="checkbox" class="mr" ?checked=${this.chosen.has(e.key)&&!n} ?disabled=${n||"idle"!==this.phase} @change=${()=>this.toggle(e.key)}>
        <span><strong>${e.name}</strong> ${e.from} <k-icon name="arrow" direction="right"></k-icon> ${e.to}${e.major?t` <span class="tc-warning">breaking release</span>`:s}
          ${n?t`<small class="d-b tc-muted">Needs Kempo ${e.needs} or newer: tick Kempo as well.</small>`:s}</span>
      </label>
    `}renderAvailable(e){const a=this.updatable(e),n=this.chosenItems(),i=n.filter(e=>e.major);return t`
      <div class="b r p mb">
        <h2 class="h4 mb">${m(a.length,"update is","updates are")} available</h2>
        <div class="mb">${a.map(t=>this.renderRow(t,e))}</div>
        ${i.length?t`<p class="tc-warning mb" role="alert"><k-icon name="warning"></k-icon> ${i.map(e=>e.name).join(", ")} ${1===i.length?"is a breaking release":"are breaking releases"} and may change how things work. Read ${1===i.length?"its":"their"} release notes before updating.</p>`:s}
        ${e.canUpdate?"release"===e.mode?t`
          <p class="tc-muted mb">Getting them ready downloads them without touching your site. You choose when to switch.</p>
          <button class="primary" ?disabled=${!n.length} @click=${this.prepare}>Get ${m(n.length,"update","updates")} ready</button>
        `:t`
          <p class="tc-muted mb">${this.renderRestartNote(e)}</p>
          <button class="primary" ?disabled=${!n.length} @click=${()=>this.openConfirm("update")}>Update ${m(n.length,"item","items")}</button>
        `:t`<p class="mb">${e.reason} Update where it is installed, then restart the server.</p>`}
      </div>
    `}renderCurrent(){return t`
      <div class="b r p mb">
        <h2 class="h4 mb"><k-icon name="check" class="tc-success"></k-icon> Everything is up to date</h2>
        <p class="tc-muted">This site runs Kempo ${this.status.runningVersion}${this.status.latestVersion?", the newest version":""}, and its extensions are on their newest versions.</p>
      </div>
    `}renderLast(e){const a=e.lastUpdate;return!a||a.ok?s:t`
      <div class="b r p mb" role="alert">
        <h2 class="h5 mb tc-danger">The last update did not work</h2>
        <p>The update of ${a.packages?.length?a.packages.join(", "):"Kempo"} on ${d(a.at)} did not stay running (${a.reason}), so the site went back to how it was.${a.breaking?" Your data was restored from the backup taken before it.":""}</p>
      </div>
    `}renderGoBack(e){if(!e.canGoBack)return s;const a=e.lastUpdate;return t`<p class="mb"><button @click=${()=>this.openConfirm("back")}>Go back</button> <span class="tc-muted">Puts the site back on what it ran before the last update${a?.ok&&a.packages?.length?` (${a.packages.join(", ")})`:""}.</span></p>`}renderDatabase(e){const{applied:a=[],failed:n=[]}=e.database??{},{upgraded:i=[],failed:r=[]}=e.extensionsRun??{};return t`
      ${n.length?t`
        <div class="b r p mb" role="alert">
          <h2 class="h5 mb tc-danger">The database needs attention</h2>
          <p class="mb">Kempo started, but these changes to its tables were not applied. Anything that depends on them may not work until they are.</p>
          <ul class="mb">
            ${n.map(({change:e,reason:s})=>t`<li>${e}: <span class="tc-danger">${s}</span></li>`)}
          </ul>
          <p class="tc-muted">Kempo only ever adds to its tables on its own. It never drops or changes anything that holds data, so these need someone who can look at the database.</p>
        </div>
      `:s}
      ${r.length?t`
        <div class="b r p mb" role="alert">
          <h2 class="h5 mb tc-danger">An extension could not be brought up to date</h2>
          <ul class="mb">${r.map(({name:e,from:s,to:a,reason:n})=>t`<li>${e} ${s} <k-icon name="arrow" direction="right"></k-icon> ${a}: <span class="tc-danger">${n}</span></li>`)}</ul>
          <p class="tc-muted">It is tried again the next time the server starts.</p>
        </div>
      `:s}
      ${a.length||i.length?t`
        <div class="b r p mb">
          <h2 class="h5 mb">Brought up to date when the server last started</h2>
          <ul>
            ${i.map(({name:e,from:s,to:a})=>t`<li>${e} ${s} <k-icon name="arrow" direction="right"></k-icon> ${a}</li>`)}
            ${a.map(e=>t`<li>${e}</li>`)}
          </ul>
        </div>
      `:s}
    `}renderDialog(e){const a="back"===this.action,n=e.staged?.plan.files.forced??[],i=!a&&(e.staged?.plan.breaking??!1),r="release"===e.mode?e.staged?.packages??[]:this.chosen?this.chosenItems().map(e=>`${e.name} ${e.to}`):[];return t`
      <k-dialog id="confirmDialog" confirm-text=${a?"Go back and restart":"Update and restart"} confirm-classes="primary ml" cancel-text="Cancel" .confirmAction=${this.confirmed}>
        <h2 slot="title" class="h5 pyh px m0">${a?"Go back":"Update"}</h2>
        <div class="p">
          <p class="mb">${a?"This puts the site back on what it ran before the last update.":`This updates ${r.join(", ")}.`} ${this.renderRestartNote(e)}</p>
          ${n.length?t`<p class="tc-warning mb"><k-icon name="warning"></k-icon> Your edits to ${n.join(", ")} will be replaced. Your version is saved first.</p>`:s}
          ${i?t`<p class="tc-warning mb"><k-icon name="warning"></k-icon> This update changes your data. A backup is taken first, and going back later restores it, which loses anything entered after the update.</p>`:s}
          ${a&&e.lastUpdate?.breaking?t`<p class="tc-warning mb"><k-icon name="warning"></k-icon> The update changed your data, so going back restores the database from before it. Anything entered since is lost.</p>`:s}
          <p class="tc-muted">Anyone using the site meanwhile will not be able to reach it. This page reloads when the server is back.</p>
        </div>
      </k-dialog>
    `}render(){const e=this.status;if(this.error)return t`<p class="tc-danger" role="alert">${this.error}</p>`;if(!e)return t`<k-spinner></k-spinner>`;const a=this.updatable(e);return t`
      ${"idle"!==this.phase?this.renderBusy():s}
      ${this.stalled?this.renderStalled():s}
      ${"idle"===this.phase?t`
        ${this.renderLast(e)}
        ${this.renderDatabase(e)}
        ${e.staged?this.renderStaged(e):a.length?this.renderAvailable(e):this.renderCurrent()}
        ${e.checkError||e.extensionUpdates?.checkError?t`<p class="tc-danger mb" role="alert">The last check failed: ${e.checkError||e.extensionUpdates.checkError}</p>`:s}
        <p class="d-f mb">
          <button ?disabled=${this.checking} @click=${this.check}>${this.checking?"Checking…":"Check now"}</button>
          <span class="tc-muted ph">Last checked ${d(e.checkedAt)}</span>
        </p>
        ${this.renderGoBack(e)}
        <p class="tc-muted">Automatic checks can be turned off with <strong>update_check_enabled</strong> on the System tab of <a href="/admin/settings">Settings</a>. Installing or removing an extension is done from <a href="/admin/extensions">Extensions</a>.</p>
      `:s}
      ${this.renderDialog(e)}
    `}}customElements.define("k-admin-updates",u);
//# sourceMappingURL=C:\Users\dusti\dev\kempo\dist\admin\components\Updates.js.map