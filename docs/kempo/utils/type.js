export const typeOf=e=>null===e?"null":e instanceof Array?"array":"undefined"!=typeof Element&&e instanceof Element?"element":typeof e;export const isType=(e,n)=>typeOf(e)===n;