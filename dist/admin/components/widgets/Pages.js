import e from"/kempo/components/DashboardWidget.js";import{html as t,nothing as a}from"/kempo-ui/lit-all.min.js";import{listPages as s,listTemplates as i,createPage as l}from"/kempo/sdk.js";export default class d extends e{static properties={...e.properties,total:{state:!0},disabled:{state:!0},recent:{state:!0}};constructor(){super(),this.total=0,this.disabled=0,this.recent=[],this.cta={label:"New page",icon:"add",permission:"system:pages:create",onClick:()=>this.newPage()}}load=async()=>{const{pages:e,total:t}=await this.unwrap(s({showHidden:!0}));this.total=t,this.disabled=e.filter(e=>e.disabled).length,this.recent=e.slice().sort((e,t)=>(Date.parse(t.updatedAt)||0)-(Date.parse(e.updatedAt)||0))};newPage=async()=>{const{templates:e}=await this.unwrap(i());this.openForm({title:"New page",confirmText:"Create",fields:[{name:"name",label:"Page name",placeholder:"My new page"},{name:"template",label:"Template",type:"select",value:"default",options:e.map(({name:e})=>({value:e,label:e}))}],submit:async({name:e,template:t})=>{const[a,s]=await l({directory:"",name:e,template:t});if(a)return a.msg||"Could not create the page.";window.location.href=`/admin/content/pages/edit?path=${encodeURIComponent(s.file.replace(/\.page\.html$/,""))}`}})};renderHeader(){return t`
      <header class="d-f px pyh bb" style="align-items: center;">
        ${this.renderTitle()}
        ${this.renderActions()}
        <button class="no-btn pq" title="Refresh" aria-label="Refresh pages" @click=${this.refresh}><k-icon name="restart_alt"></k-icon></button>
      </header>
    `}renderContent(){const e=this.recent.slice(0,3*this.height);return t`
      <div class="d-f mb">
        <div class="flex"><div class="h2 m0">${this.total}</div><div class="small tc-muted">Pages</div></div>
        <div class="flex"><div class="h2 m0">${this.total-this.disabled}</div><div class="small tc-muted">Enabled</div></div>
        <div class="flex"><div class="h2 m0">${this.disabled}</div><div class="small tc-muted">Disabled</div></div>
      </div>
      ${e.length?t`
        <div class="small tc-muted mbq">Recently updated</div>
        ${e.map(e=>t`
          <a class="d-b py bb" href="/admin/content/pages/edit?path=${encodeURIComponent(e.file.replace(/\.page(-disabled)?\.html$/,""))}">
            ${e.title||e.name||e.url}
            <span class="small tc-muted">${e.url}</span>
          </a>
        `)}
      `:a}
    `}}customElements.define("k-widget-pages",d);
//# sourceMappingURL=C:\Users\dusti\dev\kempo\dist\admin\components\widgets\Pages.js.map