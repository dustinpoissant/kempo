import { html } from '/kempo-ui/lit-all.min.js';
import WidgetSettings from './WidgetSettings.js';

/* The Accordion's settings: its own option, and its sections listed, each one a click from its settings, with a button to add one. */
export default class AccordionSettings extends WidgetSettings {
  render(){
    return html`
      ${this.renderFields()}
      ${this.renderChildren('default', { label: 'Sections', addType: 'accordion-item', addLabel: 'Add section' })}
    `;
  }
}

customElements.define('k-accordion-settings', AccordionSettings);
