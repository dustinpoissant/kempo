import { html } from '/kempo-ui/lit-all.min.js';
import WidgetSettings from './WidgetSettings.js';
import '/kempo-ui/components/Icon.js';

/*
  The Accordion's settings: its own option, and its sections, each with its heading typed here. Clicking a heading on the
  page opens or closes its section, so headings are not edited there.
*/
export default class AccordionSettings extends WidgetSettings {
  render(){
    const sections = this.node.slots?.default || [];
    return html`
      ${this.renderFields()}
      <div class="mb">
        <label class="d-b mbq">Sections<small class="d-b tc-muted">Click a heading on the page to open or close its section.</small></label>
        ${sections.map((section, index) => html`
          <div class="d-f mbq">
            <span class="mrq">${index + 1}.</span>
            <input type="text" class="flex mrq" aria-label="Heading of section ${index + 1}" .value="${section.attrs?.title ?? 'Section'}" @input="${event => this.host.setAttribute(section.id, 'title', event.target.value, true)}">
            <button title="Select it" aria-label="Select section ${index + 1}" @click="${() => this.select(section.id)}"><k-icon name="edit"></k-icon></button>
          </div>`)}
        <button @click="${() => this.addChild('accordion-item', 'default')}"><k-icon name="add"></k-icon> Add section</button>
      </div>
    `;
  }
}

customElements.define('k-accordion-settings', AccordionSettings);
