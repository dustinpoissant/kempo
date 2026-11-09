import './ChangePassword.js';

/*
  Makes every `<button data-change-password>` on the page open the form that changes the signed-in person's password. The form
  is made the first time it is needed and kept. One listener for the whole page, so the button is just a button: an ordinary
  kempo-css button with nothing around it. The Change password button widget writes it.
*/
document.addEventListener('click', event => {
  if(!event.target.closest?.('button[data-change-password]')) return;
  const dialog = document.querySelector('k-change-password-dialog') ?? document.body.appendChild(document.createElement('k-change-password-dialog'));
  dialog.open();
});
