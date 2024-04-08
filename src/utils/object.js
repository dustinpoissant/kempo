import { typeOf } from './type.js';

export const toJson = (obj) => {
	return JSON.stringify(obj, (key, value) => {
		if (key !== '' && value === obj) {
			return '<<Circular Reference>>';
		} else if (typeof(Element) !== 'undefined' && value instanceof Element) {
			return value.outerHTML;
		} else if(typeOf(value) === 'function'){
			return `<<Function ${key}>>`;
		}
		return value;
	});
};

export const flattenObject = (
	obj,
	maxDepth = 100,
	prevDepth = 0,
	parentKeys = []
) => {
	const thisDepth = prevDepth + 1;
	if (obj === null) return {};
	return Object.keys(obj).reduce((o, k) => {
		const v = obj[k];
		const key = [...parentKeys, k].join('.');
		if (typeOf(Element) !== 'undefined' && v instanceof Element) {
			return {
				...o,
				[key]: v.outerHTML
			};
		} else if (v === null) {
			return {
				...o,
				[key]: null
			};
		} else if (typeof v === 'object') {
			if (maxDepth <= thisDepth) {
				return {
					...o,
					[key]: '<<Max Depth Reached>>'
				};
			} else {
				return {
					...o,
					...flattenObject(v, maxDepth, thisDepth, [...parentKeys, k])
				};
			}
		} else {
			return {
				...o,
				[key]: v
			};
		}
	}, {});
};

export const flattenedObjects = (...objects) => objects.map(o=>flattenObject(o));

export const objectSummary = (object, maxLength = 100) => {
	if (typeof object === 'object') {
		const flatObject = flattenObject(object);
		const kvp = []; // key value pairs
		Object.keys(flatObject).forEach((key) => {
			kvp.push(`${key} = ${objectSummary(flatObject[key])}`);
		});
		return kvp.join(', ').substring(0, maxLength);
	} else {
		return `${object}`.substring(0, maxLength);
	}
};

export const clone = (obj) => {
	const type = typeof obj;
	const Element =
		typeof window === 'undefined' ? class Element {} : window.Element; // So this can run in Node
	if (obj instanceof Element) {
		return obj.outerHTML;
	} else if (obj === null) {
		return null;
	} else if (
		['string', 'number', 'boolean', 'undefined', 'bigint'].includes(type)
	) {
		return obj;
	} else if (type === 'symbol') {
		return '<<SYMBOL>>';
	} else if (type === 'function') {
		return '<<function>>';
	} else if (obj instanceof Array) {
		return obj.map((item) => clone(item));
	} else if (type === 'object') {
		return Object.keys(obj).reduce((r, k) => {
			return {
				...r,
				[k]: clone(obj[k])
			};
		}, {});
	} else {
		return obj;
	}
};

export const equalObjs = (...objs) => {
	if (objs.length < 2) return true;
	const first = toJson(objs[0]);
	for (let i = 1; i < objs.length; i++) {
		if (first !== toJson(objs[i])) return false;
	}
	return true;
};

const pruneVar = (value) => {
	if (typeof value === 'undefined') {
		return [undefined, true];
	} else if (typeof value === 'string') {
		return [value, value === ''];
	} else if (value instanceof Array) {
		return [value, value.length === 0];
	} else if (value === null) {
		return [value, false];
	} else if (typeof value === 'object') {
		// eslint-disable-next-line no-use-before-define
		return pruneObject(value);
	}
	return [value, false];
};
const pruneObject = (object) => {
	const results = {};
	Object.keys(object).forEach((key) => {
		const [pruned, isBlank] = pruneVar(object[key]);
		if (!isBlank) {
			results[key] = pruned;
		}
	});
	return [results, Object.keys(results).length === 0];
};
export const prune = (object) => {
	return pruneObject(object)[0]
}
export const getAllKeys = (...objects) => [...new Set(objects.map(o => Object.keys(o)).flat())];
export const getDifferencesKeys = (...objects) => {
	return getAllKeys(...objects)
		.map(k => new Set(objects.map(o => o[k])).size !== 1 ? k : null)
		.filter(k => k !== null);
}
export const diff = (obj1, obj2) => {
  const result = {};

  function compareValues(path, value1, value2) {
    if (Array.isArray(value1) && Array.isArray(value2)) {
      if (value1.length !== value2.length || !value1.every((v, i) => v === value2[i])) {
        result[path.join('.')] = { newValue: value1, oldValue: value2 };
      }
    } else if (typeof value1 === 'object' && typeof value2 === 'object') {
      compareObjects([...path], value1, value2);
    } else if (value1 !== value2) {
      result[path.join('.')] = { newValue: value1, oldValue: value2 };
    }
  }

  function compareObjects(path, obj1, obj2) {
    for (const key in obj1) {
      if (obj1.hasOwnProperty(key)) {
        const value1 = obj1[key];
        const value2 = obj2[key];

        compareValues([...path, key], value1, value2);
      }
    }
  }

  compareObjects([], obj1, obj2);
  return result;
}

export const mapObject = (obj, func) => {
  return Object.entries(obj).reduce((newObj, [key, value]) => {
    const [newKey, newValue] = func(key, value);
    newObj[newKey] = newValue;
    return newObj;
  }, {});
}

export default {
	toJson,
	flattenObject,
	flattenedObjects,
	objectSummary,
	clone,
	equalObjs,
	pruneVars,
	pruneObject,
	prune,
	getAllKeys,
	getDifferencesKeys,
	diff,
	mapObject
};
