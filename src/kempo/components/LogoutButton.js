import { logout } from '../sdk.js';

/*
  Makes every `<button data-logout>` on the page sign the person out, then go to its `data-redirect` (nowhere, when there is
  none). One listener for the whole page, so the button is just a button: an ordinary kempo-css button that takes the same
  margin, color and alignment classes as any other, with nothing around it. The Logout button widget writes it.
*/
document.addEventListener('click', async event => {
  const button = event.target.closest?.('button[data-logout]');
  if(!button) return;
  const [error] = await logout();
  if(error){
    console.error('Logout failed:', error.msg);
    return;
  }
  if(button.dataset.redirect) window.location.href = button.dataset.redirect;
});
