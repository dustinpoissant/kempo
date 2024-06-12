import Component from './Component.js';
import {
  onEvent,
  offEvent,
  dispatchEvent
} from '../utils/element.js';

const tagsInputChangeHandler = Symbol(),
      tagsInputCommaHandler = Symbol();
export default class Tags extends Component {
  constructor(){
    super();

    this[tagsInputChangeHandler] = () => {
      const $tagsInput = this.shadowRoot.getElementById('tagsInput');
      const tag = $tagsInput.value;
      if(tag){
        this.addTag(tag);
        $tagsInput.value = '';
      }
    }
    this[tagsInputCommaHandler] = (event) => {
      if(event.data === ',' || event.inputType === 'insertFromPaste'){
        const $tagsInput = this.shadowRoot.getElementById('tagsInput');
        const tags = $tagsInput.value.split(',').filter(i=>!!i);
        if(tags.length){
          tags.forEach(tag=>this.addTag(tag));
          $tagsInput.value = '';
        }
      }
    }

    this.registerAttributes({
      value: '',
      allowedTags: '',
      disallowedTags: ''
    });
  }
  attributeChangedCallback(name, oldValue, newValue){
    super.attributeChangedCallback(name, oldValue, newValue);
    if(name === 'value'){
      const validTags = this.validateTags();
      if(validTags !== newValue){
        this.value = validTags;
      } else {
        dispatchEvent(this, 'change', {
          oldValue,
          newValue
        });
        this.renderTags();
      }
    } else if(['allowed-tags', 'disallowed-tags'].includes(name)){
      const validTags = this.validateTags();
      if(validTags !== newValue){
        this.value = validTags;
      } else {
        dispatchEvent(this, `${name.replace('-','')}change`, {
          oldValue,
          newValue
        });
        this.renderTags();
      }
    }
  }
  async render(force){
    if(await super.render(force)){
      const $tagsInput = this.shadowRoot.getElementById('tagsInput');
      onEvent($tagsInput, 'change', this[tagsInputChangeHandler]);
      onEvent($tagsInput, 'input', this[tagsInputCommaHandler]);
      return true;
    }
    return false;
  }
  disconnectedCallback(){
    super.disconnectedCallback();
    const $tagsInput = this.shadowRoot.getElementById('tagsInput');
    offEvent($tagsInput, 'change', this[tagsInputChangeHandler]);
    offEvent($tagsInput, 'input', this[tagsInputCommaHandler]);
  }
  async renderTags(){
    this.render(false);
    await window.customElements.whenDefined('k-tag');
    const $tags = this.shadowRoot.getElementById('tags');
    $tags.innerHTML = '';
    const v = this.value;
    if(v) v.split(',').forEach(tag => {
      $tags.appendChild(new Tag(tag));
    });
  }
  addTag(tag){
    const tags = new Set(this.value.split(',').filter(i=>!!i));
    tags.add(tag);
    this.value = [...tags].filter(i=>!!i).join(',');
    dispatchEvent(this, 'addtag', {tag});
  }
  removeTag(tag){
    const tags = new Set(this.value.split(',').filter(i=>!!i));
    tags.delete(tag);
    this.value = [...tags].join(',');
    dispatchEvent(this, 'removetag', {tag});
  }
  validateTags(){
    return this.value
      .split(',')
      .map(t=>t.trim())
      .map(tag => {
        const allowed = new Set(this.allowedTags.split(',').filter(i=>!!i));
        if(allowed.size) return allowed.has(tag)?tag:'';
        const disallowed = new Set(this.disallowedTags.split(',').filter(i=>!!i));
        if(disallowed.size) return disallowed.has(tag)?'':tag;
        return tag;
      })
      .filter(i=>!!i).join(',');
  }

  get shadowTemplate(){
    return /*html*/`
      <label for="tagsInput">
        ${super.shadowTemplate}
        <div id="tagsHolder">
          <span id="tags"></span>
          <input id="tagsInput" />
        </div>
      </label>
    `;
  }
  get shadowStyles(){
    return /*css*/`
      ${super.shadowStyles}
      :host {
        
      }
      #tagsHolder {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        width: 100%;
        background-color: var(--input_bg);
        color: var(--input_tc);
        border: var(--input_border_width) solid var(--c_border);
        padding: 0;
        margin-bottom: var(--spacer);
        border-radius: var(--radius);
        outline: none;
        transition: box-shadow var(--animation_ms);
        cursor: default;
      }
      #tagsHolder:focus-within {
        box-shadow: var(--focus_shadow);
      }
      #tags {
        display: contents;
      }
      #tagsInput {
        display: inline-block;
        min-width: 5rem;
        width: auto;
        max-width: 100%;
        background-color: transparent;
        color: inherit;
        border: 0 solid transparent;
        margin-bottom: 0;
        border-radius: 0;
        transition: none;
      }
      #tagsInput {
        box-shadow: 0 0 0 transparent;
      }
    `;
  }

  static observedAttributes = [
    ...Component.observedAttributes,
    'value',
    'allowed-tags',
    'disallowed-tags'
  ];
}
window.customElements.define('k-tags', Tags);

const tagClickHandler = Symbol();
class Tag extends Component {
  constructor(tag){
    super();

    /* Private Methods */
    this[tagClickHandler] = () => {
      this.getRootNode().host.removeTag(tag);
    }

    /* init */
    this.innerHTML = tag;
  }
  async render(force){
    if(await super.render(force)){
      onEvent(this, 'click', this[tagClickHandler]);
      return true;
    }
    return false;
  }
  disconnectedCallback(){
    super.disconnectedCallback();
    offEvent(this, 'click', this[tagClickHandler]);
  }

  get shadowStyles(){
    return /*css*/`
      ${super.shadowStyles}
      :host {
        display: inline-block;
        width: min-content;
        margin: var(--spacer_q);
        padding: var(--spacer_q) var(--spacer_h);
        border: 1px solid var(--c_border);
        border-radius: var(--radius);
        cursor: pointer;
      }
      :host(:hover) {
        text-decoration: line-through;
      }
    `;
  }
}
window.customElements.define('k-tag', Tag);
