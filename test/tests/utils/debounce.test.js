import debounce from '../../../kempo/utils/debounce.js';

const wait = ms => new Promise(r=>setTimeout(r,ms));

export const name = 'Debounce Function Test';
export const description = 'Testing debounce utility functions in <code>/kempo/utils/debounce.js</code>';

export const tests = [
  {
    name: 'Call Twice, Execute Once',
    description: 'The debounced function will be called twice within the timeout and should only be executed once',
    test: async ({
      pass,
      fail,
      log 
    }) => {
      log('Creating a call counter');
      let callCount = 0;
      log('Creating a debounced function that incraments the counter when exectured, with a debounce timeout of 100ms');
      const func = debounce(()=>{
        log(`debounced function executed, incrament counter to ${++callCount}`);
      }, 100);
      log('Waiting 10ms');
      await wait(10);
      log('Calling the debounced function');
      func();
      log('Waiting 50ms');
      await wait(50);
      log('Calling the debounced function');
      func();
      log('Waiting 200ms before checking the counter');
      await wait(200);
      log('Checking the counter');
      if(callCount === 1){
        pass('The debounced function was executed once as expected');
      } else {
        fail(`The debounced function should have been executed once, but was executed ${callCount} times`);
      }
    }
  },
  {
    name: 'Call Twice, Execure Twice',
    description: 'The debounced function will be called twice, but with long enough between calls that both should execute',
    test: async ({
      pass,
      fail,
      log
    }) => {
      log('Creating a call counter');
      let callCount = 0;
      log('Creating a debounced function that incraments the counter when exectured, with a debounce timeout of 100ms');
      const func = debounce(()=>{
        log(`debounced function executed, incrament counter to ${++callCount}`);
      }, 100);
      log('Calling the debounced function');
      func();
      log('Waiting 101ms');
      await wait(101);
      log('Calling the debounced function');
      func();
      log('Waiting 200ms before checking the counter');
      await wait(200);
      log('Checking the counter');
      if(callCount === 2){
        pass('The debounced function was executed once as expected');
      } else {
        fail(`The debounced function should have been executed once, but was executed ${callCount} times`);
      }
    }
  }
]