document.addEventListener('change', (event) => {
  const toggle = event.target.closest('[data-personalise-url]');
  if (!toggle) return;

  toggle.form.action = toggle.checked ? toggle.dataset.personaliseTagUrl : toggle.dataset.personaliseUrl;
}, true);
