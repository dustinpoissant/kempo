import LazyComponent from './LazyComponent.js';
import Component from './Component.js';
import './Icon.js';
import {
  onEvent,
  offEvent,
  dispatchEvent
} from '../utils/element.js';
import watchDirectoryHandle from '../utils/watchDirectoryHandle.js';

const handle = Symbol(),
      loadDirectoryClickHandler = Symbol(),
      selectedHandler = Symbol(),
      watchId = Symbol(),
      changeCallback = Symbol(),
      filters = Symbol();
export default class DirectoryViewer extends LazyComponent {
  constructor(_handle = false){
    super();
    
    /* Private Members */
    this[handle] = _handle;
    this[watchId] = false;
    this[filters] = [];

    /* Private Methods */
    this[loadDirectoryClickHandler] = () => this.loadDirectory();
    this[openToggleClickHandler] = () => {
      if(!this.root){
        this.toggleOpen();
        this.select();
      } else {
        this.clearDirectoryHandle();
      }
    }
    this[changeCallback] = () => {
      this.updateContents();
    }
    this[selectedHandler] = (e) => {
      
    }

    /* Init */
    this.registerAttributes({
      hasHandle: !!_handle,
      selected: false
    });
  }

  /* Lifecycle Callbacks */
  async render(force){
    if(await super.render(force)){
      onEvent(this.shadowRoot, 'fileSelected directorySelected', this[selectedHandler]);
      onEvent(this.shadowRoot.getElementById('loadDirectory'), 'click', this[loadDirectoryClickHandler]);
      this.renderDirectory();
      return true;
    }
    return false;
  }
  async renderDirectory(){
    if(!this[handle] || !this.rendered) return;
    this.innerHTML = this[handle].name;
    this.renderContents();
  }
  async renderContents(){
    this.querySelectorAll('[slot="content"]').forEach(e=>e.remove());
    if(
      this.rendered && 
      this[handle] &&
      (this.opened || this.root)
    ){
      for await(const entry of this[handle].values()){
        if(entry.kind === 'directory'){
          if(this.filters.every(filter=>filter(entry))){
            this.appendChild(new DirectoryViewer(entry, false));
          }
        }
      }
      for await(const entry of this[handle].values()){
        if(entry.kind === 'file'){
          if(this.filters.every(filter=>filter(entry))){
            this.appendChild(new File(entry));
          }
        }
      }
      if(!this[watchId]) this[watchId] = watchDirectoryHandle(this[handle], this[changeCallback]);
    } else {
      if(this[watchId]){
        clearInterval(this[watchId]);
        this[watchId] = false;
      }
    }
  }
  disconnectedCallback(){
    super.disconnectedCallback();
    offEvent(this.shadowRoot, 'fileselected', this[fileSelectedHandler]);
    offEvent(this.shadowRoot.getElementById('loadDirectory'), 'click', this[loadDirectoryClickHandler]);
    offEvent(this.shadowRoot.getElementById('openToggle'), 'click', this[openToggleClickHandler]);
  }
  attributeChangedCallback(n, oV, nV){
    if(n === 'opened' && oV !== nV){
      if(!nV && this.root){
        this.opened = true; // root must be opened
      } else {
        this.renderContents();
      }
    }
  }

  /* Protected Members */
  get rootDir(){
    if(this.root) return this;
    else return this.closest('k-directory-viewer[root="true"]')
  }
  get filters(){
    return this.rootDir[filters];
  }


  /* Public Methods */
  async loadDirectory(){
    if(window.showDirectoryPicker){
      this[handle] = await window.showDirectoryPicker();
      if(this[handle]){
        this.hasHandle = true;
        dispatchEvent(this, 'directoryloaded', {
          dirHandle: this[handle],
          dirComponent: this
        });
        this.renderDirectory();
      }
    }
  }
  clearDirectoryHandle(){
    this[handle] = false;
    this.hasHandle = false;
    this.innerHTML = '';
  }
  async updateContents(){
    if(this.opened || this.root){
      const existingSubDirSet = new Set([...this.querySelectorAll('k-directory-viewer')]);
      for await(const entry of this[handle].values()){
        if(entry.kind === 'directory'){
          const existingSubDirsArray = [...existingSubDirSet];
          const $existing = existingSubDirsArray.find(($e)=>entry.isSameEntry($e[handle])&&entry.name===$e[handle].name);
          if($existing){
            this.appendChild($existing)
            existingSubDirSet.delete($existing);
          } else this.appendChild(new DirectoryViewer(entry, false));
        }
      }
      existingSubDirSet.forEach($e=>$e.remove()); // remove unused dirs

      const existingFileSet = new Set([...this.querySelectorAll('k-directory-viewer-file')]);
      for await(const entry of this[handle].values()){
        if(entry.kind === 'file'){
          const existingFileArray = [...existingFileSet];
          const $existing = existingFileArray.find(($e)=>entry.isSameEntry($e[handle])&&entry.name===$e[handle].name);
          if($existing){
            this.appendChild($existing)
            existingFileSet.delete($existing);
          } else this.appendChild(new File(entry));
        }
      }
      existingFileSet.forEach($e=>$e.remove()); // remove unused files
      if(!this[watchId]) this[watchId] = watchDirectoryHandle(this[handle], this[changeCallback]);
    } else {
      if(this[watchId]){
        clearInterval(this[watchId]);
        this[watchId] = false;
      }
    }
  }
  select(){
    const $currentSelection = this.querySelector('k-directory[selected], k-file[selected]');
    if($currentSelection === this) return;
    if($currentSelection) $currentSelection.selected = false;
    this.selected = true;
    this.dispatchEvent(new CustomEvent('dirSelected', {
      detail: {
        dirHandle: this[handle],
        dirComponent: this
      },
      bubbles: true,
      composed: true
    }));
  }
  addFilter(filter){
    this[filters].push(filter);
    this.renderContents();
  }

  /* Shadow DOM */
  get shadowTemplate(){
    return /*html*/`
      <button
        id="loadDirectory"
      >
        <slot name="selectButton">
          <k-icon name="folder-create"></k-icon> Select Directory
        </slot>
      </button>
      <button
        id="openToggle"
        class="no-btn"
      >
        <k-icon name="folder" id="folder-closed"></k-icon>
        <k-icon name="folder-open" id="folder-opened"></k-icon>
        <k-icon name="folder-clear" id="folder-clear"></k-icon>
        ${super.shadowTemplate}
      </button>
      <div id="tree">
        <slot name="content"></slot>
      </div>
    `;
  }
  get shadowStyles(){
    return /*css*/`
      ${super.shadowStyles}
      :host([has-handle]) #loadDirectory,
      :host([opened]) #folder-closed,
      :host(:not([opened])) #folder-opened,
      :host(:not([has-handle])) #folder-closed,
      :host(:not([has-handle])) #folder-opened,
      :host(:not([has-handle])) #folder-clear,
      :host(:not([root])) #folder-clear,
      :host([root]) #folder-opened {
        display: none;
      }
      #openToggle {
        display: block;
        width: 100%;
        flex: 1 1 auto;
      }
      #tree {
        padding-left: var(--spacer);
      }
      #wrapper {
        display: flex;
      }
      #clearSelectedDirectory {
        flex: none;
      }
      :host([selected]) #openToggle {
        background-color: var(--c_primary);
        color: var(--tc_on_primary);
        border-radius: var(--raidus);
      }
    `;
  }

  static observedAttributes = [
    ...LazyComponent.observedAttributes,
    'opened'
  ];

  static watchInterval = 1000;
}
window.customElements.define('k-directory-viewer', DirectoryViewer);

export class Directory extends Component {
  constructor(_handle = false){
    super();

    /* Private Members */
    this[handle] = _handle;

    /* Private Methods */
    this[selectDirectoryClickHandler] = () => this.select();

    /* Init */
    this.slot = 'content';
    this.registerAttribute('selected', false);
  }

  /* Lifecycle Callbacks */
  async render(force){
    if(await super.render(force)){
      if(this[handle]){
        this.innerHTML = this[handle].name;
        onEvent(this.shadowRoot.getElementById('selectDirectory'), 'click', this[selectDirectoryClickHandler]);
      }
      return true;
    }
    return false;
  }
  disconnectedCallback(){
    super.disconnectedCallback();
    offEvent(this.shadowRoot.getElementById('selectDirectory'), 'click', this[selectDirectoryClickHandler]);
  }

  /* Protected Members */
  get rootDir(){
    return this.closest('k-directory-viewer')
  }

  /* Public Methods */
  select(){
    const $currentSelection = this.rootDir.querySelector('k-directory[selected], k-file[selected]');
    if($currentSelection === this) return;
    if($currentSelection) $currentSelection.selected = false;
    this.selected = true;
    this.dispatchEvent(new CustomEvent('directorySelected', {
      detail: {
        fileHandle: this[handle],
        fileComponent: this
      },
      bubbles: true,
      composed: true
    }));
  }

  /* Shadow DOM */
  get shadowTemplate(){
    return /*html*/`
      <button
        id="selectDirectory"
      >
        <slot name="selectButton">
          <k-icon id="extIcon" name="file"></k-icon> ${this[handle].name}
        </slot>
      </button>
      ${super.shadowTemplate}
    `;
  }
  get shadowStyles(){
    return /*css*/`
      ${super.shadowStyles}
      :host([selected]) #selectFile {
        background-color: var(--c_primary);
        color: var(--tc_on_primary);
        border-radius: var(--raidus);
      }
    `;
  }
}

const selectFileClickHandler = Symbol();
export class File extends Component {
  constructor(_handle = false){
    super();

    /* Private Members */
    this[handle] = _handle;

    /* Private Methods */
    this[selectFileClickHandler] = () => this.select();

    /* Init */
    this.slot = 'content';
    this.registerAttribute('selected', false);
  }

  /* Lifecycle Callbacks */
  async render(force){
    if(await super.render(force)){
      if(this[handle]){
        this.innerHTML = this[handle].name;
        const ext = this[handle].name.split('.').pop();
        const $extIcon = this.shadowRoot.getElementById('extIcon');
        if(['png', 'gif', 'jpeg', 'jpg', 'tif', 'webp'].includes(ext)){
          $extIcon.name = 'image';
        } else if(['txt', 'rtf', 'js', 'css', 'html',].includes(ext)){
          $extIcon.name = 'file-text';
        } else {
          $extIcon.name = 'file';
        }
        onEvent(this.shadowRoot.getElementById('selectFile'), 'click', this[selectFileClickHandler]);
      }
      return true;
    }
    return false;
  }
  disconnectedCallback(){
    super.disconnectedCallback();
    offEvent(this.shadowRoot.getElementById('selectFile'), 'click', this[selectFileClickHandler]);
  }

  /* Protected Members */
  get rootDir(){
    return this.closest('k-directory-viewer')
  }

  /* Public Methods */
  select(){
    const $currentSelection = this.rootDir.querySelector('k-directory[selected], k-file[selected]');
    if($currentSelection === this) return;
    if($currentSelection) $currentSelection.selected = false;
    this.selected = true;
    this.dispatchEvent(new CustomEvent('fileSelected', {
      detail: {
        fileHandle: this[handle],
        fileComponent: this
      },
      bubbles: true,
      composed: true
    }));
  }


  /* Shadow DOM */
  get shadowTemplate(){
    return /*html*/`
      <button
        id="selectFile"
        class="no-btn"
      >
        <k-icon
          id="extIcon"
          name=""
        ></k-icon>
        ${super.shadowTemplate}
    </button>
    `;
  }
  get shadowStyles(){
    return /*css*/`
      ${super.shadowStyles}
      :host {
        display: block;
        width: 100%;
      }
      :host([selected]) {
        background-color: var(--c_primary);
        color: var(--tc_on_primary);
        border-radius: var(--raidus);
      }
      #selectFile {
        width: 100%;
      }
    `
  }
}
window.customElements.define('k-directory-viewer-file', File);
