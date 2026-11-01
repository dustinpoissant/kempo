import { safeUrl } from './html.js';

/*
  Attribute types. A widget declares its settings as attributes with a type, and the type decides how a value is
  cleaned (here, on the server and in the editor alike) and how the attribute editor draws its field (`field`, a
  name the editor maps to a control). Extensions can add types with registerAttributeType. A type the server does
  not know is treated as text, so an extension's own type must still produce a string.
*/
export const attributeTypes = {
  string: { field: 'text', coerce: value => String(value ?? '') },
  text: { field: 'textarea', coerce: value => String(value ?? '') },
  number: {
    field: 'number',
    coerce: (value, def) => {
      if(value === '' || value === null || value === undefined) return '';
      const number = Number(value);
      if(!Number.isFinite(number)) return '';
      if(typeof def.min === 'number' && number < def.min) return def.min;
      if(typeof def.max === 'number' && number > def.max) return def.max;
      return number;
    }
  },
  boolean: { field: 'toggle', coerce: value => value === true || value === 'true' || value === '' },
  url: { field: 'text', coerce: value => safeUrl(value) },
  id: { field: 'text', coerce: value => String(value ?? '').trim().replace(/[^A-Za-z0-9_-]/g, '') },
  image: { field: 'image', coerce: value => safeUrl(value) },
  select: {
    field: 'select',
    coerce: (value, def) => {
      const allowed = (def.options || []).map(option => String(option.value));
      return allowed.includes(String(value)) ? String(value) : String(def.default ?? allowed[0] ?? '');
    }
  }
};

export const registerAttributeType = (name, definition) => {
  attributeTypes[name] = definition;
};

export const attributeDefault = def => {
  if(def.default !== undefined) return def.default;
  if(def.type === 'boolean') return false;
  return '';
};

export const coerceAttribute = (def, value) => {
  const type = attributeTypes[def.type] || attributeTypes.string;
  return type.coerce(value === undefined ? attributeDefault(def) : value, def);
};

/* True when the value is the same as nothing: it is left out of the page rather than written as an empty attribute. */
export const isDefaultValue = (def, value) => {
  const fallback = attributeDefault(def);
  if(def.type === 'boolean') return !!value === !!fallback;
  if(value === undefined || value === null || value === '') return fallback === '' || fallback === undefined;
  return String(value) === String(fallback);
};
