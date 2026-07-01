/**
 * Co-Lab Necklace picker.
 *
 * Single-SKU model (metal + chain are line-item properties, like the ring picker), plus three
 * "option grid" rows — Initial (A-Z), Stone Shape and Birthstone — each with its own inline grid.
 * Everything is included in the base price, so there are no add-on lines: one parent line carries
 * all the human-readable properties. Reuses the co-lab-picker.css component.
 */
class CoLabNecklacePicker extends HTMLElement {
  connectedCallback() {
    this.activeOption = null;

    this.form = this.querySelector('form[action*="/cart/add"]');
    this.submitBtn = this.querySelector('[data-action="submit"]');
    this.variantIdInput = this.querySelector('[data-variant-id]');
    this.errorEl = this.querySelector('[data-error]');

    this.metalRadios = Array.from(this.querySelectorAll('input[data-metal-option]'));
    this.metalSelectedLabel = this.querySelector('[data-metal-selected]');
    this.sizeSelect = this.querySelector('[data-size-select]');
    this.selectedMetal = '';
    this.selectedSize = '';

    this.basePrice = parseInt(this.dataset.basePrice, 10) || 0;
    // The Liquid `money` filter already renders in the customer's market/presentment
    // currency (e.g. $ on the USA market). Use that string so the modal matches the rest
    // of the site instead of the shop's base currency (£).
    this.basePriceFormatted = (this.querySelector('[data-base-price-display]')?.textContent || '').trim();
    this.productTitle = this.dataset.productTitle || '';

    const checkedMetal = this.metalRadios.find((r) => r.checked) || this.metalRadios[0];
    if (checkedMetal) this.selectMetal(checkedMetal.value);
    if (this.sizeSelect && this.sizeSelect.value) this.selectSize(this.sizeSelect.value);

    this.bindEvents();

    // Returning via bfcache restores this element with submitting still true (we set it and
    // navigated away on the previous add). Reset it so a returning customer can add again.
    // Only touches a boolean — no DOM or cart work.
    this.onPageShow = () => { this.submitting = false; this.closeModal(); };
    window.addEventListener('pageshow', this.onPageShow);
  }

  disconnectedCallback() {
    if (this.onPageShow) window.removeEventListener('pageshow', this.onPageShow);
  }

  bindEvents() {
    this.querySelectorAll('[data-action="open-option"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.openOption(btn.dataset.option);
      });
    });
    this.querySelectorAll('[data-action="pick-option"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.pickOption(btn.dataset);
      });
    });
    this.metalRadios.forEach((radio) => {
      radio.addEventListener('change', () => this.selectMetal(radio.value));
    });
    this.sizeSelect?.addEventListener('change', () => this.selectSize(this.sizeSelect.value));
    this.form?.addEventListener('submit', (e) => this.onSubmit(e));
  }

  selectMetal(value) {
    this.selectedMetal = value || '';
    this.metalRadios.forEach((radio) => { if (radio.value === value) radio.checked = true; });
    if (this.metalSelectedLabel) this.metalSelectedLabel.textContent = this.selectedMetal;
    this.clearError();
  }

  selectSize(value) {
    this.selectedSize = value || '';
    this.clearError();
  }

  // --- Option grids ----------------------------------------------------------

  grid(option) { return this.querySelector(`[data-option-grid="${CSS.escape(option)}"]`); }

  openOption(option) {
    const grid = this.grid(option);
    if (!grid) return;
    const isOpen = this.activeOption === option && !grid.hidden;
    // Close every grid first so only one is open at a time.
    this.querySelectorAll('[data-option-grid]').forEach((g) => { g.hidden = true; });
    this.querySelectorAll('[data-action="open-option"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
    if (isOpen) { this.activeOption = null; return; }
    this.activeOption = option;
    grid.hidden = false;
    const btn = this.querySelector(`[data-action="open-option"][data-option="${CSS.escape(option)}"]`);
    if (btn) btn.setAttribute('aria-expanded', 'true');
    this.markSelected(option);
    grid.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  closeOption(option) {
    const grid = this.grid(option);
    if (grid) grid.hidden = true;
    const btn = this.querySelector(`[data-action="open-option"][data-option="${CSS.escape(option)}"]`);
    if (btn) btn.setAttribute('aria-expanded', 'false');
    this.activeOption = null;
  }

  markSelected(option) {
    const input = this.input(option);
    const current = (input?.dataset.name || '').trim();
    this.querySelectorAll(`[data-option-grid="${CSS.escape(option)}"] .c-co-lab-picker__cell`).forEach((cell) => {
      cell.classList.toggle('c-co-lab-picker__cell--selected', !!current && cell.dataset.name === current);
    });
  }

  pickOption({ option, name, month, icon }) {
    this.clearError();
    const input = this.input(option);
    const text = this.querySelector(`[data-option-text="${CSS.escape(option)}"]`);
    const swatch = this.querySelector(`[data-option-swatch="${CSS.escape(option)}"]`);

    const value = month ? `${name} - ${month}` : name;
    input.value = value;
    input.disabled = false;
    input.dataset.name = name;
    input.dataset.icon = icon || '';

    if (swatch) {
      if (icon) {
        swatch.hidden = false;
        swatch.textContent = '';
        swatch.style.backgroundImage = `url(${icon})`;
      } else if (option === 'Initial') {
        swatch.hidden = false;
        swatch.style.backgroundImage = 'none';
        swatch.textContent = name;
      } else {
        swatch.hidden = true;
      }
    }

    // The initial's letter already shows in its swatch circle, so don't repeat it as text.
    if (text) text.textContent = (option === 'Initial' && swatch) ? '' : value;
    this.closeOption(option);
  }

  // --- State helpers ---------------------------------------------------------

  input(option) { return this.querySelector(`[data-option-input="${CSS.escape(option)}"]`); }
  optionInputs() { return Array.from(this.querySelectorAll('[data-option-input]')); }
  hasOption(option) { const i = this.input(option); return !!(i && i.value); }
  metalRequired() { return this.metalRadios.length > 0; }

  missingOptions() {
    return this.optionInputs().filter((i) => !i.value).map((i) => i.dataset.optionLabel);
  }

  selectionComplete() {
    if (this.metalRequired() && !this.selectedMetal) return false;
    if (!this.selectedSize) return false;
    return this.missingOptions().length === 0;
  }

  // --- Phase A: review modal -------------------------------------------------

  onSubmit(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    this.clearError();

    if (this.metalRequired() && !this.selectedMetal) { this.showError('Please choose a metal before adding to cart.'); return; }
    if (!this.selectedSize) { this.showError('Please choose a chain length before adding to cart.'); return; }
    const missing = this.missingOptions();
    if (missing.length) { this.showError(`Please choose your ${missing.join(', ')} before adding to cart.`); return; }

    const modal = document.getElementById(this.dataset.reviewModalId);
    if (!modal) { this.confirmAndAdd(); return; }
    const body = modal.querySelector('[data-colab-review-body]');
    if (body) this.renderReviewInto(body);
    modal.show ? modal.show() : modal.setAttribute('open', '');
  }

  basePriceDisplay() {
    return this.basePriceFormatted || this.formatMoney(this.basePrice);
  }

  formatMoney(amount) {
    // Format in the customer's active (presentment) currency, not the shop's base
    // currency — otherwise USA shoppers see £ in the modal.
    const currency = window.Shopify && window.Shopify.currency && window.Shopify.currency.active;
    if (currency) {
      try {
        return new Intl.NumberFormat(undefined, { style: 'currency', currency })
          .format(amount / 100)
          .replace(/[.,]00(?=\D*$)/, '');
      } catch (e) { /* fall through */ }
    }
    if (window.Shopify && typeof window.Shopify.formatMoney === 'function' && window.themeVariables?.settings?.moneyFormat) {
      return window.Shopify.formatMoney(amount, window.themeVariables.settings.moneyFormat);
    }
    const value = (amount / 100).toFixed(2).replace(/\.00$/, '');
    return `£${value}`;
  }

  el(tag, className, content) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (Array.isArray(content)) content.filter(Boolean).forEach((c) => node.appendChild(c));
    else if (content != null) node.textContent = content;
    return node;
  }

  reviewRow(label, value, swatchUrl) {
    const labelEl = this.el('span', 'c-co-lab-cart-bundle__row-label', `${label}:`);
    const valueEl = this.el('span', 'c-co-lab-cart-bundle__row-value');
    if (swatchUrl) {
      const swatch = this.el('span', 'c-co-lab-cart-bundle__row-swatch');
      swatch.style.backgroundImage = `url('${swatchUrl}')`;
      valueEl.appendChild(swatch);
    }
    valueEl.appendChild(document.createTextNode(value));
    return this.el('p', 'c-co-lab-cart-bundle__row', [labelEl, valueEl]);
  }

  renderReviewInto(container) {
    container.textContent = '';
    const card = this.el('c-co-lab-cart-bundle', 'c-co-lab-cart-bundle');

    card.appendChild(this.el('header', 'c-co-lab-cart-bundle__header', [
      this.el('h2', 'c-co-lab-cart-bundle__title', this.productTitle),
      this.el('p', 'c-co-lab-cart-bundle__base-price', this.basePriceDisplay()),
    ]));

    const qty = Math.max(1, parseInt(this.querySelector('input[name="quantity"]')?.value, 10) || 1);
    const metalRows = [];
    if (this.selectedMetal) metalRows.push(this.reviewRow('Precious Metal', this.selectedMetal));
    if (this.selectedSize) metalRows.push(this.reviewRow('Chain length', this.selectedSize));
    metalRows.push(this.reviewRow('Quantity', String(qty)));
    card.appendChild(this.el('section', 'c-co-lab-cart-bundle__group', [
      this.el('h3', 'c-co-lab-cart-bundle__group-title', 'Metal, Chain and Quantity'),
      ...metalRows,
    ]));

    const customRows = this.optionInputs()
      .filter((i) => i.value)
      .map((i) => this.reviewRow(i.dataset.optionLabel, i.value, i.dataset.icon || ''));
    if (customRows.length) {
      card.appendChild(this.el('section', 'c-co-lab-cart-bundle__group', [
        this.el('h3', 'c-co-lab-cart-bundle__group-title', 'Personalisation'),
        ...customRows,
      ]));
    }

    card.appendChild(this.el('p', 'c-co-lab-cart-bundle__total', this.basePriceDisplay()));

    const modalError = this.el('p', 'c-co-lab-picker__error');
    modalError.setAttribute('data-modal-error', '');
    modalError.setAttribute('role', 'alert');
    modalError.setAttribute('aria-live', 'polite');
    modalError.hidden = true;
    card.appendChild(modalError);
    this.modalErrorEl = modalError;

    const confirmCheck = document.createElement('input');
    confirmCheck.type = 'checkbox';
    confirmCheck.id = `${this.dataset.reviewModalId}-confirm`;
    const confirmLabel = this.el('label', 'c-co-lab-picker__confirm');
    confirmLabel.htmlFor = confirmCheck.id;
    confirmLabel.appendChild(this.el('span', 'c-co-lab-picker__confirm-label', 'I confirm my selection is correct'));
    confirmLabel.appendChild(confirmCheck);
    card.appendChild(confirmLabel);
    card.appendChild(this.el('p', 'c-co-lab-picker__confirm-note', 'Your piece will be crafted exactly as confirmed above - made just for you and dispatched in 2-3 weeks.'));

    const backBtn = this.el('button', 'c-co-lab-cart-bundle__action c-co-lab-cart-bundle__action--secondary', '← Edit');
    backBtn.type = 'button';
    const confirmBtn = this.el('button', 'c-co-lab-cart-bundle__action c-co-lab-cart-bundle__action--primary', 'Add to cart');
    confirmBtn.type = 'button';
    confirmBtn.disabled = true;
    card.appendChild(this.el('div', 'c-co-lab-cart-bundle__actions', [backBtn, confirmBtn]));

    confirmCheck.addEventListener('change', () => { confirmBtn.disabled = !confirmCheck.checked; });
    confirmBtn.addEventListener('click', () => this.confirmAndAdd(confirmBtn));
    backBtn.addEventListener('click', () => this.closeModal());

    container.appendChild(card);
  }

  closeModal() {
    const modal = document.getElementById(this.dataset.reviewModalId);
    if (modal) modal.hide ? modal.hide() : modal.removeAttribute('open');
  }

  // --- Phase B: add to cart --------------------------------------------------

  async confirmAndAdd(confirmBtn) {
    this.clearModalError();
    // In-flight guard: a second click during the async add could mint a second bundle and
    // duplicate the line, so ignore re-entry until the add settles (reset in finally paths).
    if (this.submitting) return;
    if (!this.selectionComplete()) { this.showModalError('Please complete every option before adding to cart.'); return; }

    this.submitting = true;
    const bundleId = (crypto.randomUUID && crypto.randomUUID()) || `bundle-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const qty = Math.max(1, parseInt(this.querySelector('input[name="quantity"]')?.value, 10) || 1);

    const props = { _bundle_id: bundleId, _bundle_role: 'parent' };
    if (this.selectedMetal) props['Precious Metal'] = this.selectedMetal;
    if (this.selectedSize) props['Size'] = this.selectedSize;
    this.optionInputs().forEach((i) => { if (i.value) props[i.dataset.optionLabel] = i.value; });

    const items = [{ id: parseInt(this.variantIdInput.value, 10), quantity: qty, properties: props }];

    if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.setAttribute('aria-busy', 'true'); }

    try {
      const sectionsToBundle = [];
      document.documentElement.dispatchEvent(new CustomEvent('cart:prepare-bundled-sections', {
        bubbles: true, detail: { sections: sectionsToBundle },
      }));
      const root = window.Shopify.routes.root;
      const res = await fetch(`${root}cart/add.js`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ items, sections: sectionsToBundle.join(','), sections_url: window.location.pathname }),
      });
      if (!res.ok) { const payload = await this.safeJson(res); throw new NecklaceCartAddError(res.status, payload); }
      const data = await res.json();
      // Add to cart and open the side cart drawer (the theme's own way), staying on the page
      // rather than redirecting to checkout.
      await this.syncCartDrawer(root, data.sections);
      this.closeModal();
      this.submitting = false;
      if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.removeAttribute('aria-busy'); }
    } catch (err) {
      console.error('[co-lab-necklace-picker] add to cart failed', err);
      this.submitting = false;
      this.showModalError(this.friendlyErrorMessage(err));
      if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.removeAttribute('aria-busy'); }
    }
  }

  // Mirror the theme's own ProductForm add flow: one cart:change carrying the rendered section
  // HTML so the side cart drawer re-renders, updates the count, and opens (force_open_drawer +
  // variant:add). No cart:refresh, no DOM swap of our own — that keeps line-item remove/quantity
  // controls intact.
  async syncCartDrawer(root, sections) {
    try {
      const cart = await (await fetch(`${root}cart.js`, { headers: { Accept: 'application/json' } })).json();
      cart.sections = sections;
      document.documentElement.dispatchEvent(new CustomEvent('cart:change', {
        bubbles: true, detail: { baseEvent: 'variant:add', onSuccessDo: 'force_open_drawer', cart },
      }));
    } catch (err) {
      console.error('[co-lab-necklace-picker] cart drawer update failed', err);
    }
  }

  async safeJson(response) { try { return await response.json(); } catch { return null; } }

  friendlyErrorMessage(err) {
    if (err instanceof TypeError) return "We couldn't reach the store. Check your connection and try again.";
    if (err instanceof NecklaceCartAddError) {
      const msg = (err.payload && (err.payload.description || err.payload.message)) || '';
      if (err.status === 422) return msg || "We couldn't add this to your cart. Please try again.";
      if (err.status === 429) return 'Too many requests right now — please wait a moment and try again.';
      if (err.status >= 500) return 'The store is having a moment. Please try again in a few seconds.';
      return msg || 'Something went wrong adding this to your cart.';
    }
    return 'Something went wrong adding this to your cart. Please try again.';
  }

  showError(message) { if (this.errorEl) { this.errorEl.textContent = message; this.errorEl.hidden = false; } }
  clearError() { if (this.errorEl) { this.errorEl.textContent = ''; this.errorEl.hidden = true; } }
  showModalError(message) { if (this.modalErrorEl) { this.modalErrorEl.textContent = message; this.modalErrorEl.hidden = false; } }
  clearModalError() { if (this.modalErrorEl) { this.modalErrorEl.textContent = ''; this.modalErrorEl.hidden = true; } }
}

class NecklaceCartAddError extends Error {
  constructor(status, payload) { super(`Cart add failed (${status})`); this.status = status; this.payload = payload; }
}

customElements.define('c-co-lab-necklace-picker', CoLabNecklacePicker);
