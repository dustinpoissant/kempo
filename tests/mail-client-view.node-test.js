import mailClientView from '../server/utils/email/mailClientView.js';

const wrap = css => `<html><head><style>${css}</style></head><body><p class="btn">Hi</p></body></html>`;
const styleOf = html => html.match(/<style>([\s\S]*?)<\/style>/)[1];

export default {
  'page-level rules are removed, and element rules for content are kept': async ({ pass, fail }) => {
    const css = styleOf(mailClientView(wrap(':root{color-scheme:light}html{font-size:16px}body{margin:0}*,*::before{box-sizing:border-box}h2{font-weight:700}')));
    if(/:root|html|body|\*/.test(css)) return fail(`a page-level rule survived: ${css}`);
    if(!css.includes('h2{font-weight:700}')) return fail(`content rule was dropped: ${css}`);
    pass('');
  },

  'colour functions and custom properties are removed, and plain colours kept': async ({ pass, fail }) => {
    const css = styleOf(mailClientView(wrap('.a{color:oklch(0.5 0.2 200)}.b{color:var(--x)}.c{color:rgb(51,102,255)}.d{background:color-mix(in srgb,red,blue)}')));
    if(/oklch|var\(|color-mix/.test(css)) return fail(`a value Gmail cannot read survived: ${css}`);
    if(!css.includes('.c{color:rgb(51,102,255)}')) return fail(`a plain colour was dropped: ${css}`);
    pass('');
  },

  'interactive and pseudo-element selectors are removed, a rule keeps the selectors that are fine': async ({ pass, fail }) => {
    const css = styleOf(mailClientView(wrap('a:hover{color:red}.x::before{content:""}.btn,a:focus{padding:8px}')));
    if(/hover|::before|:focus/.test(css)) return fail(`an unsupported selector survived: ${css}`);
    if(!css.includes('.btn{padding:8px}')) return fail(`the good selector was dropped: ${css}`);
    pass('');
  },

  'animation, transition, fixed positioning and shadows are removed': async ({ pass, fail }) => {
    const css = styleOf(mailClientView(wrap('.a{transition:color 1s;box-shadow:0 0 2px red;position:absolute;top:0;color:red}.r{position:relative}')));
    if(/transition|box-shadow|fixed/.test(css)) return fail(`a property survived: ${css}`);
    if(!css.includes('color:red')) return fail(`the plain declaration was dropped: ${css}`);
    if(!css.includes('.r{position:relative}')) return fail(`relative positioning was dropped: ${css}`);
    pass('');
  },

  'media queries keep their rules, and at-rules such as keyframes and font-face go': async ({ pass, fail }) => {
    const css = styleOf(mailClientView(wrap('@font-face{font-family:x;src:url(a.woff)}@keyframes spin{to{opacity:1}}@media (max-width:600px){.t{width:100%}}')));
    if(/font-face|keyframes/.test(css)) return fail(`an at-rule survived: ${css}`);
    if(!css.includes('@media (max-width:600px){.t{width:100%}}')) return fail(`the media rule was dropped: ${css}`);
    pass('');
  },

  'link stylesheets are removed and the rest of the document is unchanged': async ({ pass, fail }) => {
    const out = mailClientView('<html><head><link rel="stylesheet" href="x.css"><style>p{margin:0}</style></head><body><p>Hi</p></body></html>');
    if(out.includes('<link')) return fail('a link survived');
    if(!out.includes('<p>Hi</p>')) return fail('the body changed');
    pass('');
  },
};
