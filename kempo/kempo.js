const components = {
  'k-card': 'Card',
  'k-code-editor': 'CodeEditor',
  'k-collapse': 'Collapse',
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
window.kempo = {
  autoLoadComponents: () => {
    lookFor.forEach( async component => {
      if(document.querySelector(component)){
        import(`/kempo/components/${components[component]}.js`);
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
};
window.kempo.autoLoadComponents();
window.kempo._darkModeQuery.addEventListener('change', window.kempo._themeListener);
window.kempo.setTheme(document.documentElement.getAttribute('theme') || 'auto');
