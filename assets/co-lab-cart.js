/**
 * Co-Lab cart-page behaviour.
 *
 * - Per-card confirm checkboxes flip a visual "confirmed" state on the card.
 * - The single global Checkout button is gated on every card being confirmed.
 * - "Remove" deletes all lines of a bundle (parent + birthstone/engraving children).
 */

(function () {
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  function refreshGate() {
    const cards = document.querySelectorAll('c-co-lab-cart-bundle');
    const checkout = document.querySelector('[data-global-checkout]');
    const note = document.querySelector('[data-gate-note]');
    if (!cards.length || !checkout) return;

    let unconfirmed = 0;
    cards.forEach((card) => {
      const cb = card.querySelector('[data-confirm-checkbox]');
      const confirmed = !!(cb && cb.checked);
      card.classList.toggle('c-co-lab-cart-bundle--confirmed', confirmed);
      if (!confirmed) unconfirmed += 1;
    });

    const allConfirmed = unconfirmed === 0;
    checkout.disabled = !allConfirmed;
    checkout.toggleAttribute('aria-disabled', !allConfirmed);
    if (note) note.hidden = allConfirmed;
  }

  async function removeBundle(bundleCard) {
    const bundleId = bundleCard.dataset.bundleId;
    if (!bundleId) return;

    try {
      const cart = await fetch(`${window.Shopify.routes.root}cart.js`).then((r) => r.json());
      const keys = cart.items
        .filter((item) => item.properties && item.properties._bundle_id === bundleId)
        .map((item) => item.key);

      if (keys.length === 0) return;

      const updates = {};
      keys.forEach((k) => { updates[k] = 0; });

      await fetch(`${window.Shopify.routes.root}cart/update.js`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });

      window.location.reload();
    } catch (err) {
      console.error('[co-lab-cart] bundle removal failed', err);
    }
  }

  function init() {
    document.querySelectorAll('c-co-lab-cart-bundle [data-confirm-checkbox]').forEach((cb) => {
      cb.addEventListener('change', refreshGate);
    });

    document.querySelectorAll('c-co-lab-cart-bundle [data-action="remove-bundle"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const card = btn.closest('c-co-lab-cart-bundle');
        if (card) removeBundle(card);
      });
    });

    refreshGate();
  }

  ready(init);
})();
