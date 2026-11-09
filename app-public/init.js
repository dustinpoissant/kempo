window.kempo = { pathsToIcons: ['/icons', '/kempo/icons', '/kempo-ui/icons'], pathToStylesheet: '/kempo-css/kempo.min.css' };
window.litDisableBundleWarning = true;
try{
  document.documentElement.setAttribute('theme', localStorage.getItem('theme') || 'auto');
}catch(e){}
