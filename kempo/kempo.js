const components = {
  'k-card': 'Card',
  'k-code-editor': 'CodeEditor',
  'k-dialog': 'Dialog',
  'k-icon': 'Icon',
  'k-import': 'Import',
  'k-resize': 'Resize',
  'k-search': 'Search',
  'k-show-more': 'ShowMore',
  'k-side-menu': 'SideMenu',
  'k-split': 'Split',
  'k-tabs': 'Tabs',
  'k-web-snippet-editor': 'WebSnippetEditor'
}
const lookFor = new Set(Object.keys(components));
window.kempo = Object.assign({}, {
  pathToRoot: './',
  pathToKempoFromRoot: './kempo/',
  pathToIconsFromRoot: './kempo/icons/',
  autoLoadComponents: () => {
    lookFor.forEach( async component => {
      if(document.querySelector(component)){
        const path = `${kempo.pathToRoot}${kempo.pathToKempoFromRoot}components/${components[component]}.js`;
        console.log(path);
        import(path);
        lookFor.delete(component);
      }
    });
  },
  _darkModeQuery: window.matchMedia('(prefers-color-scheme: dark)'),
  _theme: 'auto',
  _themeListener: (e) => {
    if(window.kempo._theme === 'auto'){
      document.documentElement.setAttribute('theme', e.matches?'dark':'light');
    }
  },
  setTheme: (theme) => {
    window.kempo._theme = theme;
    if(window.kempo._theme === 'auto'){
      document.documentElement.setAttribute('theme', window.kempo._darkModeQuery.matches?'dark':'light');
    } else {
      document.documentElement.setAttribute('theme', theme);
    }
  }
}, window.kempo || {});
window.kempo.autoLoadComponents();
window.kempo._darkModeQuery.addEventListener('change', window.kempo._themeListener);
window.kempo.setTheme(document.documentElement.getAttribute('theme') || 'auto');
