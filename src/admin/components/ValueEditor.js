import ShadowComponent from '/kempo-ui/components/ShadowComponent.js';
import { html, nothing } from '/kempo-ui/lit-all.min.js';
import '/admin/components/Monaco.js';

const CODE_TYPES = new Set(['html', 'css', 'javascript', 'json', 'xml']);
const TYPE_TO_LANG = { html: 'html', css: 'css', javascript: 'javascript', json: 'json', xml: 'xml' };

export default class ValueEditor extends ShadowComponent {
	/*
		Reactive Properties
	*/

	static get properties() {
		return {
			type: { type: String, reflect: true },
			readonly: { type: Boolean, reflect: true },
			disabled: { type: Boolean, reflect: true },
			placeholder: { type: String },
			min: { type: String },
			max: { type: String },
			step: { type: String },
			rows: { type: Number },
			height: { type: String },
		};
	}

	#value = '';
	#monacoEl = null;

	constructor() {
		super();
		this.type = 'string';
		this.readonly = false;
		this.disabled = false;
		this.placeholder = '';
		this.step = 'any';
		this.rows = 12;
		this.height = '400px';
	}

	/*
		Value Accessors
	*/

	get value() {
		if(CODE_TYPES.has(this.type)){
			return this.#monacoEl?.value ?? this.#value;
		}
		const el = this.renderRoot?.querySelector('[data-ve-input]');
		if(!el) return this.#value;
		if(this.type === 'boolean') return el.value === 'true';
		if(this.type === 'number') return Number(el.value);
		return el.value;
	}

	set value(v) {
		this.#value = v ?? '';
		if(CODE_TYPES.has(this.type) && this.#monacoEl){
			this.#monacoEl.value = String(this.#value);
			return;
		}
		this.requestUpdate();
	}

	/*
		Lifecycle
	*/

	updated(changedProperties) {
		if(changedProperties.has('type')) this.#syncEditor();
		if(!this.#monacoEl) return;
		if(changedProperties.has('readonly') || changedProperties.has('disabled')){
			this.#monacoEl.readOnly = this.readonly || this.disabled;
		}
		if(changedProperties.has('height')){
			this.#monacoEl.height = this.height;
		}
	}

	disconnectedCallback() {
		super.disconnectedCallback();
		this.#destroyMonaco();
	}

	/*
		Monaco Management (light DOM child projected via <slot> for style compat)
	*/

	#syncEditor = () => {
		if(CODE_TYPES.has(this.type)){
			if(this.#monacoEl){
				this.#monacoEl.language = TYPE_TO_LANG[this.type] || 'plaintext';
			} else {
				this.#createMonaco();
			}
		} else {
			this.#destroyMonaco();
		}
	};

	#createMonaco = () => {
		this.#monacoEl = document.createElement('admin-monaco');
		this.#monacoEl.language = TYPE_TO_LANG[this.type] || 'plaintext';
		this.#monacoEl.readOnly = this.readonly || this.disabled;
		this.#monacoEl.height = this.height;
		this.#monacoEl.value = String(this.#value);
		this.#monacoEl.addEventListener('change', this.#onMonacoChange);
		this.appendChild(this.#monacoEl);
	};

	#destroyMonaco = () => {
		if(!this.#monacoEl) return;
		this.#monacoEl.removeEventListener('change', this.#onMonacoChange);
		this.#monacoEl.remove();
		this.#monacoEl = null;
	};

	/*
		Event Handlers
	*/

	#emit = name => {
		this.dispatchEvent(new Event(name, { bubbles: true, composed: true }));
	};

	#onMonacoChange = () => {
		this.#value = this.#monacoEl.value;
		this.#emit('input');
		this.#emit('change');
	};

	#onInput = () => {
		const el = this.renderRoot?.querySelector('[data-ve-input]');
		if(el) this.#value = el.value;
		this.#emit('input');
	};

	#onChange = () => {
		const el = this.renderRoot?.querySelector('[data-ve-input]');
		if(el) this.#value = el.value;
		this.#emit('change');
	};

	/*
		Render
	*/

	render() {
		if(CODE_TYPES.has(this.type)){
			return html`<slot></slot>`;
		}

		if(this.type === 'boolean'){
			return html`<select
				data-ve-input
				class="full"
				?disabled="${this.disabled || this.readonly}"
				@change="${this.#onChange}"
			>
				<option value="true" ?selected="${String(this.#value) === 'true'}">true</option>
				<option value="false" ?selected="${String(this.#value) !== 'true'}">false</option>
			</select>`;
		}

		if(this.type === 'number'){
			return html`<input
				data-ve-input
				type="number"
				class="full"
				.value="${String(this.#value ?? 0)}"
				placeholder="${this.placeholder || nothing}"
				step="${this.step || nothing}"
				min="${this.min ?? nothing}"
				max="${this.max ?? nothing}"
				?readonly="${this.readonly}"
				?disabled="${this.disabled}"
				@input="${this.#onInput}"
				@change="${this.#onChange}"
			>`;
		}

		if(this.type === 'color'){
			return html`<input
				data-ve-input
				type="color"
				.value="${this.#value || '#000000'}"
				?disabled="${this.disabled || this.readonly}"
				@input="${this.#onInput}"
				@change="${this.#onChange}"
			>`;
		}

		return html`<textarea
			data-ve-input
			class="full ff-mono"
			rows="${this.rows}"
			placeholder="${this.placeholder || nothing}"
			?readonly="${this.readonly}"
			?disabled="${this.disabled}"
			@input="${this.#onInput}"
			@change="${this.#onChange}"
			.value="${String(this.#value)}"
		></textarea>`;
	}
}

customElements.define('admin-value-editor', ValueEditor);
