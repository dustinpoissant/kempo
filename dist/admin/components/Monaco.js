import LightComponent from '/kempo-ui/components/LightComponent.js';
import { html } from '/kempo-ui/lit-all.min.js';

let monacoLoadPromise = null;

const ensureMonacoLoaded = () => {
	if(monacoLoadPromise) return monacoLoadPromise;
	monacoLoadPromise = new Promise(resolve => {
		if(window.monaco){
			resolve();
			return;
		}
		const script = document.createElement('script');
		script.src = '/monaco-editor/vs/loader.js';
		script.onload = () => {
			require.config({ paths: { vs: '/monaco-editor/vs' } });
			require(['vs/editor/editor.main'], () => resolve());
		};
		document.head.appendChild(script);
	});
	return monacoLoadPromise;
};

export default class Monaco extends LightComponent {
	static get properties() {
		return {
			language: { type: String },
			readOnly: { type: Boolean, attribute: 'readonly' },
			height: { type: String }
		};
	}

	#editor = null;
	#initializing = false;
	#pendingValue = '';

	constructor() {
		super();
		this.language = 'json';
		this.readOnly = false;
		this.height = '400px';
	}

	/*
		Value accessors
	*/

	get value() {
		if(this.#editor) return this.#editor.getValue();
		return this.#pendingValue;
	}

	set value(v) {
		if(this.#editor){
			if(this.#editor.getValue() !== v) this.#editor.setValue(v);
		} else {
			this.#pendingValue = v;
		}
	}

	/*
		Lifecycle
	*/

	updated(changedProperties) {
		super.updated(changedProperties);
		if(!this.#editor && !this.#initializing){
			this.#initializing = true;
			this.#initEditor();
		}
		if(this.#editor){
			if(changedProperties.has('readOnly')){
				this.#editor.updateOptions({ readOnly: this.readOnly });
			}
			if(changedProperties.has('language')){
				monaco.editor.setModelLanguage(this.#editor.getModel(), this.language);
			}
		}
	}

	disconnectedCallback() {
		super.disconnectedCallback();
		if(this.#editor){
			this.#editor.dispose();
			this.#editor = null;
		}
	}

	/*
		Editor initialization
	*/

	#initEditor = async () => {
		await ensureMonacoLoaded();
		const container = this.querySelector('[data-monaco-container]');
		if(!container) return;
		const isDark = document.documentElement.getAttribute('theme') === 'dark'
			|| (document.documentElement.getAttribute('theme') === 'auto'
				&& window.matchMedia('(prefers-color-scheme: dark)').matches);
		this.#editor = monaco.editor.create(container, {
			value: this.#pendingValue,
			language: this.language,
			minimap: { enabled: false },
			automaticLayout: true,
			theme: isDark ? 'vs-dark' : 'vs',
			scrollBeyondLastLine: false,
			fontSize: 14,
			tabSize: 2,
			readOnly: this.readOnly
		});
		this.#editor.onDidChangeModelContent(() => {
			this.dispatchEvent(new Event('change'));
		});
	};

	/*
		Render
	*/

	renderLightDom() {
		return html`<div data-monaco-container style="height: ${this.height}; border: 1px solid var(--c_border); border-radius: var(--radius);"></div>`;
	}
}

customElements.define('admin-monaco', Monaco);
