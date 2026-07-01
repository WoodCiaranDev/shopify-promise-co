class CoLabPicker extends HTMLElement {
  connectedCallback() {
    this.activeSlot = null;

    this.form = this.querySelector('form[action*="/cart/add"]');
    this.stonesToggle = this.querySelector('[data-action="toggle-stones"]');
    this.stonesEl = this.querySelector('[data-stones]');
    this.gridEl = this.querySelector('[data-grid]');
    this.engravingToggle = this.querySelector('[data-action="toggle-engraving"]');
    this.engravingPanel = this.querySelector('[data-engraving]');
    this.submitBtn = this.querySelector('[data-action="submit"]');
    this.engravingInput = this.querySelector('[data-engraving-input]');
    this.engravingCount = this.querySelector('[data-engraving-count]');
    this.variantIdInput = this.querySelector('[data-variant-id]');
    this.errorEl = this.querySelector('[data-error]');
    this.customCard = this.querySelector('.c-co-lab-picker__card--custom');

    // Single-SKU model: metal & size are line-item properties, not variants.
    this.metalRadios = Array.from(this.querySelectorAll('input[data-metal-option]'));
    this.metalSelectedLabel = this.querySelector('[data-metal-selected]');
    this.sizeSelect = this.querySelector('[data-size-select]');
    this.selectedMetal = '';
    this.selectedSize = '';

    // Per-product pricing / slot configuration (defaults baked into the Liquid).
    // A price of 0 always means "included", regardless of the charged flag.
    this.bsPrice = parseInt(this.dataset.birthstonePrice, 10) || 0;
    this.engPrice = parseInt(this.dataset.engravingPrice, 10) || 0;
    this.bsCharged = this.dataset.birthstoneCharged === 'true' && this.bsPrice > 0;
    this.engCharged = this.dataset.engravingCharged === 'true' && this.engPrice > 0;
    this.basePrice = parseInt(this.dataset.basePrice, 10) || 0;
    // The Liquid `money` filter already renders in the customer's market/presentment
    // currency (e.g. $ on the USA market). Use that string for the base price/total so
    // the modal matches the rest of the site instead of the shop's base currency (£).
    this.basePriceFormatted = (this.querySelector('[data-base-price-display]')?.textContent || '').trim();
    this.productTitle = this.dataset.productTitle || '';

    this.stonesData = this.parseJson('[data-stones-json]', []);

    // The first metal is checked in the markup; sync state from whichever is checked.
    const checkedMetal = this.metalRadios.find((r) => r.checked) || this.metalRadios[0];
    if (checkedMetal) this.selectMetal(checkedMetal.value);

    if (this.sizeSelect && this.sizeSelect.value) this.selectSize(this.sizeSelect.value);

    this.bindEvents();
    this.refresh();
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
    this.engravingToggle?.addEventListener('click', () => this.toggleEngraving());

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

    this.metalRadios.forEach((radio) => {
      radio.addEventListener('change', () => this.selectMetal(radio.value));
    });

    this.sizeSelect?.addEventListener('change', () => {
      this.selectSize(this.sizeSelect.value);
    });

    this.form?.addEventListener('submit', (e) => this.onSubmit(e));

    // Browsers restore a remembered metal/size after navigating back without firing
    // change, so re-read the live controls on restore (and just after load) to keep
    // validation honest rather than relying solely on the change event.
    this.onPageShow = () => {
      // Returning via bfcache restores this element mid-flow: submitting still true (we set
      // it and navigated away on the previous add) and the review modal still open with an
      // unticked confirm. Reset the flag and close the modal so a returning customer starts
      // clean. Only touches a boolean + closes a dialog — no cart/line-item work.
      this.submitting = false;
      this.closeModal();
      this.syncSelectionsFromDom();
    };
    window.addEventListener('pageshow', this.onPageShow);
    requestAnimationFrame(() => this.syncSelectionsFromDom());
  }

  // Mirror whatever the metal radios / size select currently hold into state.
  syncSelectionsFromDom() {
    const checkedMetal = this.metalRadios.find((r) => r.checked);
    this.selectedMetal = checkedMetal ? checkedMetal.value : '';
    if (this.metalSelectedLabel && this.selectedMetal) {
      this.metalSelectedLabel.textContent = this.selectedMetal;
    }
    this.selectedSize = this.sizeSelect ? this.sizeSelect.value || '' : '';
  }

  disconnectedCallback() {
    if (this.onPageShow) window.removeEventListener('pageshow', this.onPageShow);
  }

  selectMetal(value) {
    this.selectedMetal = value || '';
    this.metalRadios.forEach((radio) => {
      if (radio.value === value) radio.checked = true;
    });
    if (this.metalSelectedLabel) this.metalSelectedLabel.textContent = this.selectedMetal;
    this.clearError();
    this.refresh();
  }

  selectSize(value) {
    this.selectedSize = value || '';
    this.clearError();
    this.refresh();
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
    this.closeGrid();
    this.syncStoneInputs();
    this.refresh();
  }

  // Engraving lives in its own collapsible tray (mirrors the birthstones tray).
  // The input is disabled while collapsed so an empty tray contributes nothing.
  toggleEngraving() {
    if (!this.engravingToggle || !this.engravingPanel) return;
    const expanded = this.engravingToggle.getAttribute('aria-expanded') === 'true';
    this.engravingToggle.setAttribute('aria-expanded', String(!expanded));
    this.engravingPanel.hidden = expanded;
    if (this.engravingInput) {
      this.engravingInput.disabled = expanded;
      if (!expanded) this.engravingInput.focus();
    }
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
    const input = this.engravingInput;
    const raw = input.value;
    // Allow mixed case, numbers and special characters. Strip only emojis and the
    // zero-width joiners / variation selectors / keycap combiners that build them.
    const cleaned = raw.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0000}-\u{E007F}]/gu, '');
    if (cleaned !== raw) {
      const removed = raw.length - cleaned.length;
      const caret = Math.max(0, (input.selectionStart || cleaned.length) - removed);
      input.value = cleaned;
      try { input.setSelectionRange(caret, caret); } catch (e) { /* unsupported input type */ }
      this.showError('Engravings can include numbers and special characters, but no emojis.');
    }
    const value = input.value;
    const max = input.maxLength > 0 ? input.maxLength : value.length;
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

  metalRequired() {
    return this.metalRadios.length > 0;
  }

  selectionComplete() {
    if (this.metalRequired() && !this.selectedMetal) return false;
    return !!this.selectedSize;
  }

  refresh() {
    this.syncStoneInputs();
    // Keep the add-to-cart solid/enabled like a normal product. onSubmit() validates
    // metal/size and shows an inline error if anything's missing - no faded button.
  }

  // --- Phase A: open the review modal (no cart mutation yet) -----------------

  onSubmit(event) {
    event.preventDefault();
    // The form is wrapped in the theme's <product-form>, whose own submit handler
    // would fire its own /cart/add with only the parent variant — missing our
    // add-on lines and bundle properties. Suppress it.
    event.stopImmediatePropagation();
    this.clearError();
    // Validate against the live controls, not just whatever the last change event set —
    // a browser-restored size must pass too.
    this.syncSelectionsFromDom();

    if (this.metalRequired() && !this.selectedMetal) {
      this.showError('Please choose a metal before adding to cart.');
      return;
    }
    if (!this.selectedSize) {
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

  // Base price / total as rendered by Liquid (correct market currency), falling back to
  // the JS formatter only if the hidden display span is missing.
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
      this.el('p', 'c-co-lab-cart-bundle__base-price', this.basePriceDisplay()),
    ]);
    card.appendChild(header);

    // Metal, Sizing and Quantity
    const qty = Math.max(1, parseInt(this.querySelector('input[name="quantity"]')?.value, 10) || 1);
    const metalRows = [];
    if (this.selectedMetal) metalRows.push(this.reviewRow('Precious Metal', this.selectedMetal));
    if (this.selectedSize) metalRows.push(this.reviewRow('Size', this.selectedSize));
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
      const input = this.querySelector(`[data-stone-input="${slot}"]`);
      const label = input?.dataset.stoneLabel || 'Birthstone';
      customRows.push(this.reviewRow(label, value, this.stoneSwatchUrl(value), this.bsCharged ? `+ ${this.formatMoney(this.bsPrice)}` : 'Free'));
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

    // With no charged add-ons the total equals the base price, so reuse the market-correct
    // Liquid string; only fall back to JS formatting when there are paid extras.
    const totalDisplay = (this.bsCharged || this.engCharged) ? this.formatMoney(this.computedTotal()) : this.basePriceDisplay();
    card.appendChild(this.el('p', 'c-co-lab-cart-bundle__total', totalDisplay));

    const modalError = this.el('p', 'c-co-lab-picker__error');
    modalError.setAttribute('data-modal-error', '');
    modalError.setAttribute('role', 'alert');
    modalError.setAttribute('aria-live', 'polite');
    modalError.hidden = true;
    card.appendChild(modalError);
    this.modalErrorEl = modalError;

    // Step 4 — explicit confirmation gate. The customer must tick this before the
    // made-to-order piece can go to checkout (it cannot be returned once in production).
    const confirmCheck = document.createElement('input');
    confirmCheck.type = 'checkbox';
    confirmCheck.id = `${this.dataset.reviewModalId}-confirm`;
    const confirmLabel = this.el('label', 'c-co-lab-picker__confirm');
    confirmLabel.htmlFor = confirmCheck.id;
    confirmLabel.appendChild(this.el('span', 'c-co-lab-picker__confirm-label', 'I confirm my selection is correct'));
    confirmLabel.appendChild(confirmCheck);
    card.appendChild(confirmLabel);
    card.appendChild(this.el('p', 'c-co-lab-picker__confirm-note', 'Your piece will be crafted exactly as confirmed above - made just for you and dispatched in 2-3 weeks.'));

    // Actions
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

  // --- Phase B: build the bundle, add to cart, open the drawer ---------------

  async confirmAndAdd(confirmBtn) {
    this.clearModalError();

    // In-flight guard: a second click during the async add could mint a second bundle and
    // duplicate the line, so ignore re-entry until the add settles (reset in finally paths).
    if (this.submitting) return;

    if (!this.selectionComplete()) {
      this.showModalError('Please choose a size before adding to cart.');
      return;
    }

    this.submitting = true;

    const bundleId = (crypto.randomUUID && crypto.randomUUID()) || `bundle-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const qty = Math.max(1, parseInt(this.querySelector('input[name="quantity"]')?.value, 10) || 1);
    const items = [];

    // Parent: the ring. Human-readable customisation properties always ride on
    // the parent line (so they print on the order) regardless of whether the
    // extras are charged.
    const parentProps = { _bundle_id: bundleId, _bundle_role: 'parent' };
    if (this.selectedMetal) parentProps['Precious Metal'] = this.selectedMetal;
    if (this.selectedSize) parentProps['Size'] = this.selectedSize;
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
      const data = await res.json();

      // Add to cart and open the side cart drawer (the theme's own way), staying on the
      // page rather than redirecting to checkout.
      await this.syncCartDrawer(root, data.sections);

      this.closeModal();
      this.submitting = false;
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.removeAttribute('aria-busy');
      }
    } catch (err) {
      console.error('[co-lab-picker] add to cart failed', err);
      this.submitting = false;
      this.showModalError(this.friendlyErrorMessage(err));
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.removeAttribute('aria-busy');
      }
    }
  }

  // Mirror the theme's own ProductForm add flow: dispatch a single cart:change carrying the
  // freshly rendered section HTML so the side cart drawer re-renders, updates the count, and
  // opens (force_open_drawer + variant:add). No cart:refresh, no DOM swap of our own — that
  // keeps the line-item remove/quantity controls intact.
  async syncCartDrawer(root, sections) {
    try {
      const cart = await (await fetch(`${root}cart.js`, { headers: { Accept: 'application/json' } })).json();
      cart.sections = sections;
      document.documentElement.dispatchEvent(new CustomEvent('cart:change', {
        bubbles: true,
        detail: { baseEvent: 'variant:add', onSuccessDo: 'force_open_drawer', cart },
      }));
    } catch (err) {
      console.error('[co-lab-picker] cart drawer update failed', err);
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
