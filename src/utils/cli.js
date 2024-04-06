const args = {};
let win = {};
if(typeof(window) !== 'undefined'){
  win = window;
} else if(typeof(global) !== 'undefined'){
  win = global;
}
win.log = (...messages) => {
  if(args.debug){
    console.log(...messages);
  }
}

export default (shortMap = {
  d: 'debug'
}) => {
  let name = '';
  let values = [];
  const save = () => {
    if(name){
      if(values.length === 0){ // flag
        args[name] = true;
      } else if(values.length === 1){ // single value
        args[name] = values[0];
      } else { // multiple values
        args[name] = values;
      }
    }
  }

  for(let i=2; i<process.argv.length; i++){
    const arg = process.argv[i];
    if(arg.startsWith('-')){
      // new argument, save the last one
      save()
      // start a new one
      if(arg.startsWith('--')){ // long form
        name = arg.slice(2);
      } else { // short form
        name = arg.slice(1);
        if(shortMap[name]){
          name = shortMap[name];
        }
      }
      values = [];
    } else {
      // value
      values.push(arg);
    }
  }
  // save last arg
  save();
  return args;
}
