import waitFrames from './waitFrames.js';

export const onEvent = (element, events, handler, scope = document) => {
  if(element instanceof EventTarget){
    events.toLowerCase().split(' ').forEach( event => {
      element.addEventListener(event, handler);
    });
  } else if(element instanceof NodeList || element instanceof Array){
    element.forEach( el => onEvent(el, events, handler));
  } else if(typeof(element) == 'string'){
    scope.querySelectorAll(element).forEach( el => onEvent(el, events, handler));
  }
}
export const offEvent = (element, events, handler, scope = document) => {
  if(element instanceof EventTarget){
    events.toLowerCase().split(' ').forEach( event => {
      element.removeEventListener(event, handler);
    });
  } else if(element instanceof NodeList || element instanceof Array){
    element.forEach( el => offEvent(el, events, handler));
  } else if(typeof(element) == 'string'){
    scope.querySelectorAll(element).forEach( el => offEvent(el, events, handler));
  }
}
export const dispatchEvent = (element, events, detail, {
  scope = document,
  bubbles = false
}={}) => {
  if(element instanceof EventTarget){
    events.toLowerCase().split(' ').forEach( event => {
      element.dispatchEvent(new CustomEvent(event, { bubbles, detail } ));
    });
  } else if(element instanceof NodeList || element instanceof Array){
    element.forEach( el => dispatchEvent(el, events, handler));
  } else if(typeof(element) == 'string'){
    scope.querySelectorAll(element).forEach( el => dispatchEvent(el, events, handler));
  }
}
export const isInView = async (element) => {
  await waitFrames(2);
  const rect = element.getBoundingClientRect();
  const windowHeight = window.innerHeight || document.documentElement.clientHeight;
  const windowWidth = window.innerWidth || document.documentElement.clientWidth;
  if (
    rect.bottom < 0 ||
    rect.top > windowHeight ||
    rect.right < 0 ||
    rect.left > windowWidth
  ) {
    return false;
  }
  while (element) {
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return false;
    }
    element = element.parentElement;
  }
  return true;
}
export const firstFocusable = (scope) => {
  return scope.querySelector('a[href]:not([disabled]), button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([disabled]):not([tabindex="-1"])');
}
export const setProp = (element, prop, value, scope = document) => {
	if(element instanceof HTMLElement){
		element[prop] = value;
	} else if(element instanceof NodeList || element instanceof Array){
		[...element].forEach(element => dispatchEvent(element, prop, value));
	} else if(typeof(element) === 'string'){
		dispatchEvent(scope.querySelectorAll(element), prop, value);
	}
}

export default {
  onEvent,
  offEvent,
  dispatchEvent,
  isInView,
  firstFocusable,
  setProp
};
