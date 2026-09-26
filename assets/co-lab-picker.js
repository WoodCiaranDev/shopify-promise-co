class CoLabPicker extends HTMLElement {
  connectedCallback() {
    if (this._connected) return;
    this._connected = true;
    this.activeSlot = null;

    // Customise slide-out (heirloom ring only): stones + engraving live in a drawer that stays
    // inside this element and its form, so every scoped lookup below still finds them.
    this.drawer = this.dataset.customiseDrawerId ? document.getElementById(this.dataset.customiseDrawerId) : null;
    this.summaryEl = this.querySelector('[data-customise-summary]');
    this.confirmPriceEl = this.querySelector('[data-confirm-price]');
    this.quantityInput = this.querySelector('input[name="quantity"]');

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
        // Drawer tiles carry their own slot (one full grid per slot); the shared grid uses activeSlot.
        if (btn.dataset.slot) this.activeSlot = btn.dataset.slot;
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

    this.querySelector('[data-action="confirm-customise"]')?.addEventListener('click', () => this.confirmCustomise());
    this.quantityInput?.addEventListener('input', () => this.refresh());
    this.quantityInput?.addEventListener('change', () => this.refresh());
    // The quantity +/- buttons set the value programmatically; re-read after any click in the buy row.
    this.querySelector('.c-co-lab-picker__buy')?.addEventListener('click', () => requestAnimationFrame(() => this.refresh()));

    if (this.drawer) {
      // Esc with the stone grid open closes the grid, not the whole drawer. The theme's focus
      // trap listens on document (capture), so intercept earlier, on window.
      this.onDrawerKeydown = (e) => {
        if (e.key !== 'Escape' || !this.drawer.open || this.activeSlot == null) return;
        e.stopImmediatePropagation();
        e.preventDefault();
        this.closeGrid();
      };
      window.addEventListener('keydown', this.onDrawerKeydown, true);
      this.drawer.addEventListener('dialog:after-hide', () => this.closeGrid());
      this.setupPreviewZoom();
      this.watchBottomBars();
    }

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
      if (this.drawer?.open) this.drawer.hide();
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
    if (this.onDrawerKeydown) window.removeEventListener('keydown', this.onDrawerKeydown, true);
    this._connected = false;
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
    if (this.activeSlot == null && !this.drawer) {
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
    if (!this.gridEl) {
      this.activeSlot = null;
      return;
    }
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
    if (text) text.textContent = this.drawer ? `${name}${month ? ' · ' + month : ''}` : input.value;
    if (swatch) {
      if (icon) {
        swatch.hidden = false;
        swatch.style.backgroundImage = `url(${icon})`;
      } else {
        swatch.hidden = true;
      }
    }
    this.querySelectorAll(`.c-co-lab-customise__cell[data-slot="${slot}"]`).forEach((cell) => {
      const on = cell.dataset.name === name;
      cell.classList.toggle('is-selected', on);
      cell.setAttribute('aria-pressed', String(on));
    });
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
    this.updateCustomiseUi();
    // Keep the add-to-cart solid/enabled like a normal product. onSubmit() validates
    // metal/size and shows an inline error if anything's missing - no faded button.
    this.emitChange();
  }

  emitChange() {
    const slots = {};
    this.stoneSlots().forEach((slot) => {
      const value = this.stoneValue(slot);
      slots[slot] = value ? value.split(' - ')[0].trim() : '';
    });
    this.dispatchEvent(new CustomEvent('colab:change', {
      bubbles: true,
      detail: { metal: this.selectedMetal, size: this.selectedSize, slots },
    }));
  }

  // --- Phase A: open the review modal (no cart mutation yet) -----------------

  onSubmit(event) {
    event.preventDefault();
    // The form is wrapped in the theme's <product-form>, whose own submit handler
    // would fire its own /cart/add with only the parent variant — missing our
    // add-on lines and bundle properties. Suppress it.
    event.stopImmediatePropagation();
    // With the Customise drawer, submitting (e.g. Enter in the engraving box) goes through the
    // same path as the Confirm button so the review never opens on top of the drawer.
    if (this.drawer) {
      this.confirmCustomise();
      return;
    }
    this.openReview();
  }

  // Shopify's theme-preview bar (#PBarNextFrameWrapper, only on ?preview_theme_id links) is a
  // fixed strip over the bottom of the screen that would cover the drawer's Confirm button.
  // Measure it live (it is injected late and can be hidden) and expose its height as
  // --colab-bottom-bar so the drawer stops above it. Customers never get the bar, so it's 0 for them.
  watchBottomBars() {
    const root = document.documentElement;
    const update = () => {
      const bar = document.getElementById('PBarNextFrameWrapper');
      let h = 0;
      if (bar) {
        const r = bar.getBoundingClientRect();
        const visible = getComputedStyle(bar).display !== 'none' && r.height > 0 && r.top < window.innerHeight;
        if (visible) h = Math.max(0, Math.round(window.innerHeight - r.top));
      }
      root.style.setProperty('--colab-bottom-bar', h + 'px');
    };
    let ro = null;
    const attach = () => {
      const bar = document.getElementById('PBarNextFrameWrapper');
      if (!bar || bar === this._barEl) return;
      this._barEl = bar;
      ro?.disconnect();
      if ('ResizeObserver' in window) { ro = new ResizeObserver(update); ro.observe(bar); }
      new MutationObserver(update).observe(bar, { attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
    };
    new MutationObserver(() => { attach(); update(); }).observe(document.body, { childList: true });
    window.addEventListener('resize', update);
    this.drawer.addEventListener('dialog:before-show', update);
    attach(); update();

    // iOS keyboard: Safari scrolls/insets the visual viewport instead of resizing the layout one,
    // which can leave the fixed panel's bottom (Confirm) under the keyboard. While the drawer is
    // open, pin the panel to the visual viewport; clear it again on close.
    const vv = window.visualViewport;
    if (!vv) return;
    const base = () => this.drawer.shadowRoot?.querySelector('[part~="base"]');
    const sync = () => {
      const b = base(); if (!b || !this.drawer.open) return;
      const bar = parseFloat(getComputedStyle(root).getPropertyValue('--colab-bottom-bar')) || 0;
      const keyboardOpen = window.innerHeight - vv.height > 120;
      if (!keyboardOpen) { b.style.top = b.style.height = b.style.bottom = ''; return; }
      b.style.top = vv.offsetTop + 'px';
      b.style.bottom = 'auto';
      b.style.height = Math.max(200, vv.height - bar) + 'px';
    };
    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);
    this.drawer.addEventListener('dialog:after-show', sync);
    this.drawer.addEventListener('dialog:after-hide', () => { const b = base(); if (b) b.style.top = b.style.height = b.style.bottom = ''; });
  }

  // Tapping the preview in the Customise drawer opens the theme's native full-screen gallery
  // (PhotoSwipe) on the stone preview slide, on top of the drawer. While it is open the drawer's
  // focus trap is paused, otherwise clicks and Esc inside the viewer would close the drawer too.
  setupPreviewZoom() {
    const trigger = this.drawer.querySelector('.co-lab-stone-preview--compact');
    if (!trigger) return;
    trigger.setAttribute('role', 'button');
    trigger.setAttribute('tabindex', '0');
    trigger.setAttribute('aria-label', 'View larger image');
    trigger.addEventListener('click', () => this.openPreviewLightbox(trigger));
    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.openPreviewLightbox(trigger);
      }
    });
  }

  openPreviewLightbox(trigger) {
    const gallery = document.querySelector('product-gallery');
    const cell = gallery?.querySelector('[data-media-id="co-lab-stone-preview"]');
    if (!gallery || !cell || !gallery.carousel) return;
    const imageCells = gallery.carousel.cells.filter((c) => c.getAttribute('data-media-type') === 'image');
    const index = imageCells.indexOf(cell);
    if (index < 0) return;

    const trap = this.drawer.focusTrap;
    const lightBox = gallery.lightBox;
    trap?.pause?.();
    const resume = () => {
      lightBox.off?.('destroy', resume);
      trap?.unpause?.();
      trigger.focus({ preventScroll: true });
    };
    lightBox.on('destroy', resume);
    gallery.dispatchEvent(new CustomEvent('lightbox:open', { detail: { index } }));
  }

  // Resolve when a dialog finishes hiding, or after a short cap: the theme's promise waits on a
  // Web Animation, which never finishes if the tab is backgrounded mid-close.
  hideDialog(dialog) {
    if (!dialog?.open) return Promise.resolve();
    return Promise.race([dialog.hide(), new Promise((r) => setTimeout(r, 700))]);
  }

  async confirmCustomise() {
    await this.hideDialog(this.drawer);
    if (!this.openReview() && this.errorEl && !this.errorEl.hidden) {
      this.errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // Validate metal/size and open the review modal. Returns true when the modal opened.
  openReview() {
    this.clearError();
    // Validate against the live controls, not just whatever the last change event set —
    // a browser-restored size must pass too.
    this.syncSelectionsFromDom();

    if (this.metalRequired() && !this.selectedMetal) {
      this.showError('Please choose a metal before adding to cart.');
      return false;
    }
    if (!this.selectedSize) {
      this.showError('Please choose a size before adding to cart.');
      return false;
    }

    const modal = document.getElementById(this.dataset.reviewModalId);
    if (!modal) {
      // No modal in the DOM — fall back to adding straight away.
      this.confirmAndAdd();
      return true;
    }

    const body = modal.querySelector('[data-colab-review-body]');
    if (body) this.renderReviewInto(body);
    modal.show ? modal.show() : modal.setAttribute('open', '');
    return true;
  }

  quantity() {
    return Math.max(1, parseInt(this.quantityInput?.value, 10) || 1);
  }

  // Price for the whole line: per-ring total (base + charged extras) times quantity.
  lineTotalDisplay() {
    const qty = this.quantity();
    if (qty === 1 && !this.bsCharged && !this.engCharged) return this.basePriceDisplay();
    return this.formatMoney(this.computedTotal() * qty);
  }

  // Confirm price in the drawer and the one-line summary shown on the page.
  updateCustomiseUi() {
    if (!this.drawer) return;
    if (this.confirmPriceEl) this.confirmPriceEl.textContent = this.lineTotalDisplay();
    if (!this.summaryEl) return;
    const parts = [];
    this.stoneSlots().forEach((slot) => {
      if (!this.hasStone(slot)) return;
      const input = this.querySelector(`[data-stone-input="${slot}"]`);
      const name = this.stoneValue(slot).split(' - ')[0].trim();
      const label = (input?.dataset.stoneLabel || '').replace(/\s*stones?$/i, '').trim().toLowerCase();
      parts.push(label ? `${name} ${label}` : name);
    });
    if (this.hasEngraving()) parts.push(`Engraving: ${this.engravingInput.value.trim()}`);
    this.summaryEl.textContent = parts.length ? parts.join(' · ') : 'Choose your gemstones & engraving';
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
    const qty = this.quantity();
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
    const totalDisplay = this.lineTotalDisplay();
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
    card.appendChild(this.el('p', 'c-co-lab-picker__confirm-note', 'Your piece will be crafted exactly as confirmed above - made just for you and dispatched in 10 - 15 business days.'));

    // Actions
    const backBtn = this.el('button', 'c-co-lab-cart-bundle__action c-co-lab-cart-bundle__action--secondary', '← Edit');
    backBtn.type = 'button';
    const confirmBtn = this.el('button', 'c-co-lab-cart-bundle__action c-co-lab-cart-bundle__action--primary', 'Add to cart');
    confirmBtn.type = 'button';
    confirmBtn.disabled = true;
    card.appendChild(this.el('div', 'c-co-lab-cart-bundle__actions', [backBtn, confirmBtn]));

    confirmCheck.addEventListener('change', () => { confirmBtn.disabled = !confirmCheck.checked; });
    confirmBtn.addEventListener('click', () => this.confirmAndAdd(confirmBtn));
    backBtn.addEventListener('click', async () => {
      await this.hideDialog(document.getElementById(this.dataset.reviewModalId));
      if (this.drawer) this.drawer.show();
    });

    container.appendChild(card);
  }

  closeModal() {
    const modal = document.getElementById(this.dataset.reviewModalId);
    if (!modal) return Promise.resolve();
    if (modal.hide) return modal.hide();
    modal.removeAttribute('open');
    return Promise.resolve();
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
    const qty = this.quantity();
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
        this.submitting = false;
        return;
      }
      items.push({ id: variantId, quantity: stoneCount * qty, properties: { _bundle_id: bundleId, _bundle_role: 'birthstone' } });
    }
    if (this.engCharged && this.hasEngraving()) {
      const variantId = await this.resolveVariantId(this.dataset.engravingAddonHandle);
      if (!variantId) {
        this.showModalError("We couldn't add your engraving right now. Please refresh and try again, or contact us if this persists.");
        this.submitting = false;
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

// Theme drawer that stays where it is rendered instead of moving to <body> while open, so the
// stone and engraving inputs inside it remain part of the picker's product form.
customElements.whenDefined('x-drawer').then(() => {
  if (customElements.get('co-lab-customise-drawer')) return;
  const Drawer = customElements.get('x-drawer');
  customElements.define('co-lab-customise-drawer', class extends Drawer {
    get shouldAppendToBody() {
      return false;
    }
  });
});
