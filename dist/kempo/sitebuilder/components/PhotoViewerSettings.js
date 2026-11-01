import{html as t}from"/kempo-ui/lit-all.min.js";import e from"./WidgetSettings.js";export default class a extends e{get images(){return this.node.attrs?.images||[]}setImages(t){this.set("images",t,!1)}async addFromLibrary(){const t=await window.kempo.openAssetPicker({kind:"image",multiple:!0});t&&this.setImages([...this.images,...[].concat(t).map(({url:t,alt:e})=>({src:t,alt:e||""}))])}addUrl(){const t=this.renderRoot.querySelector("#sb-photo-url");t.value.trim()&&(this.setImages([...this.images,{src:t.value.trim(),alt:""}]),t.value="")}move(t,e){const a=[...this.images];[a[t],a[t+e]]=[a[t+e],a[t]],this.setImages(a)}render(){const e=this.images;return t`
      <div class="mb">
        <label class="d-b mbq">Photos<small class="d-b tc-muted">${1===e.length?"One photo shows by itself.":e.length?`${e.length} photos show as a gallery. Clicking one opens it large, and the others can be paged through.`:"Add the pictures of the gallery."}</small></label>
        ${e.map((a,i)=>t`
          <div class="d-f mbq">
            <img src="${a.src}" alt="" width="48" class="mrq">
            <input type="text" class="flex mrq" placeholder="Alternative text" aria-label="Alternative text of photo ${i+1}" .value="${a.alt||""}" @input="${t=>this.setImages(e.map((e,a)=>a===i?{...e,alt:t.target.value}:e))}">
            <button class="mrq" title="Move up" aria-label="Move photo ${i+1} up" ?disabled="${0===i}" @click="${()=>this.move(i,-1)}"><k-icon name="arrow" direction="up"></k-icon></button>
            <button class="mrq" title="Move down" aria-label="Move photo ${i+1} down" ?disabled="${i===e.length-1}" @click="${()=>this.move(i,1)}"><k-icon name="arrow" direction="down"></k-icon></button>
            <button title="Remove" aria-label="Remove photo ${i+1}" @click="${()=>this.setImages(e.filter((t,e)=>e!==i))}"><k-icon name="delete"></k-icon></button>
          </div>`)}
        ${window.kempo?.openAssetPicker?t`<button class="mbq" @click="${()=>this.addFromLibrary()}"><k-icon name="image"></k-icon> Add photos from the media library</button>`:""}
        <div class="d-f">
          <input id="sb-photo-url" type="text" class="flex mrq" placeholder="Or the URL of a picture" aria-label="URL of a picture to add" @keydown="${t=>"Enter"===t.key&&this.addUrl()}">
          <button @click="${()=>this.addUrl()}"><k-icon name="add"></k-icon> Add</button>
        </div>
      </div>
      ${e.length>1?this.renderFields():""}
    `}}customElements.define("k-photo-viewer-settings",a);
//# sourceMappingURL=C:\Users\dusti\dev\kempo\dist\kempo\sitebuilder\components\PhotoViewerSettings.js.map