import {
  saveCookie,
  getCookie,
  deleteCookie
} from '../../kempo/utils/cookie.js';

export const name = 'Cookie Tests';
export const description = 'Testing cookie utility functions in <code>/kempo/utils/cookie.js</code>';

export const tests = [
  {
    name: 'saveCookie',
    description: 'Save a cookie to the browser',
    test: ({
      pass,
      fail,
      log 
    }) => {
      const name = "test";
      const expected = "test123";
      log(`Using saveCookie to save the cookie ${name}="${expected}"`);
      saveCookie(name, expected);
      const recieved = document.cookie.split('; ').find(cookie => cookie.startsWith(`${name}=`)).split('=')[1];
      log('Retrieving the value from the cookie, and comparing it to the expected value');
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      if(expected===recieved){
        pass('The cookie was successfully saved with the correct value');
      } else {
        fail(
          'The cookie was not saved with the correct value',
          `Expected: ${expected}`,
          `Recieved: ${recieved}`
        );
      }
    }
  },
  {
    name: 'getCookie',
    description: 'Retrieve a cookie from the browser',
    test: ({
      pass,
      fail,
      log
    }) => {
      const name = 'test';
      const expected = 'test123';
      log('Manually setting a cookie');
      document.cookie = `${name}=${expected}; expires='${new Date(Date.now()+60000).toUTCString()};path=/`;
      log('Using getCookie to retrieve the value');
      const recieved = getCookie(name);
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      if(expected === recieved){
        pass('The cookie was successfully retrieved with the correct value');
      } else {
        fail(
          'The cookie was not retrieved with the correct value',
          `Expected: ${expected}`,
          `Recieved: ${recieved}`
        );
      }

    }
  },
  {
    name: 'delete Cookie',
    description: 'Delete a cookie from the browser',
    test: ({
      pass,
      fail,
      log
    }) => {
      const name = 'test';
      const value = 'test123';
      log('Setting cookie');
      document.cookie = `${name}=${value}; expires='${new Date(Date.now()+60000).toUTCString()};path=/`;
      log('Deleting cookie with deleteCookie');
      deleteCookie(name);
      log('Attempting to retrieve cookie');
      const recieved = document.cookie.split('; ').find(cookie => cookie.startsWith(`${name}=`));
      if(recieved){
        fail(`A cookie was found with name "${name}" when it should have been deleted`, recieved);
      } else {
        pass('The cookie was successfully deleted');
      }
    }
  }
]