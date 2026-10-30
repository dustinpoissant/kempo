import juice from 'juice';

/*
  Moves a stylesheet's rules onto the elements they match, as `style` attributes, because mail clients such as Gmail ignore <style>
  blocks. Specificity and !important are handled by juice. Media queries are dropped (Gmail does not keep them either), and the
  <style> block is not added to the output.
*/
export default (html, css) => juice.inlineContent(String(html ?? ''), String(css ?? ''), {
  applyStyleTags: false,
  removeStyleTags: true,
  preserveMediaQueries: false,
  preserveFontFaces: false,
  applyWidthAttributes: false,
});
