const serializeDir = async (dirHandle) => {
  const entrySerializations = [];
  for await(const {kind,name} of dirHandle.values()){
    entrySerializations.push(`${kind}:${name}`);
  }
  return entrySerializations.join('|');
}

export default async (dirHandle, callback, timer = 1000) => {
  let lastSerialization = await serializeDir(dirHandle);
  return setInterval(async () => {
    const newSerialization = await serializeDir(dirHandle);
    if(newSerialization != lastSerialization){
      lastSerialization = newSerialization;
      callback();
    }
  }, timer);
}