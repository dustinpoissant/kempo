/*
  The bottom row of the admin side nav. Its children sit side by side while the parent <k-aside> is
  expanded and stack while it is collapsed. Layout is done with kempo-css utility classes toggled on
  this element, driven by the aside's `aside_state_change` event.
*/
export default class AdminNavFooter extends HTMLElement {
  #aside = null;

  /*
    Lifecycle Callbacks
  */

  connectedCallback(){
    this.#aside = this.closest('k-aside');
    this.#aside?.addEventListener('aside_state_change', this.handleStateChange);
    this.applyState(this.#aside?.state);
  }

  disconnectedCallback(){
    this.#aside?.removeEventListener('aside_state_change', this.handleStateChange);
    this.#aside = null;
  }

  /*
    Event Handlers
  */

  handleStateChange = event => this.applyState(event.detail.state);

  /*
    Utility Functions
  */

  applyState = state => {
    const collapsed = state === 'collapsed';
    this.classList.toggle('d-f', !collapsed);
    this.classList.toggle('d-b', collapsed);
    this.classList.toggle('ta-center', collapsed);
    this.style.alignItems = collapsed ? '' : 'center';
  };
}

customElements.define('k-admin-nav-footer', AdminNavFooter);
