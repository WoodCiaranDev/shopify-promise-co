(() => {
  if (window.preorderConfirmReady) return;
  window.preorderConfirmReady = true;

  const hideModal = (modal) => Promise.race([modal.hide(), new Promise((resolve) => setTimeout(resolve, 700))]);

  const openConfirm = (form, modal) => {
    const agree = modal.querySelector('[data-preorder-agree]');
    const accept = modal.querySelector('[data-preorder-accept]');
    const back = modal.querySelector('[data-preorder-back]');

    agree.checked = false;
    accept.disabled = true;

    const pageButton = form.querySelector('.button--add-to-cart');
    if (pageButton) {
      const styles = getComputedStyle(pageButton);
      accept.style.setProperty('--button-background', styles.getPropertyValue('--button-background'));
      accept.style.setProperty('--button-text-color', styles.getPropertyValue('--button-text-color'));
    }

    agree.onchange = () => {
      accept.disabled = !agree.checked;
    };

    back.onclick = () => hideModal(modal);

    accept.onclick = async () => {
      await hideModal(modal);
      form.dataset.preorderConfirmed = 'true';
      form.requestSubmit();
    };

    modal.show();
  };

  document.addEventListener('submit', (event) => {
    const form = event.target;
    const marker = form.querySelector('[data-preorder]');

    if (!marker) return;

    if (form.dataset.preorderConfirmed === 'true') {
      delete form.dataset.preorderConfirmed;
      return;
    }

    const modal = document.getElementById(marker.dataset.preorder);
    if (!modal) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    openConfirm(form, modal);
  }, true);
})();
