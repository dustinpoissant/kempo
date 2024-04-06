import cli from '../../src/utils/cli.js';

export const name = 'CLI Tests';
export const description = 'The CLI function returns an object that contains the key-value pairs of command line arguments passed into the scripts, it supports short codes and flags (they will simply have a true value).';

export const tests = [
  {
    name: 'Get Arguments',
    description: 'Does the function property return the arguments?',
    test: ({
      pass,
      fail,
      log
    }) => {
      window.global = window;
      window.process = window.process || {};
      window.process.argv = [
        'node',
        'scriptname',
        '--arg1',
        'val1',
        '--arg2',
        'val2'
      ];
      log(`Setting process.argv to ${JSON.stringify(process.argv)}`);
      log('Running cli() to build these arguments into an object');
      const results = cli();
      const serialized = JSON.stringify(results);
      log(`results = ${serialized}`);
      if(serialized === `{"arg1":"val1","arg2":"val2"}`){
        pass('The arguments were successfully parsed');
      } else {
        fail(
          'Expected: {"arg1":"val1","arg2":"val2"}',
          `Recieved: ${serialized}`
        );
      }
    }
  },
  {
    name: 'Process Flags',
    description: 'Does this function understand flags (argument without values)',
    test: ({
      pass,
      fail,
      log
    }) => {
      window.global = window;
      window.process = window.process || {};
      window.process.argv = [
        'node',
        'scriptname',
        '--arg1',
        'val1',
        '--flag1',
        '--arg2',
        'val2',
        '--flag2'
      ];
      log(`Setting process.argv to ${JSON.stringify(process.argv)}`);
      log('Running cli() to build these arguments into an object');
      const results = cli();
      const serialized = JSON.stringify(results);
      log(`results = ${serialized}`);
      if(serialized === `{"arg1":"val1","flag1":true,"arg2":"val2","flag2":true}`){
        pass('The arguments were successfully parsed');
      } else {
        fail(
          'Expected: {"arg1":"val1","flag1":true,"arg2":"val2","flag2":true}',
          `Recieved: ${serialized}`
        );
      }
    }
  },
  {
    name: 'Process Shorthand Args',
    description: 'Does this function understand shorthands, args and flags',
    test: ({
      pass,
      fail,
      log
    }) => {
      window.global = window;
      window.process = window.process || {};
      window.process.argv = [
        'node',
        'scriptname',
        '-a',
        'val1',
        '-b',
        'val2',
      ];
      const shortMap = {
        a: 'arg1',
        b: 'arg2'
      }
      log(`Setting process.argv to ${JSON.stringify(process.argv)}`);
      log(`Creating a shorthand argument map ${JSON.stringify(shortMap)}`)
      log('Running cli(shortMap) to build these arguments into an object');
      const results = cli(shortMap);
      const serialized = JSON.stringify(results);
      log(`results = ${serialized}`);
      if(serialized === `{"arg1":"val1","arg2":"val2"}`){
        pass('The arguments were successfully parsed');
      } else {
        fail(
          'Expected: {"arg1":"val1","arg2":"val2"}',
          `Recieved: ${serialized}`
        );
      }
    }
  }
];
