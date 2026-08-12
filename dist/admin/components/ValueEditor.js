import t from"/kempo-ui/components/ShadowComponent.js";import{html as e,nothing as s}from"/kempo-ui/lit-all.min.js";import"/admin/components/Monaco.js";const a=new Set(["html","css","javascript","json","xml"]),i={html:"html",css:"css",javascript:"javascript",json:"json",xml:"xml"};export default class n extends t{static get properties(){return{type:{type:String,reflect:!0},readonly:{type:Boolean,reflect:!0},disabled:{type:Boolean,reflect:!0},placeholder:{type:String},min:{type:String},max:{type:String},step:{type:String},rows:{type:Number},height:{type:String}}}#t="";#e=null;constructor(){super(),this.type="string",this.readonly=!1,this.disabled=!1,this.placeholder="",this.step="any",this.rows=12,this.height="400px"}get value(){if(a.has(this.type))return this.#e?.value??this.#t;const t=this.renderRoot?.querySelector("[data-ve-input]");return t?"boolean"===this.type?"true"===t.value:"number"===this.type?Number(t.value):t.value:this.#t}set value(t){this.#t=t??"",a.has(this.type)&&this.#e?this.#e.value=String(this.#t):this.requestUpdate()}updated(t){t.has("type")&&this.#s(),this.#e&&((t.has("readonly")||t.has("disabled"))&&(this.#e.readOnly=this.readonly||this.disabled),t.has("height")&&(this.#e.height=this.height))}disconnectedCallback(){super.disconnectedCallback(),this.#a()}#s=()=>{a.has(this.type)?this.#e?this.#e.language=i[this.type]||"plaintext":this.#i():this.#a()};#i=()=>{this.#e=document.createElement("admin-monaco"),this.#e.language=i[this.type]||"plaintext",this.#e.readOnly=this.readonly||this.disabled,this.#e.height=this.height,this.#e.value=String(this.#t),this.#e.addEventListener("change",this.#n),this.appendChild(this.#e)};#a=()=>{this.#e&&(this.#e.removeEventListener("change",this.#n),this.#e.remove(),this.#e=null)};#o=t=>{this.dispatchEvent(new Event(t,{bubbles:!0,composed:!0}))};#n=()=>{this.#t=this.#e.value,this.#o("input"),this.#o("change")};#l=()=>{const t=this.renderRoot?.querySelector("[data-ve-input]");t&&(this.#t=t.value),this.#o("input")};#h=()=>{const t=this.renderRoot?.querySelector("[data-ve-input]");t&&(this.#t=t.value),this.#o("change")};render(){return a.has(this.type)?e`<slot></slot>`:"boolean"===this.type?e`<select
				data-ve-input
				class="full"
				?disabled="${this.disabled||this.readonly}"
				@change="${this.#h}"
			>
				<option value="true" ?selected="${"true"===String(this.#t)}">true</option>
				<option value="false" ?selected="${"true"!==String(this.#t)}">false</option>
			</select>`:"number"===this.type?e`<input
				data-ve-input
				type="number"
				class="full"
				.value="${String(this.#t??0)}"
				placeholder="${this.placeholder||s}"
				step="${this.step||s}"
				min="${this.min??s}"
				max="${this.max??s}"
				?readonly="${this.readonly}"
				?disabled="${this.disabled}"
				@input="${this.#l}"
				@change="${this.#h}"
			>`:"color"===this.type?e`<input
				data-ve-input
				type="color"
				.value="${this.#t||"#000000"}"
				?disabled="${this.disabled||this.readonly}"
				@input="${this.#l}"
				@change="${this.#h}"
			>`:e`<textarea
			data-ve-input
			class="full ff-mono"
			rows="${this.rows}"
			placeholder="${this.placeholder||s}"
			?readonly="${this.readonly}"
			?disabled="${this.disabled}"
			@input="${this.#l}"
			@change="${this.#h}"
			.value="${String(this.#t)}"
		></textarea>`}}customElements.define("admin-value-editor",n);
//# sourceMappingURL=C:\Users\dusti\dev\kempo\dist\admin\components\ValueEditor.js.map