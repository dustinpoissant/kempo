import Component from './Component.js';
import {
  dispatchEvent
} from '../utils/element.js';

const clickHandler = Symbol();
export class Tab extends Component {
  constructor(){
    super();

    /* Private Methods */
    this[clickHandler] = () => {
      if(!this.active){
        this.tabs.active = this.for;
      }
    }

    /* Init */
    this.slot = 'tabs';
    this.registerAttribute('active', false);
  }

  connectedCallback(){
    super.connectedCallback();
    this.shadowRoot.getElementById('button').addEventListener('click', this[clickHandler]);
  }

  get for(){
    const forValue = this.getAttribute('for');
    if(forValue) return forValue;
    return this?.tabs.tabs.indexOf(this);
  }
  set for(v){
    if(v){
      this.setAttribute('for', v);
    } else {
      this.removeAttribute('for');
    }
  }

  get tabs(){
    return this.parentElement.tagName === 'K-TABS'?this.parentElement:null;
  }

  get shadowTemplate(){
    return /*html*/`
      <button id="button">
        ${super.shadowTemplate}
      </button>
    `;
  }
  get shadowStyles(){
    return /*css*/`
      :host {
        margin-bottom: -1px;
      }
      #button {
        padding: var(--spacer_h);
        background-color: transparent;
        border: none;
        cursor: inherit;
        box-shadow: none;
        color: inherit;
      }
      :host(:not([active])) #button {
        cursor: pointer;
      }
      :host([active]){
        border-bottom: 2px solid var(--c_primary);
        margin-bottom: -1px;
      }
      :host([active]) #button {
        color: var(--tc_primary);
      }
    `;
  }

}
window.customElements.define('k-tab', Tab);

export class TabContent extends Component {
  constructor(){
    super();

    this.registerAttribute('active', false);
  }

  get tabs(){
    return this.parentElement.tagName === 'K-TABS'?this.parentElement:null;
  }
  get name(){
    const name = this.getAttribute('name');
    if(name) return name;
    return this?.tabs.contents.indexOf(this);
  }
  set name(v){
    if(v){
      this.setAttribute('name', v);
    } else {
      this.removeAttribute('name');
    }
  }

  get shadowStyles(){
    return /*css*/`
      ${super.shadowStyles}
      :host {
        display: block;
        height: 100%;
        max-height: 100%;
        flex: 1 1 auto;
        overflow: hidden;
      }
      :host([active]) {
        display: block;
      }
      :host(:not([active])) {
        display: none;
      }
    `;
  }
}
window.customElements.define('k-tab-content', TabContent);

export class Tabs extends Component {
  constructor(){
    super();
    this.registerAttribute('active', '');
  }

  async connectedCallback(){
    await super.connectedCallback();
    if(!this.active){
      this.active = `${this.querySelectorAll('k-tab-content')[0].name}`;
    }
  }
  attributeChangedCallback(n, oV, nV){
    if(n === 'active'){
      const $activeTab = this.getActiveTab();
      if($activeTab) $activeTab.active = false;
      const $activeContent = this.getActiveContent();
      if($activeContent) $activeContent.active = false;
      const $tab = this.getTab(nV);
      if($tab) $tab.active = true;
      const $content = this.getContent(nV);
      if($content) $content.active = true;
      dispatchEvent(this, 'tab', { tab: nV });
    }
  }

  get contents(){
    return [...this.querySelectorAll(':scope > k-tab-content')];
  }
  get tabs(){
    return [...this.querySelectorAll(':scope > k-tab')];
  }

  getTab(id){
    let $tab;
    if(typeof(id) === 'string'){
      $tab = this.querySelector(`k-tab[for="${id}"]`);
    }
    if(!$tab){
      let index = parseInt(id);
      if(!index) index = 0;
      $tab = this.querySelectorAll('k-tab')[index];
    }
    return $tab;
  }
  getActiveTab(){
    return this.querySelector(':scope > k-tab[active="true"]');
  }
  getContent(id){
    let $content;
    if(typeof(id) === 'string'){
      $content = this.querySelector(`k-tab-content[name="${id}"]`);
    }
    if(!$content){
      let index = parseInt(id);
      if(!index) index = 0;
      $content = this.querySelectorAll('k-tab-content')[index];
    }
    return $content;
  }
  getActiveContent(){
    return this.querySelector(':scope > k-tab-content[active="true"]');
  }
  

  get shadowTemplate(){
    return /*html*/`
      <div id="wrapper">
        <div id="tabs">
          <slot name="tabs"></slot>
        </div>
        <div id="contents">
          ${super.shadowTemplate}
        </div>
      </div>
      
    `;
  }
  get shadowStyles(){
    return /*css*/`
      ${super.shadowStyles}
      :host {
        display: block;
        overflow: hidden;
      }
      #wrapper {
        display: flex;
        flex-direction: column;
        max-height: 100%;
        height: 100%;
        overflow: hidden;
      }
      #tabs {
        display: flex;
        border-bottom: 1px solid var(--c_border);
        padding: 0;
        margin-top: calc(0 - var(--spacer));
        align-items: flex-start;
      }
      #contents {
        display: flex;
        flex-direction: column;
        flex: 1;
        max-height: 100%;
        overflow: hidden
      }
    `;
  }

  static observedAttributes = [...super.observedAttributes, 'active'];
}
window.customElements.define('k-tabs', Tabs);

export class TabSpacer extends Component {
  constructor(){
    super();
    this.slot = 'tabs';
  }

  get shadowStyles(){
    return /*css*/`
      ${super.shadowStyles}
      :host {
        flex: 1 1 auto;
        height: 1px;
      }
    `;
  }
}
window.customElements.define('k-tab-spacer', TabSpacer);

export default {
  Tab,
  TabContent,
  Tabs,
  TabSpacer
}
