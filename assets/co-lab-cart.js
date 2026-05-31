/**
 * Co-Lab cart-page behaviour.
 *
 * - Gates the global checkout button on every bundle card's confirm checkbox.
 * - Removes ALL lines of a bundle (parent + birthstone/engraving children) when
 *   the customer clicks "Remove" on a bundle card.
 *
 * Loaded site-wide; activates itself only when bundle cards are present on the page.
 */

(function () {
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  function refreshCardGates() {
    // Each card's Checkout button is gated by its own confirm checkbox.
    document.querySelectorAll('c-co-lab-cart-bundle').forEach((card) => {
      const cb = card.querySelector('[data-confirm-checkbox]');
      const btn = card.querySelector('[data-action="checkout"]');
      if (!cb || !btn) return;
      btn.disabled = !cb.checked;
      btn.toggleAttribute('aria-disabled', !cb.checked);
      btn.style.opacity = cb.checked ? '' : '0.4';
      btn.style.cursor = cb.checked ? '' : 'not-allowed';
    });
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

      // /cart/update.js accepts a `updates` object of { lineKey: 0 } to remove.
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
      cb.addEventListener('change', refreshCardGates);
    });

    document.querySelectorAll('c-co-lab-cart-bundle [data-action="remove-bundle"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const card = btn.closest('c-co-lab-cart-bundle');
        if (card) removeBundle(card);
      });
    });

    refreshCardGates();
  }

  ready(init);
})();
