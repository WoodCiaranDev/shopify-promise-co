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

  function findCheckoutButton() {
    // Cart-page checkout button — submitted as part of the cart form with name="checkout".
    return document.querySelector('form.cart-page button[name="checkout"]');
  }

  function refreshCheckoutGate() {
    const btn = findCheckoutButton();
    if (!btn) return;
    const boxes = document.querySelectorAll('c-co-lab-cart-bundle [data-confirm-checkbox]');
    if (boxes.length === 0) {
      btn.disabled = false;
      return;
    }
    const allTicked = [...boxes].every((b) => b.checked);
    btn.disabled = !allTicked;
    btn.toggleAttribute('aria-disabled', !allTicked);
    btn.style.opacity = allTicked ? '' : '0.5';
    btn.style.cursor = allTicked ? '' : 'not-allowed';
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
      cb.addEventListener('change', refreshCheckoutGate);
    });

    document.querySelectorAll('c-co-lab-cart-bundle [data-action="remove-bundle"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const card = btn.closest('c-co-lab-cart-bundle');
        if (card) removeBundle(card);
      });
    });

    refreshCheckoutGate();
  }

  ready(init);
})();
