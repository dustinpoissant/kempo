import db from '../../db/index.js';
import * as schema from '../../db/schema.js';
import { eq, like } from 'drizzle-orm';

const convertValue = (value, type) => {
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

const serializeValue = (value, type) => {
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

export const getSetting = async (owner, name, defaultValue = null) => {
  if(!owner || !name){
    throw new Error('Both owner and name are required');
  }
  
  const fullName = `${owner}:${name}`;
  const [result] = await db
    .select()
    .from(schema.setting)
    .where(eq(schema.setting.name, fullName))
    .limit(1);
  
  if(!result) return defaultValue;
  
  return convertValue(result.value, result.type);
};

export const getSettingWithMetadata = async (owner, name) => {
  if(!owner || !name){
    throw new Error('Both owner and name are required');
  }
  
  const fullName = `${owner}:${name}`;
  const [result] = await db
    .select()
    .from(schema.setting)
    .where(eq(schema.setting.name, fullName))
    .limit(1);
  
  if(!result) return null;
  
  return {
    name: result.name,
    value: convertValue(result.value, result.type),
    type: result.type,
    isPublic: result.isPublic,
    description: result.description
  };
};


export const setSetting = async (owner, name, value, type = null, isPublic = false, description = null) => {
  if(!owner || !name){
    throw new Error('Both owner and name are required');
  }
  
  const fullName = `${owner}:${name}`;
  const detectedType = type || (typeof value === 'object' ? 'json' : typeof value);
  const serializedValue = serializeValue(value, detectedType);
  
  const existing = await db
    .select()
    .from(schema.setting)
    .where(eq(schema.setting.name, fullName))
    .limit(1);
  
  if(existing.length > 0){
    await db
      .update(schema.setting)
      .set({ 
        value: serializedValue,
        type: detectedType,
        isPublic,
        description,
        updatedAt: new Date() 
      })
      .where(eq(schema.setting.name, fullName));
  } else {
    await db.insert(schema.setting).values({
      name: fullName,
      value: serializedValue,
      type: detectedType,
      isPublic,
      description,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }
  
  return { name: fullName, value, type: detectedType, isPublic, description };
};

export const deleteSetting = async (owner, name) => {
  if(!owner || !name){
    throw new Error('Both owner and name are required');
  }
  
  if(owner === 'system'){
    throw new Error('Cannot delete system settings');
  }
  
  const fullName = `${owner}:${name}`;
  await db
    .delete(schema.setting)
    .where(eq(schema.setting.name, fullName));
  
  return { deleted: true, name: fullName };
};

export const getSettingsByOwner = async (owner) => {
  if(!owner){
    throw new Error('Owner is required');
  }
  
  const results = await db
    .select()
    .from(schema.setting)
    .where(like(schema.setting.name, `${owner}:%`));
  
  return Object.fromEntries(
    results.map(s => [s.name, convertValue(s.value, s.type)])
  );
};

export const getPublicSettings = async () => {
  const results = await db
    .select()
    .from(schema.setting)
    .where(eq(schema.setting.isPublic, true));

  const settings = {};
  for(const s of results){
    settings[s.name] = convertValue(s.value, s.type);
  }

  return settings;
};

