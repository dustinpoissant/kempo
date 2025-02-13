import Component from './Component.js';
import {
  onEvent,
  dispatchEvent
} from '../utils/element.js';
import './Icon.js';

const storageWatcher = Symbol('storageWatcher'),
      clickHandler = Symbol('clickHandler');
export default class ThemeSwitcher extends Component {
  constructor(){
    super();

    this[storageWatcher] = () => {
      this.currentTheme =  ThemeSwitcher.getCurrentTheme();
    }
    this[clickHandler] = () => {
      const current = ThemeSwitcher.getCurrentTheme();
      if(current === 'auto') ThemeSwitcher.setTheme('light');
      if(current === 'light') ThemeSwitcher.setTheme('dark');
      if(current === 'dark') ThemeSwitcher.setTheme('auto');
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
  disconnectedCallback(){
    super.disconnectedCallback();
    offEvent(this.shadowRoot.getElementById('toggle'), 'click', this[clickHandler]);
  }

  get shadowTemplate(){
    return /*html*/`
      <button
        id="toggle"
        class="no-btn"
      >
        <k-icon
          id="autoMode"
          name="mode-auto"
          class="mode"
        ></k-icon>
        <k-icon
          id="lightMode"
          name="mode-light"
          class="mode"
        ></k-icon>
        <k-icon
          id="darkMode"
          name="mode-dark"
          class="mode"
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
      .mode {
        display: none;
      }
      :host([current-theme="auto"]) #autoMode,
      :host([current-theme="light"]) #lightMode,
      :host([current-theme="dark"]) #darkMode {
        display: block;
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
    return theme || 'auto';
  }
}
const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
const colorSchemeChangeHandler = (event) => document.documentElement.setAttribute('auto-theme', event.matches?'dark':'light');
colorSchemeQuery.addEventListener('change', colorSchemeChangeHandler);
colorSchemeChangeHandler(colorSchemeQuery);

ThemeSwitcher.setTheme(ThemeSwitcher.getCurrentTheme());
window.customElements.define('k-theme-switcher', ThemeSwitcher)