class CoLabPicker extends HTMLElement {
  connectedCallback() {
    this.activeSlot = null;

    this.form = this.querySelector('form[action*="/cart/add"]');
    this.stonesToggle = this.querySelector('[data-action="toggle-stones"]');
    this.stonesEl = this.querySelector('[data-stones]');
    this.gridEl = this.querySelector('[data-grid]');
    this.submitBtn = this.querySelector('[data-action="submit"]');
    this.engravingInput = this.querySelector('[data-engraving-input]');
    this.engravingCount = this.querySelector('[data-engraving-count]');
    this.variantIdInput = this.querySelector('[data-variant-id]');
    this.errorEl = this.querySelector('[data-error]');
    this.customCard = this.querySelector('.c-co-lab-picker__card--custom');

    // Per-product pricing / slot configuration (defaults baked into the Liquid).
    // A price of 0 always means "included", regardless of the charged flag.
    this.bsPrice = parseInt(this.dataset.birthstonePrice, 10) || 0;
    this.engPrice = parseInt(this.dataset.engravingPrice, 10) || 0;
    this.bsCharged = this.dataset.birthstoneCharged === 'true' && this.bsPrice > 0;
    this.engCharged = this.dataset.engravingCharged === 'true' && this.engPrice > 0;
    this.basePrice = parseInt(this.dataset.basePrice, 10) || 0;
    this.productTitle = this.dataset.productTitle || '';

    this.stonesData = this.parseJson('[data-stones-json]', []);
    this.productOptions = this.parseJson('[data-product-options]', []);
    this.selectedVariant = this.parseJson('[data-initial-variant]', null);

    this.bindEvents();
    this.refresh();

    // The first size pick triggers a full re-render that rebuilds this picker with the
    // size already selected, so scroll here. Fresh loads start at the placeholder.
    requestAnimationFrame(() => {
      const sizeSelect = this.querySelector('[data-size-select]');
      if (sizeSelect && sizeSelect.value) this.scrollToCustomisation();
    });
  }

  parseJson(selector, fallback) {
    const el = this.querySelector(selector);
    try {
      return JSON.parse(el?.textContent || '');
    } catch {
      return fallback;
    }
  }

  bindEvents() {
    this.stonesToggle?.addEventListener('click', () => this.toggleStones());

    this.querySelectorAll('[data-action="open-grid"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.openGrid(btn.dataset.slot);
      });
    });

    this.querySelectorAll('[data-action="pick-stone"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.pickStone(btn.dataset);
      });
    });

    this.engravingInput?.addEventListener('input', () => {
      this.clearError();
      this.onEngravingChange();
    });

    document.addEventListener('variant:change', (e) => {
      if (e.detail?.variant?.id && this.variantIdInput) {
        this.variantIdInput.value = e.detail.variant.id;
        this.selectedVariant = e.detail.variant;
        this.clearError();
        this.refresh();
      }
    });

    // Scroll to customisation when a size is picked (delegated; ignores metal swatches).
    this.addEventListener('change', (e) => {
      const target = e.target;
      if (target && target.matches && target.matches('[data-size-select]') && target.value) {
        this.scrollToCustomisation();
      }
    });

    this.form?.addEventListener('submit', (e) => this.onSubmit(e));
  }

  // Resolve --sticky-area-height (a calc() string) to pixels so the card clears the header.
  headerOffset() {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;visibility:hidden;height:var(--sticky-area-height);';
    document.body.appendChild(probe);
    const px = probe.offsetHeight || 0;
    probe.remove();
    return px;
  }

  scrollToCustomisation() {
    const tryScroll = () => {
      // Re-query the live card: the first size pick rebuilds the picker, so a cached
      // reference can point at a destroyed node.
      const card = document.querySelector('.c-co-lab-picker__card--custom');
      if (!card) return;
      const top = card.getBoundingClientRect().top + window.scrollY - this.headerOffset() - 20;
      window.scrollTo({ top, behavior: 'smooth' });
    };
    // Re-assert a few times: the theme's async re-render can cancel a single smooth scroll.
    [0, 300, 600].forEach((delay) => setTimeout(tryScroll, delay));
  }

  toggleStones() {
    const expanded = this.stonesToggle.getAttribute('aria-expanded') === 'true';
    this.stonesToggle.setAttribute('aria-expanded', String(!expanded));
    this.stonesEl.hidden = expanded;
    if (this.engravingInput) this.engravingInput.disabled = expanded;
    this.closeGrid();
    this.syncStoneInputs();
    this.refresh();
  }

  openGrid(slot) {
    if (!this.gridEl) return;
    // Save scroll position so closing restores the viewport (otherwise the user
    // is left looking at empty space below where the grid was).
    if (this.activeSlot == null) {
      this._scrollSnapshot = window.scrollY;
    }
    // Toggle: clicking the active row's select while open should close.
    if (this.activeSlot === slot && !this.gridEl.hidden) {
      this.closeGrid();
      return;
    }
    this.activeSlot = slot;
    // Move the grid to be the immediate sibling AFTER the active stone row so
    // it appears inline between rows (per design), not at the bottom.
    const row = this.querySelector(`.c-co-lab-picker__stone-row[data-slot="${slot}"]`);
    if (row) row.insertAdjacentElement('afterend', this.gridEl);
    this.gridEl.hidden = false;
    this.gridEl.dataset.activeSlot = slot;
    this.querySelectorAll('[data-action="open-grid"]').forEach((b) => {
      b.setAttribute('aria-expanded', b.dataset.slot === slot ? 'true' : 'false');
    });
    this.updateGridSelection();
    if (row) row.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  closeGrid() {
    if (!this.gridEl) return;
    this.gridEl.hidden = true;
    this.gridEl.dataset.activeSlot = '';
    this.activeSlot = null;
    this.querySelectorAll('[data-action="open-grid"]').forEach((b) => {
      b.setAttribute('aria-expanded', 'false');
    });
    if (this._scrollSnapshot != null) {
      const target = this._scrollSnapshot;
      this._scrollSnapshot = null;
      window.scrollTo({ top: target, behavior: 'smooth' });
    }
  }

  updateGridSelection() {
    if (!this.activeSlot) return;
    const input = this.querySelector(`[data-stone-input="${this.activeSlot}"]`);
    const current = input?.value?.split(' - ')[0]?.trim();
    this.querySelectorAll('.c-co-lab-picker__cell').forEach((cell) => {
      cell.classList.toggle('c-co-lab-picker__cell--selected', !!current && cell.dataset.name === current);
    });
  }

  pickStone({ name, month, icon }) {
    if (!this.activeSlot) return;
    this.clearError();
    const slot = this.activeSlot;
    const input = this.querySelector(`[data-stone-input="${slot}"]`);
    const text = this.querySelector(`[data-stone-text="${slot}"]`);
    const swatch = this.querySelector(`[data-stone-swatch="${slot}"]`);

    input.value = `${name}${month ? ' - ' + month : ''}`;
    input.disabled = false;
    text.textContent = input.value;
    if (icon) {
      swatch.hidden = false;
      swatch.style.backgroundImage = `url(${icon})`;
    } else {
      swatch.hidden = true;
    }
    this.closeGrid();
    this.refresh();
  }

  onEngravingChange() {
    const value = this.engravingInput.value;
    const max = this.engravingInput.maxLength > 0 ? this.engravingInput.maxLength : value.length;
    this.engravingCount.textContent = `${value.length}/${max} Characters`;
    this.refresh();
  }

  syncStoneInputs() {
    this.querySelectorAll('[data-stone-input]').forEach((input) => {
      input.disabled = !input.value;
    });
  }

  hasStone(slot) {
    const input = this.querySelector(`[data-stone-input="${slot}"]`);
    return !!(input && input.value);
  }

  stoneValue(slot) {
    const input = this.querySelector(`[data-stone-input="${slot}"]`);
    return input ? input.value : '';
  }

  stoneSlots() {
    return Array.from(this.querySelectorAll('[data-stone-input]')).map((i) => i.dataset.stoneInput);
  }

  pickedStoneCount() {
    return this.stoneSlots().filter((slot) => this.hasStone(slot)).length;
  }

  hasEngraving() {
    return !!(this.engravingInput && this.engravingInput.value.trim());
  }

  variantSelected() {
    return !!(this.variantIdInput && this.variantIdInput.value);
  }

  refresh() {
    this.syncStoneInputs();
    if (this.submitBtn) this.submitBtn.disabled = !this.variantSelected();
  }

  // --- Phase A: open the review modal (no cart mutation yet) -----------------

  onSubmit(event) {
    event.preventDefault();
    // The form is wrapped in the theme's <product-form>, whose own submit handler
    // would fire its own /cart/add with only the parent variant — missing our
    // add-on lines and bundle properties. Suppress it.
    event.stopImmediatePropagation();
    this.clearError();

    if (!this.variantSelected()) {
      this.showError('Please choose a size before adding to cart.');
      return;
    }

    const modal = document.getElementById(this.dataset.reviewModalId);
    if (!modal) {
      // No modal in the DOM — fall back to adding straight away.
      this.confirmAndAdd();
      return;
    }

    const body = modal.querySelector('[data-colab-review-body]');
    if (body) this.renderReviewInto(body);
    modal.show ? modal.show() : modal.setAttribute('open', '');
  }

  // --- Review card (built with safe DOM construction, no innerHTML) ----------

  formatMoney(pence) {
    if (window.Shopify && typeof window.Shopify.formatMoney === 'function' && window.themeVariables?.settings?.moneyFormat) {
      return window.Shopify.formatMoney(pence, window.themeVariables.settings.moneyFormat);
    }
    // Fallback: assume GBP, trim trailing zeros.
    const value = (pence / 100).toFixed(2).replace(/\.00$/, '');
    return `£${value}`;
  }

  computedTotal() {
    let total = this.basePrice;
    if (this.bsCharged) total += this.pickedStoneCount() * this.bsPrice;
    if (this.engCharged && this.hasEngraving()) total += this.engPrice;
    return total;
  }

  stoneSwatchUrl(value) {
    const name = (value || '').split(' - ')[0].trim();
    const stone = this.stonesData.find((s) => s.name === name);
    return stone?.icon || '';
  }

  /** Tiny element builder: el('p', 'class', 'text') or el('div', 'class', [children]). */
  el(tag, className, content) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (Array.isArray(content)) {
      content.filter(Boolean).forEach((c) => node.appendChild(c));
    } else if (content != null) {
      node.textContent = content;
    }
    return node;
  }

  reviewRow(label, value, swatchUrl, uplift) {
    const labelEl = this.el('span', 'c-co-lab-cart-bundle__row-label', `${label}:`);
    const valueEl = this.el('span', 'c-co-lab-cart-bundle__row-value');
    if (swatchUrl) {
      const swatch = this.el('span', 'c-co-lab-cart-bundle__row-swatch');
      swatch.style.backgroundImage = `url('${swatchUrl}')`;
      valueEl.appendChild(swatch);
    }
    valueEl.appendChild(document.createTextNode(value));
    const children = [labelEl, valueEl];
    if (uplift) children.push(this.el('span', 'c-co-lab-cart-bundle__row-uplift', uplift));
    return this.el('p', 'c-co-lab-cart-bundle__row', children);
  }

  renderReviewInto(container) {
    container.textContent = '';

    const card = this.el('c-co-lab-cart-bundle', 'c-co-lab-cart-bundle');

    const header = this.el('header', 'c-co-lab-cart-bundle__header', [
      this.el('h2', 'c-co-lab-cart-bundle__title', this.productTitle),
      this.el('p', 'c-co-lab-cart-bundle__base-price', this.formatMoney(this.basePrice)),
    ]);
    card.appendChild(header);

    // Metal, Sizing and Quantity
    const isDefaultVariant = !this.selectedVariant || this.selectedVariant.title === 'Default Title';
    const optionValues = this.selectedVariant?.options || [];
    const qty = Math.max(1, parseInt(this.querySelector('input[name="quantity"]')?.value, 10) || 1);
    const metalRows = [];
    if (!isDefaultVariant) {
      this.productOptions.forEach((name, i) => {
        if (optionValues[i]) metalRows.push(this.reviewRow(name, optionValues[i]));
      });
    }
    metalRows.push(this.reviewRow('Quantity', String(qty)));
    card.appendChild(this.el('section', 'c-co-lab-cart-bundle__group', [
      this.el('h3', 'c-co-lab-cart-bundle__group-title', 'Metal, Sizing and Quantity'),
      ...metalRows,
    ]));

    // Customisation
    const customRows = [];
    this.stoneSlots().forEach((slot) => {
      if (!this.hasStone(slot)) return;
      const value = this.stoneValue(slot);
      customRows.push(this.reviewRow('Birthstone', value, this.stoneSwatchUrl(value), this.bsCharged ? `+ ${this.formatMoney(this.bsPrice)}` : 'Free'));
    });
    if (this.hasEngraving()) {
      customRows.push(this.reviewRow('Engraving', this.engravingInput.value.trim(), '', this.engCharged ? `+ ${this.formatMoney(this.engPrice)}` : 'Free'));
    }
    if (customRows.length) {
      const group = this.el('section', 'c-co-lab-cart-bundle__group', [
        this.el('h3', 'c-co-lab-cart-bundle__group-title', 'Customisation'),
        ...customRows,
      ]);
      card.appendChild(group);
    }

    card.appendChild(this.el('p', 'c-co-lab-cart-bundle__total', this.formatMoney(this.computedTotal())));

    const modalError = this.el('p', 'c-co-lab-picker__error');
    modalError.setAttribute('data-modal-error', '');
    modalError.setAttribute('role', 'alert');
    modalError.setAttribute('aria-live', 'polite');
    modalError.hidden = true;
    card.appendChild(modalError);
    this.modalErrorEl = modalError;

    // Actions
    const backBtn = this.el('button', 'c-co-lab-cart-bundle__action c-co-lab-cart-bundle__action--secondary', '← Edit');
    backBtn.type = 'button';
    const confirmBtn = this.el('button', 'c-co-lab-cart-bundle__action c-co-lab-cart-bundle__action--primary', 'Checkout →');
    confirmBtn.type = 'button';
    card.appendChild(this.el('div', 'c-co-lab-cart-bundle__actions', [backBtn, confirmBtn]));

    confirmBtn.addEventListener('click', () => this.confirmAndAdd(confirmBtn));
    backBtn.addEventListener('click', () => this.closeModal());

    container.appendChild(card);
  }

  closeModal() {
    const modal = document.getElementById(this.dataset.reviewModalId);
    if (modal) modal.hide ? modal.hide() : modal.removeAttribute('open');
  }

  // --- Phase B: build the bundle, add to cart, open the drawer ---------------

  async confirmAndAdd(confirmBtn) {
    this.clearModalError();

    if (!this.variantSelected()) {
      this.showModalError('Please choose a size before adding to cart.');
      return;
    }

    const bundleId = (crypto.randomUUID && crypto.randomUUID()) || `bundle-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const qty = Math.max(1, parseInt(this.querySelector('input[name="quantity"]')?.value, 10) || 1);
    const items = [];

    // Parent: the ring. Human-readable customisation properties always ride on
    // the parent line (so they print on the order) regardless of whether the
    // extras are charged.
    const parentProps = { _bundle_id: bundleId, _bundle_role: 'parent' };
    this.stoneSlots().forEach((slot) => {
      if (!this.hasStone(slot)) return;
      const input = this.querySelector(`[data-stone-input="${slot}"]`);
      parentProps[input.name.replace(/^properties\[|\]$/g, '')] = input.value;
    });
    if (this.hasEngraving()) parentProps['Engraving'] = this.engravingInput.value.trim();

    items.push({ id: parseInt(this.variantIdInput.value, 10), quantity: qty, properties: parentProps });

    // Charged add-on lines only. If an extra is "included" in the base price we
    // create no add-on line (and showed no uplift).
    const stoneCount = this.pickedStoneCount();
    if (this.bsCharged && stoneCount > 0) {
      const variantId = await this.resolveVariantId(this.dataset.birthstoneAddonHandle);
      if (!variantId) {
        this.showModalError("We couldn't add your birthstones right now. Please refresh and try again, or contact us if this persists.");
        return;
      }
      items.push({ id: variantId, quantity: stoneCount * qty, properties: { _bundle_id: bundleId, _bundle_role: 'birthstone' } });
    }
    if (this.engCharged && this.hasEngraving()) {
      const variantId = await this.resolveVariantId(this.dataset.engravingAddonHandle);
      if (!variantId) {
        this.showModalError("We couldn't add your engraving right now. Please refresh and try again, or contact us if this persists.");
        return;
      }
      items.push({ id: variantId, quantity: qty, properties: { _bundle_id: bundleId, _bundle_role: 'engraving' } });
    }

    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.setAttribute('aria-busy', 'true');
    }

    try {
      // Ask the theme which sections want re-rendering after the add (the cart
      // drawer registers itself here), so we can hand them to /cart/add.js and
      // then to the drawer's cart:change listener.
      const sectionsToBundle = [];
      document.documentElement.dispatchEvent(new CustomEvent('cart:prepare-bundled-sections', {
        bubbles: true,
        detail: { sections: sectionsToBundle },
      }));

      const root = window.Shopify.routes.root;
      const res = await fetch(`${root}cart/add.js`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          items,
          sections: sectionsToBundle.join(','),
          sections_url: window.location.pathname,
        }),
      });
      if (!res.ok) {
        const payload = await this.safeJson(res);
        throw new CartAddError(res.status, payload);
      }
      await res.json();

      // Fewer steps for a bespoke item: once the bundle is in the cart, take the
      // customer straight to checkout (skips the cart drawer). Only reached on success.
      window.location.assign(`${root}checkout`);
    } catch (err) {
      console.error('[co-lab-picker] add to cart failed', err);
      this.showModalError(this.friendlyErrorMessage(err));
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.removeAttribute('aria-busy');
      }
    }
  }

  async safeJson(response) {
    try { return await response.json(); } catch { return null; }
  }

  /**
   * Map an add-to-cart failure to customer-friendly copy.
   */
  friendlyErrorMessage(err) {
    if (err instanceof TypeError) {
      return "We couldn't reach the store. Check your connection and try again.";
    }
    if (err instanceof CartAddError) {
      const { status, payload } = err;
      const msg = (payload && (payload.description || payload.message)) || '';
      if (status === 422) {
        if (/sold out|not available|unavailable/i.test(msg)) {
          return 'Sorry, this size has just sold out. Please choose another size.';
        }
        if (/quantity/i.test(msg)) {
          return 'There is a per-order limit on this product. Please reduce the quantity.';
        }
        return msg || "We couldn't add this to your cart. Please try again.";
      }
      if (status === 429) {
        return 'Too many requests right now — please wait a moment and try again.';
      }
      if (status >= 500) {
        return 'The store is having a moment. Please try again in a few seconds.';
      }
      return msg || "Something went wrong adding this to your cart.";
    }
    return "Something went wrong adding this to your cart. Please try again.";
  }

  showError(message) {
    if (!this.errorEl) return;
    this.errorEl.textContent = message;
    this.errorEl.hidden = false;
  }

  clearError() {
    if (!this.errorEl) return;
    this.errorEl.textContent = '';
    this.errorEl.hidden = true;
  }

  showModalError(message) {
    if (!this.modalErrorEl) return;
    this.modalErrorEl.textContent = message;
    this.modalErrorEl.hidden = false;
  }

  clearModalError() {
    if (!this.modalErrorEl) return;
    this.modalErrorEl.textContent = '';
    this.modalErrorEl.hidden = true;
  }

  async resolveVariantId(handle) {
    if (!handle) return null;
    if (!this._variantCache) this._variantCache = {};
    if (this._variantCache[handle]) return this._variantCache[handle];
    try {
      const res = await fetch(`${window.Shopify.routes.root}products/${handle}.js`);
      if (!res.ok) return null;
      const data = await res.json();
      const id = data.variants?.[0]?.id;
      if (id) this._variantCache[handle] = id;
      return id || null;
    } catch {
      return null;
    }
  }
}

class CartAddError extends Error {
  constructor(status, payload) {
    super(`Cart add failed (${status})`);
    this.status = status;
    this.payload = payload;
  }
}

customElements.define('c-co-lab-picker', CoLabPicker);
