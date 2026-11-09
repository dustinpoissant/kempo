import Control from '/kempo-ui/components/controls/Control.js';
import { html, css } from '/kempo-ui/lit-all.min.js';

/*
  Chooses which content area of the page the builder edits, in the builder's control bar. It is a kempo-ui Control, so it
  sits in the bar like the builder's own controls, and in the "more" menu it is a row with its label.

    locations    the areas to choose from: [{ name, label }]
    value        the name of the area being edited

  Fires `change` with the chosen name as `detail.value`.
*/
export default class LocationControl extends Control {
  static properties = {
    ...Control.properties,
    locations: { attribute: false },
    value: { type: String }
  };

  constructor() {
    super();
    this.locations = [];
    this.value = '';
  }

  /*
    Event Handlers
  */
  handleChange = event => {
    this.dispatchEvent(new CustomEvent('change', { detail: { value: event.target.value } }));
  };

  /*
    Rendering
  */
  render() {
    return html`
      <label>
        <span class="menu-text">Content area</span>
        <select aria-label="Content area" title="The content area of the page being edited" @change="${this.handleChange}">
          ${this.locations.map(location => html`<option value="${location.name}" .selected="${location.name === this.value}">${location.label}</option>`)}
        </select>
      </label>
    `;
  }

  /*
    The control is the box, as a ButtonControl is: the host has the border, radius, margin and hover of the builder's buttons (a
    group takes the border and margin away), and the select inside draws nothing but its text and arrow. The label has no box of
    its own, so the select is a flex item of the host and stretches to its whole height, which keeps its text centred.
  */
  static styles = [
    Control.styles,
    css`
      :host {
        box-sizing: border-box;
        gap: var(--spacer_h);
        margin: var(--spacer_q);
        border: 1px solid var(--c_border);
        border-radius: var(--radius);
        transition: background-color var(--animation_ms);
      }
      :host(:hover) {
        background: oklch(from var(--c_bg__inv) l c h / 0.15);
      }
      :host(:focus-within) {
        box-shadow: var(--focus_shadow);
      }
      :host([in-menu]) {
        margin: 0;
        border: 0;
      }
      label {
        display: contents;
      }
      select {
        box-sizing: border-box;
        height: auto;
        min-height: 0;
        width: auto;
        margin: 0;
        padding: 0 var(--spacer_h);
        background-color: transparent;
        border: 0;
        border-radius: 0;
        box-shadow: none;
        color: inherit;
        font: inherit;
        cursor: pointer;
        outline: none;
      }
      .menu-text {
        display: none;
      }
      :host([in-menu]) .menu-text {
        display: inline;
      }
      :host([in-menu]) {
        padding: var(--spacer_h) var(--spacer);
      }
    `
  ];
}

customElements.define('admin-pb-location', LocationControl);
