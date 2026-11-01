import{html as t}from"/kempo-ui/lit-all.min.js";import e from"/kempo-ui/components/Dialog.js";import"/kempo-ui/components/CodeEditor.js";import"/kempo-ui/components/Icon.js";import i from"./WidgetSettings.js";export default class n extends i{openEditor(){const t=document.createElement("k-code-editor");t.language="html",t.value=this.node.attrs?.html??"",t.style.cssText="height: 70vh; min-height: 24rem;";const i=document.createElement("div");i.className="p",i.append(t),e.create(i,{title:"Edit HTML",width:"min(90rem, 96vw)",confirmText:"Save",cancelText:"Cancel",confirmAction:()=>this.set("html",t.getValue(),!1)})}render(){const e=this.node.attrs?.html??"",i=e.split("\n").length;return t`
      <div class="mb">
        <label class="d-b mbq">HTML<small class="d-b tc-muted">Shown on the page as it is written. Scripts and styles in it run on the published page, but not in this editor.</small></label>
        <p class="tc-muted">${e?`${i} ${1===i?"line":"lines"}`:"Nothing yet."}</p>
        <button class="primary" @click="${()=>this.openEditor()}"><k-icon name="edit"></k-icon> Edit HTML</button>
      </div>
    `}}customElements.define("k-html-block-settings",n);
//# sourceMappingURL=c:\Users\dusti\dev\kempo\dist\kempo\sitebuilder\components\HtmlBlockSettings.js.map