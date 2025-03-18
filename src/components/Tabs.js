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
        flex: 0 0 auto;  /* Important: prevent shrinking and growing */
      }
      #button {
        padding: var(--spacer_h);
        background-color: transparent;
        border: none;
        cursor: inherit;
        box-shadow: none;
        color: inherit;
        white-space: nowrap;  /* Prevent text wrapping */
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

    // Add scroll listeners for indicators
    const tabsContainer = this.shadowRoot.getElementById('tabs');
    tabsContainer.addEventListener('scroll', this.updateScrollIndicators.bind(this));
    this.updateScrollIndicators();

    // Update indicators on resize
    new ResizeObserver(() => this.updateScrollIndicators()).observe(tabsContainer);

    const leftButton = this.shadowRoot.getElementById('scroll-left');
    const rightButton = this.shadowRoot.getElementById('scroll-right');

    leftButton.addEventListener('click', () => {
      tabsContainer.scrollBy({ left: -200, behavior: 'smooth' });
    });
    rightButton.addEventListener('click', () => {
      tabsContainer.scrollBy({ left: 200, behavior: 'smooth' });
    });
  }

  updateScrollIndicators() {
    const tabsContainer = this.shadowRoot.getElementById('tabs');
    const leftIndicator = this.shadowRoot.getElementById('scroll-left');
    const rightIndicator = this.shadowRoot.getElementById('scroll-right');
    
    const hasLeftScroll = tabsContainer.scrollLeft > 0;
    const hasRightScroll = tabsContainer.scrollLeft < (tabsContainer.scrollWidth - tabsContainer.clientWidth);
    
    leftIndicator.classList.toggle('visible', hasLeftScroll);
    rightIndicator.classList.toggle('visible', hasRightScroll);
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
        <div id="tabs-container">
          <div id="scroll-left" class="scroll-indicator">
            <svg class="arrow" width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12 15L7 10L12 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
          <div id="tabs">
            <slot name="tabs"></slot>
          </div>
          <div id="scroll-right" class="scroll-indicator">
            <svg class="arrow" width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M8 15L13 10L8 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
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
        width: 100%;
      }
      #wrapper {
        display: flex;
        flex-direction: column;
        width: 100%;
        min-width: 0;
      }
      #tabs-container {
        position: relative;
        border-bottom: 1px solid var(--c_border);
      }
      #tabs {
        display: flex;
        overflow-x: auto;
        overflow-y: hidden;
      }
      #tabs ::slotted(*) {
        flex: 0 0 auto;
      }
      .scroll-indicator {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 72px;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.2s;
        display: flex;
        align-items: center;
        justify-content: flex-start;
        padding-bottom: 2px;
      }
      .scroll-indicator .arrow {
        color: var(--tc_base);
        z-index: 1;
      }
      .scroll-indicator.visible {
        opacity: 1;
      }
      #scroll-left {
        left: 0;
        background: linear-gradient(90deg, 
          var(--c_bg) 0%,
          var(--c_bg) 30%,
          transparent 100%
        );
      }
      #scroll-right {
        right: 0;
        justify-content: flex-end;
        background: linear-gradient(-90deg, 
          var(--c_bg) 0%,
          var(--c_bg) 30%,
          transparent 100%
        );
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
