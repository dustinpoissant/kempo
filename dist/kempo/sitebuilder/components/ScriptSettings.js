import{html as e}from"/kempo-ui/lit-all.min.js";import t from"/kempo-ui/components/Dialog.js";import"/kempo-ui/components/CodeEditor.js";import"/kempo-ui/components/Icon.js";import i from"./WidgetSettings.js";export default class s extends i{openEditor(){const e=document.createElement("k-code-editor");e.language="javascript",e.value=this.node.attrs?.code??"",e.style.cssText="height: 70vh; min-height: 24rem;";const i=document.createElement("div");i.className="p",i.append(e),t.create(i,{title:"Edit JavaScript",width:"min(90rem, 96vw)",confirmText:"Save",cancelText:"Cancel",confirmAction:()=>this.set("code",e.getValue(),!1)})}render(){const t=String(this.node.attrs?.code??"").trim(),i=t?t.split("\n").length:0,s=!!this.node.attrs?.src;return e`
      ${this.renderFields(["code"])}
      <div class="mb">
        <label class="d-b mbq">JavaScript<small class="d-b tc-muted">Runs on the page where this widget is, when there is no script file above. It runs on the published page, not in this editor.</small></label>
        <p class="tc-muted">${i?`${i} ${1===i?"line":"lines"}${s?", not used while a script file is set":""}`:"Nothing yet."}</p>
        <button class="primary" @click="${()=>this.openEditor()}"><k-icon name="edit"></k-icon> Edit JavaScript</button>
      </div>
    `}}customElements.define("k-script-settings",s);
//# sourceMappingURL=c:\Users\dusti\dev\kempo\dist\kempo\sitebuilder\components\ScriptSettings.js.map