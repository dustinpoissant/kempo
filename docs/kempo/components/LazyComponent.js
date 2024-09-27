import Component from"./Component.js";import{isInView}from"../utils/element.js";import raf from"../utils/raf.js";export default class LazyComponent extends Component{constructor(e){super(e),new IntersectionObserver((([e])=>{e.intersectionRatio>0&&!this.rendered?this.inViewCallback():this.outOfViewCallback()})).observe(this),this.registerAttribute("unrender",!1)}async connectedCallback(){await this.renderSkelton(),raf((async()=>{await isInView(this)&&await this.inViewCallback()}),2)}async inViewCallback(){return await this.render()}async outOfViewCallback(){return!!this.unrender&&(await this.renderSkelton(),!0)}async renderSkelton(){return this.shadowRoot.innerHTML=`<link rel="stylesheet" href="${Component.pathToKempo}/kempo-styles.css" />${this.skeletonTemplate}<style>${this.shadowStyles}</style>`,this.rendered=!1,!0}get skeletonTemplate(){return'<div style="height: var(--skeleton_height, 1rem)"></div>'}}