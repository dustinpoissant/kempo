import Component from '../../../kempo/components/Component.js';

const raf = async () => new Promise(r=>requestAnimationFrame(r));

export const name = 'Component Test';
export const description = 'A set of tests for the core Component class';
export const tests = [
  {
    name: 'Can be instatiated',
    description: 'An instance of the class can be created',
    test: ({
      pass,
      fail,
      log
    }) => {
      log('Creating an instance of Component');
      try {
        new Component();
        pass('An instance of Component was created');
      } catch (error) {
        fail(error.message);
      }
    }
  },
  {
    name: 'Is Initiated when created via the tag',
    description: 'When a <code>&lt;k-component></code> created, is it an instance of <code>Component</code>?',
    test: ({
      pass,
      fail,
      log
    }) => {
      log('Creating k-component');
      const $comp = document.createElement('k-component');
      log('Testing if result is an instanceof of Component');
      if($comp instanceof Component){
        pass('The result is an instance of Component');
      } else {
        fail('The result is not an instance of Component');
      }
    }
  },
  {
    name: "Has all required properties",
    description: "Has all required properties and they are the correct type",
    test: ({
      pass,
      fail,
      log
    }) => {
      log('Creating an instance of Component');
      const $comp = new Component();
      const requiredProps = {
        shadowTemplate: 'string',
        shadowStyles: 'string',
        rendered: 'boolean',
        render: 'function'
      };
      if(
        Object.keys(requiredProps).every( propName => {
          log(`Testing that ${propName} is a ${requiredProps[propName]}`);  
          return typeof($comp[propName]) === requiredProps[propName];
        })
      ){
        pass('The component contains all required properties and they are of the correct type');
      } else {
        fail('The component does not have all properties, or they are not of the correc type', JSON.stringify(requiredProps));
      }
    }
  },
  {
    name: 'Is rendered when connected to a DOM',
    description: 'The element should have it\'s rendered attribute set to true when it is connected to the DOM',
    test: async ({
      pass,
      fail,
      log
    }) => {
      log('Creating an instance of Component');
      const $comp = new Component();
      log('Attaching the component to the DOM');
      document.getElementById('test').appendChild($comp);
      log('Waiting 1 frame for render');
      await raf();
      log('Checking if the component is rendered');
      if($comp.rendered){
        pass('The component was rendered');
      } else {
        fail('The component was not rendered');
      }
      log('Cleanup: Removing the component from the DOM');
      $comp.remove();
    }
  },
  {
    name: 'Contains a Shadow DOM',
    description: 'The element should contain a Shadow DOM that contains the <code>shadowTemplate</code> and the <code>shadowStyles</code>.',
    test: async ({
      pass,
      fail,
      log
    }) => {
      log('Creating an instance of Component');
      const $comp = new Component();

      const cleanup = () => {
        log('Cleanup: Removing the component from the DOM');
        $comp.remove();
      }

      log('Attaching the component to the DOM');
      document.getElementById('test').appendChild($comp);
      log('Waiting 1 frame for render');
      await raf();

      log('Verifing if it contains a shadowRoot');
      if(!$comp.shadowRoot){
        fail('The component does not have a shadowRoot');
        cleanup();
        return;
      }
      log('Verifing that the shadowRoot contains the shadowTemplate');
      if(!$comp.shadowRoot.innerHTML.includes($comp.shadowTemplate)){
        fail('The component\'s shadowRoot does not contain the shadowTemplate');
        cleanup();
        return;
      }
      log('Verifing that the shadowRoot contains the shadowStyles');
      if(!$comp.shadowRoot.innerHTML.includes($comp.shadowStyles)){
        fail('The component\'s shadowRoot does not contain the shadowStyles');
        cleanup();
        return;
      }
      pass('The elemnet contains a proper Shadow DOM');
      cleanup();
    }
  }
];