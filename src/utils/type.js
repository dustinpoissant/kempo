export const typeOf = value => {
	if(value === null) return 'null';
	else if(value instanceof Array) return 'array';
	else if(typeof(Element) !== 'undefined' && value instanceof Element) return  'element';
	else return typeof(value);
}

export const isType = (value, type) => typeOf(value) === type;

export default {
	typeOf,
	isType
};
