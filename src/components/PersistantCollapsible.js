import Collapsible from './Collapsible.js';
import { onEvent, offEvent } from '../utils/element.js';

const updateFromStorage = Symbol('updateFromStorage'),
      storageChangeHandler = Symbol('storageChangeHandler'),
      changeHandler = Symbol('changeHandler');
export default class PersistantCollapsible extends Collapsible {
  constructor(){
    super();

    /* Private Methods */
    this[updateFromStorage] = () => {
      this.opened = localStorage.getItem(`PersistantCollapsible-${this.id}`) === 'true';
    }
    this[storageChangeHandler] = (event) => {
      if (event.key === `PersistantCollapsible-${this.id}`) {
        this[updateFromStorage]();
      }
    }
    this[changeHandler] = () => {
      if(this.id){
        localStorage.setItem(`PersistantCollapsible-${this.id}`, this.opened);
      }
    }
  }

  /* Lifecycle Callbacks */
  async render(force){
    if(await super.render(force)){
      this[updateFromStorage]();
      onEvent(window, 'storage', this[storageChangeHandler]);
      onEvent(this, 'openedchanged', this[changeHandler]);
      return true;
    }
    return false;
  }
  disconnectedCallback(){
    super.disconnectedCallback();
    offEvent(window, 'storage', this[storageChangeHandler]);
    offEvent(this, 'openedchanged', this[changeHandler]);
    window.removeEventListener('storage', this[storageChangeHandler]);
  }
}
window.customElements.define('k-p-collapsible', PersistantCollapsible);
