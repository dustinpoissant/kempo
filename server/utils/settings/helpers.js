export const convertValue = (value, type) => {
  if(value === null) return null;
  
  switch(type){
    case 'number':
      return Number(value);
    case 'boolean':
      return value === 'true';
    case 'json':
      return JSON.parse(value);
    case 'string':
    default:
      return value;
  }
};

export const serializeValue = (value, type) => {
  if(value === null) return null;
  
  switch(type){
    case 'json':
      return JSON.stringify(value);
    case 'number':
    case 'boolean':
    case 'string':
    default:
      return String(value);
  }
};
