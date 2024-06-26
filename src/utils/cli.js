import { spawn } from 'child_process';

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

export const getArgs =  (shortMap = {
  d: 'debug'
}) => {
  let name = '';
  let values = [];
  const save = () => {
    if(name){
      if(values.length === 0){ // flag
        args[name] = true;
      } else if(values.length === 1){ // single value
        if(values[0] === 'false'){
          args[name] = false;
        } else {
          args[name] = values[0];
        }
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

export const runChildProcess = (command) => new Promise((resolve, reject) => {
  const [cmd, ...args] = command.split(' ');
  const child = spawn(cmd, args);

  child.on('close', (code) => {
      if (code === 0) {
          resolve(`child process exited with code ${code}`);
      } else {
          reject(new Error(`child process exited with code ${code}`));
      }
  });
});

export const runChildNodeProcess = (scriptPath, argsObj = {}) => {
  const args = Object.entries(argsObj).flatMap(([key, value]) => {
      if (value === true) {
          return [`--${key}`];
      } else {
          return [`--${key}`, value];
      }
  });
  const command = `node ${scriptPath} ${args.join(' ')}`;
  return runChildProcess(command);
};

export default {
  getArgs,
  runChildNodeProcess,
  runChildNodeProcess
};