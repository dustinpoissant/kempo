import { html } from '/kempo-ui/lit-all.min.js';
import WidgetSettings from './WidgetSettings.js';

/*
  The Photo viewer's settings: the pictures, added several at a time from the media library (or by URL), each with its
  alternative text and buttons to move or remove it, and how many fit in a row once there is more than one.
*/
export default class PhotoViewerSettings extends WidgetSettings {
  get images(){
    return this.node.attrs?.images || [];
  }

  setImages(images){
    this.set('images', images, false);
  }

  async addFromLibrary(){
    const choices = await window.kempo.openAssetPicker({ kind: 'image', multiple: true });
    if(!choices) return;
    this.setImages([...this.images, ...[].concat(choices).map(({ url, alt }) => ({ src: url, alt: alt || '' }))]);
  }

  addUrl(){
    const input = this.renderRoot.querySelector('#sb-photo-url');
    if(!input.value.trim()) return;
    this.setImages([...this.images, { src: input.value.trim(), alt: '' }]);
    input.value = '';
  }

  move(index, step){
    const images = [...this.images];
    [images[index], images[index + step]] = [images[index + step], images[index]];
    this.setImages(images);
  }

  render(){
    const images = this.images;
    return html`
      <div class="mb">
        <label class="d-b mbq">Photos<small class="d-b tc-muted">${images.length === 1 ? 'One photo shows by itself.' : images.length ? `${images.length} photos show as a gallery. Clicking one opens it large, and the others can be paged through.` : 'Add the pictures of the gallery.'}</small></label>
        ${images.map((image, index) => html`
          <div class="d-f mbq">
            <img src="${image.src}" alt="" width="48" class="mrq">
            <input type="text" class="flex mrq" placeholder="Alternative text" aria-label="Alternative text of photo ${index + 1}" .value="${image.alt || ''}" @input="${event => this.setImages(images.map((other, otherIndex) => (otherIndex === index ? { ...other, alt: event.target.value } : other)))}">
            <button class="mrq" title="Move up" aria-label="Move photo ${index + 1} up" ?disabled="${index === 0}" @click="${() => this.move(index, -1)}"><k-icon name="arrow" direction="up"></k-icon></button>
            <button class="mrq" title="Move down" aria-label="Move photo ${index + 1} down" ?disabled="${index === images.length - 1}" @click="${() => this.move(index, 1)}"><k-icon name="arrow" direction="down"></k-icon></button>
            <button title="Remove" aria-label="Remove photo ${index + 1}" @click="${() => this.setImages(images.filter((other, otherIndex) => otherIndex !== index))}"><k-icon name="delete"></k-icon></button>
          </div>`)}
        ${window.kempo?.openAssetPicker ? html`<button class="mbq" @click="${() => this.addFromLibrary()}"><k-icon name="image"></k-icon> Add photos from the media library</button>` : ''}
        <div class="d-f">
          <input id="sb-photo-url" type="text" class="flex mrq" placeholder="Or the URL of a picture" aria-label="URL of a picture to add" @keydown="${event => event.key === 'Enter' && this.addUrl()}">
          <button @click="${() => this.addUrl()}"><k-icon name="add"></k-icon> Add</button>
        </div>
      </div>
      ${images.length > 1 ? this.renderFields() : ''}
    `;
  }
}

customElements.define('k-photo-viewer-settings', PhotoViewerSettings);
