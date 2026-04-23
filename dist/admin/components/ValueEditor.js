import ShadowComponent from"/kempo-ui/components/ShadowComponent.js";import{html,nothing}from"/kempo-ui/lit-all.min.js";import"/admin/components/Monaco.js";const CODE_TYPES=new Set(["html","css","javascript","json","xml"]),TYPE_TO_LANG={html:"html",css:"css",javascript:"javascript",json:"json",xml:"xml"};export default class ValueEditor extends ShadowComponent{static get properties(){return{type:{type:String,reflect:!0},readonly:{type:Boolean,reflect:!0},disabled:{type:Boolean,reflect:!0},placeholder:{type:String},min:{type:String},max:{type:String},step:{type:String},rows:{type:Number},height:{type:String}}}#t="";#e=null;constructor(){super(),this.type="string",this.readonly=!1,this.disabled=!1,this.placeholder="",this.step="any",this.rows=12,this.height="400px"}get value(){if(CODE_TYPES.has(this.type))return this.#e?.value??this.#t;const t=this.renderRoot?.querySelector("[data-ve-input]");return t?"boolean"===this.type?"true"===t.value:"number"===this.type?Number(t.value):t.value:this.#t}set value(t){this.#t=t??"",CODE_TYPES.has(this.type)&&this.#e?this.#e.value=String(this.#t):this.requestUpdate()}updated(t){t.has("type")&&this.#i(),this.#e&&((t.has("readonly")||t.has("disabled"))&&(this.#e.readOnly=this.readonly||this.disabled),t.has("height")&&(this.#e.height=this.height))}disconnectedCallback(){super.disconnectedCallback(),this.#n()}#i=()=>{CODE_TYPES.has(this.type)?this.#e?this.#e.language=TYPE_TO_LANG[this.type]||"plaintext":this.#a():this.#n()};#a=()=>{this.#e=document.createElement("admin-monaco"),this.#e.language=TYPE_TO_LANG[this.type]||"plaintext",this.#e.readOnly=this.readonly||this.disabled,this.#e.height=this.height,this.#e.value=String(this.#t),this.#e.addEventListener("change",this.#s),this.appendChild(this.#e)};#n=()=>{this.#e&&(this.#e.removeEventListener("change",this.#s),this.#e.remove(),this.#e=null)};#o=t=>{this.dispatchEvent(new Event(t,{bubbles:!0,composed:!0}))};#s=()=>{this.#t=this.#e.value,this.#o("input"),this.#o("change")};#h=()=>{const t=this.renderRoot?.querySelector("[data-ve-input]");t&&(this.#t=t.value),this.#o("input")};#l=()=>{const t=this.renderRoot?.querySelector("[data-ve-input]");t&&(this.#t=t.value),this.#o("change")};render(){return CODE_TYPES.has(this.type)?html`<slot></slot>`:"boolean"===this.type?html`<select
				data-ve-input
				class="full"
				?disabled="${this.disabled||this.readonly}"
				@change="${this.#l}"
			>
				<option value="true" ?selected="${"true"===String(this.#t)}">true</option>
				<option value="false" ?selected="${"true"!==String(this.#t)}">false</option>
			</select>`:"number"===this.type?html`<input
				data-ve-input
				type="number"
				class="full"
				.value="${String(this.#t??0)}"
				placeholder="${this.placeholder||nothing}"
				step="${this.step||nothing}"
				min="${this.min??nothing}"
				max="${this.max??nothing}"
				?readonly="${this.readonly}"
				?disabled="${this.disabled}"
				@input="${this.#h}"
				@change="${this.#l}"
			>`:"color"===this.type?html`<input
				data-ve-input
				type="color"
				.value="${this.#t||"#000000"}"
				?disabled="${this.disabled||this.readonly}"
				@input="${this.#h}"
				@change="${this.#l}"
			>`:html`<textarea
			data-ve-input
			class="full ff-mono"
			rows="${this.rows}"
			placeholder="${this.placeholder||nothing}"
			?readonly="${this.readonly}"
			?disabled="${this.disabled}"
			@input="${this.#h}"
			@change="${this.#l}"
			.value="${String(this.#t)}"
		></textarea>`}}customElements.define("admin-value-editor",ValueEditor);
//# sourceMappingURL=ValueEditor.js.map