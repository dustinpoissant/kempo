import Component from"./Component.js";import{isInView}from"../utils/element.js";import raf from"../utils/raf.js";const inViewIntervalId=Symbol();export default class LazyComponent extends Component{constructor(e){super(e),this[inViewIntervalId]=null,new IntersectionObserver((([e])=>{e.intersectionRatio>0&&!this.rendered?this.inViewCallback():this.outOfViewCallback()})).observe(this),this.registerAttributes({unrender:!1,inViewInterval:0})}connectedCallback(){this.renderSkelton(),raf((()=>{isInView(this)?this.inViewCallback():this.outOfViewCallback()}),2)}async inViewCallback(){return clearInterval(this[inViewIntervalId]),await this.render()}async outOfViewCallback(){return clearInterval(this[inViewIntervalId]),this[inViewIntervalId]=setInterval((async()=>{await isInView(this)&&this.inViewCallback()}),this.inViewInterval||LazyComponent.inViewIntervalTimeout),!!this.unrender&&(await this.renderSkelton(),!0)}async renderSkelton(){return this.shadowRoot.innerHTML=`<link rel="stylesheet" href="${Component.pathToKempo}/kempo-styles.css" />${this.skeletonTemplate}<style>${this.shadowStyles}</style>`,this.rendered=!1,!0}get skeletonTemplate(){return'<div style="height: var(--skeleton_height, 1rem)"></div>'}static inViewIntervalTimeout=1e3}