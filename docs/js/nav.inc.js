document.getElementById('open-side-menu').addEventListener('click', async () => {
  await window.customElements.whenDefined('k-side-menu');
  document.getElementById('side-menu').open();
})