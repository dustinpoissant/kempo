import {
  getCase
} from '../utils/string.js';

export default class Component extends HTMLElement {
  constructor(shadowDetails = {}){
    super();
    this.attachShadow({mode: 'open', ...shadowDetails});
    this.registerAttribute('rendered', false);
  }
  async connectedCallback(){
    this.render(true);
  };
  async disconnectedCallback(){};
  async attributeChangedCallback(){};
  async propChangedCallback(){};
  async render(force = false){
    if(force || !this.rendered){
      this.shadowRoot.innerHTML = `<link rel="stylesheet" href="${Component.pathToKempo}/kempo-styles.css" />${this.shadowTemplate}<style>${this.shadowStyles}</style>`;
      this.rendered = true;
      return true;
    }
  }
  registerAttribute(name, defaultValue = ''){
    const {
      camel: camelName,
      dash: dashName
    } = getCase(name);
    const type = typeof(defaultValue);
    Object.defineProperty(this, camelName, {
      get: () => {
        const value = this.getAttribute(dashName);
        if(type == 'number'){
          return parseFloat(value);
        } else if(type === 'object'){
          return typeof(value)==='string'?JSON.parse(value):value;
        } else if(type === 'boolean'){
          return typeof(value)==='string'?value.toLowerCase().trim()==='true':!!value;
        } else if(type === 'string'){
          return value || '';
        } else {
          return value;
        }
      },
      set: (value) => {
        if(this[dashName] === value) return; // no change
        if(type === 'boolean'){
          if(value){
            this.setAttribute(dashName, 'true');
          } else {
            this.removeAttribute(dashName);
          }
        } else if(type === 'object'){
          this.setAttribute(dashName, JSON.stringify(value || {}));
        } else if(type === 'number'){
          if(value || value === 0){
            this.setAttribute(dashName, value);
          } else {
            this.removeAttribute(dashName);
          }
        } else {
          this.setAttribute(dashName, value);
        }
      }
    });
    if(this.getAttribute(dashName) === null) this[camelName] = defaultValue;
  }
  registerAttributes(attrs){
    for(const key in attrs){
      this.registerAttribute(key, attrs[key]);
    }
  }
  registerProp(name, value){
    const propSymbol = Symbol(name);
    this[propSymbol] = value;
    Object.defineProperty(this, name, {
      get: () => {
        return this[propSymbol];
      },
      set: (value) => {
        if(this[propSymbol] !== value){
          const oldValue = this[propSymbol];
          this[propSymbol] = value;
          this.propChangedCallback(name, oldValue, value);
        }
      }
    });
  }
  registerProps(props){
    for(const key in props){
      this.registerProp(key, props[key]);
    }
  }
  renderIf(condition, html){
    return condition?html:''
  }

  get shadowTemplate(){
    return /*html*/`
      <slot></slot>
    `;
  }
  get shadowStyles(){
    return /*css*/``;
  }

  static observedAttributes = ['rendered'];
  static pathToKempo = import.meta.url.substring(0, import.meta.url.indexOf('/components/Component.js') );
}
window.customElements.define('k-component', Component);