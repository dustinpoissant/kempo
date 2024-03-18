import Component from './Component.js';
import {
  onEvent,
  dispatchEvent
} from '../utils/element.js';

const storageWatcher = Symbol('storageWatcher'),
      clickHandler = Symbol('clickHandler');
export default class ThemeSwitcher extends Component {
  constructor(){
    super();

    this[storageWatcher] = () => {
      this.currentTheme =  ThemeSwitcher.getCurrentTheme();
    }
    this[clickHandler] = () => {
      ThemeSwitcher.setTheme(ThemeSwitcher.getCurrentTheme()==='light'?'dark':'light');
    }
    this.registerAttribute('currentTheme', ThemeSwitcher.getCurrentTheme());
  }
  async render(force){
    if(await super.render(force)){1
      onEvent(window, 'storage', this[storageWatcher]);
      onEvent(this.shadowRoot.getElementById('toggle'), 'click', this[clickHandler]);
      return true;
    }
    return false;
  }

  get shadowTemplate(){
    return /*html*/`
      <button
        id="toggle"
        class="no-btn"
      >
        <k-icon
          id="lightMode"
          name="light-mode"
        ></k-icon>
        <k-icon
          id="darkMode"
          name="dark-mode"
        ></k-icon>
      </button>
    `;
  }
  get shadowStyles(){
    return /*css*/`
      :host {
        --padding: var(--spacer);

        display: flex;
      }
      #toggle {
        padding: var(--padding);
      }
      :host([current-theme="dark"]) #darkMode,
      :host([current-theme="light"]) #lightMode {
        display: none;
      }
    `;
  }

  static setTheme(theme){
    localStorage.setItem('theme', theme);
    document.documentElement.setAttribute('theme', theme);
    dispatchEvent(window, 'storage', { theme });
  }
  static getCurrentTheme(){
    let theme = document.documentElement.getAttribute('theme');
    if(!theme) theme = localStorage.getItem('theme');
    if(!theme) theme = window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
    return theme;
  }
}
ThemeSwitcher.setTheme(ThemeSwitcher.getCurrentTheme());
window.customElements.define('k-theme-switcher', ThemeSwitcher);
