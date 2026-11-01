import ShadowComponent from '/kempo-ui/components/ShadowComponent.js';

/*
  The base class for the page side of a widget: the web component a published page loads. It is a kempo-ui
  ShadowComponent (the kempo stylesheet is already in its shadow DOM), and a widget extends it, declares its settings
  as ordinary Lit properties named after the attributes in its `page_widgets` entry, and renders them.

  ```js
  import Widget from '/kempo/sitebuilder/components/Widget.js';
  import { html } from '/kempo-ui/lit-all.min.js';

  export default class Banner extends Widget {
    static properties = { message: { type: String, reflect: true } };
    render(){ return html`<div class="p bg-primary">${this.message}<slot></slot></div>`; }
  }
  customElements.define('my-banner', Banner);
  ```

  Whatever the widget has in its slots arrives as light DOM children, which is what the editor puts other widgets in.
*/
export default class Widget extends ShadowComponent {}
