import { html } from '/kempo-ui/lit-all.min.js';
import '/kempo-ui/components/Icon.js';

/* A widget's icon: a file of its own when an extension ships one (`iconSrc`), otherwise one of the icon set by name. */
export default (definition, fallback = 'help') => (definition?.iconSrc
  ? html`<k-icon src="${definition.iconSrc}"></k-icon>`
  : html`<k-icon name="${definition?.icon || fallback}"></k-icon>`);
