class CoLabPicker extends HTMLElement {
  connectedCallback() {
    this.state = 'default';
    this.activeSlot = null;
    this.basePriceCents = parseInt(this.dataset.basePrice, 10) || 0;
    this.birthstonePriceCents = parseInt(this.dataset.birthstonePrice, 10) || 1000;
    this.engravingPriceCents = parseInt(this.dataset.engravingPrice, 10) || 2000;
    this.moneyFormat = this.dataset.moneyformat || '£{{amount}}';

    this.form = this.querySelector('form[action*="/cart/add"]');
    this.stonesToggle = this.querySelector('[data-action="toggle-stones"]');
    this.stonesEl = this.querySelector('[data-stones]');
    this.gridEl = this.querySelector('[data-grid]');
    this.customisationEl = this.querySelector('[data-customisation]');
    this.reviewEl = this.querySelector('[data-review]');
    this.editBtn = this.querySelector('[data-action="edit"]');
    this.submitBtn = this.querySelector('[data-action="submit"]');
    this.totalEl = this.querySelector('[data-total]');
    this.basePriceDisplay = this.querySelector('[data-base-price-display]');
    this.confirmCheckbox = this.querySelector('[data-confirm-checkbox]');
    this.engravingInput = this.querySelector('[data-engraving-input]');
    this.engravingCount = this.querySelector('[data-engraving-count]');
    this.variantIdInput = this.querySelector('[data-variant-id]');

    this.bindEvents();
    this.refresh();
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

    this.editBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      this.goToCustomising();
    });

    this.engravingInput?.addEventListener('input', () => this.onEngravingChange());
    this.confirmCheckbox?.addEventListener('change', () => this.refresh());

    document.addEventListener('variant:change', (e) => {
      if (e.detail?.variant?.id && this.variantIdInput) {
        this.variantIdInput.value = e.detail.variant.id;
        if (e.detail.variant.price != null) {
          this.basePriceCents = e.detail.variant.price;
          if (this.basePriceDisplay) this.basePriceDisplay.textContent = this.formatMoney(this.basePriceCents);
          this.refresh();
        }
      }
    });

    this.form?.addEventListener('submit', (e) => this.onSubmit(e));
  }

  toggleStones() {
    const expanded = this.stonesToggle.getAttribute('aria-expanded') === 'true';
    this.stonesToggle.setAttribute('aria-expanded', String(!expanded));
    this.stonesEl.hidden = expanded;
    if (this.engravingInput) this.engravingInput.disabled = expanded;
    this.state = expanded ? 'default' : 'customising';
    this.closeGrid();
    this.syncStoneInputs();
    this.refresh();
  }

  openGrid(slot) {
    this.activeSlot = slot;
    this.gridEl.hidden = false;
    this.gridEl.dataset.activeSlot = slot;
    this.gridEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  closeGrid() {
    if (!this.gridEl) return;
    this.gridEl.hidden = true;
    this.gridEl.dataset.activeSlot = '';
    this.activeSlot = null;
  }

  pickStone({ handle, name, month, icon }) {
    if (!this.activeSlot) return;
    const slot = this.activeSlot;
    const input = this.querySelector(`[data-stone-input="${slot}"]`);
    const text = this.querySelector(`[data-stone-text="${slot}"]`);
    const swatch = this.querySelector(`[data-stone-swatch="${slot}"]`);

    input.value = `${name}${month ? ' - ' + month : ''}`;
    input.dataset.handle = handle;
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
    this.engravingCount.textContent = `${value.length}/12 Characters`;
    this.refresh();
  }

  syncStoneInputs() {
    // disable stone inputs when stones aren't picked so they don't post empty properties
    this.querySelectorAll('[data-stone-input]').forEach((input) => {
      input.disabled = !input.value;
    });
  }

  hasStone(slot) {
    const input = this.querySelector(`[data-stone-input="${slot}"]`);
    return !!(input && input.value);
  }

  hasEngraving() {
    return !!(this.engravingInput && this.engravingInput.value.trim());
  }

  variantSelected() {
    return !!(this.variantIdInput && this.variantIdInput.value);
  }

  totalCents() {
    let total = this.basePriceCents;
    if (this.hasStone(1)) total += this.birthstonePriceCents;
    if (this.hasStone(2)) total += this.birthstonePriceCents;
    if (this.hasEngraving()) total += this.engravingPriceCents;
    return total;
  }

  goToReview() {
    this.state = 'reviewing';
    this.customisationEl.hidden = true;
    this.reviewEl.hidden = false;
    this.editBtn.hidden = false;

    ['1', '2'].forEach((slot) => {
      const row = this.querySelector(`[data-summary-row="stone-${slot}"]`);
      const input = this.querySelector(`[data-stone-input="${slot}"]`);
      if (input.value) {
        row.hidden = false;
        this.querySelector(`[data-summary-text="${slot}"]`).textContent = input.value;
        const sourceSwatch = this.querySelector(`[data-stone-swatch="${slot}"]`);
        const targetSwatch = this.querySelector(`[data-summary-swatch="${slot}"]`);
        targetSwatch.style.backgroundImage = sourceSwatch.style.backgroundImage;
      } else {
        row.hidden = true;
      }
    });

    const engRow = this.querySelector('[data-summary-row="engraving"]');
    if (this.hasEngraving()) {
      engRow.hidden = false;
      this.querySelector('[data-summary-engraving]').textContent = this.engravingInput.value;
    } else {
      engRow.hidden = true;
    }

    this.refresh();
  }

  goToCustomising() {
    this.state = 'customising';
    this.reviewEl.hidden = true;
    this.customisationEl.hidden = false;
    this.editBtn.hidden = true;
    if (this.confirmCheckbox) this.confirmCheckbox.checked = false;
    this.refresh();
  }

  refresh() {
    if (this.totalEl) this.totalEl.textContent = this.formatMoney(this.totalCents());
    this.syncStoneInputs();

    if (this.state === 'reviewing') {
      this.submitBtn.disabled = !this.confirmCheckbox?.checked;
    } else {
      this.submitBtn.disabled = !this.variantSelected();
    }
  }

  async onSubmit(event) {
    event.preventDefault();

    if (this.state !== 'reviewing') {
      this.goToReview();
      return;
    }

    if (!this.confirmCheckbox?.checked) return;

    const bundleId = (crypto.randomUUID && crypto.randomUUID()) || `bundle-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const items = [];

    // Parent: the ring
    const parentProps = { _bundle_id: bundleId, _bundle_role: 'parent' };
    if (this.hasStone(1)) parentProps['Birthstone One'] = this.querySelector('[data-stone-input="1"]').value;
    if (this.hasStone(2)) parentProps['Birthstone Two'] = this.querySelector('[data-stone-input="2"]').value;
    if (this.hasEngraving()) parentProps['Engraving'] = this.engravingInput.value.trim();

    items.push({ id: parseInt(this.variantIdInput.value, 10), quantity: 1, properties: parentProps });

    // Children: add-ons
    const stoneCount = (this.hasStone(1) ? 1 : 0) + (this.hasStone(2) ? 1 : 0);
    if (stoneCount > 0) {
      const variantId = await this.resolveVariantId(this.dataset.birthstoneAddonHandle);
      if (variantId) {
        items.push({ id: variantId, quantity: stoneCount, properties: { _bundle_id: bundleId, _bundle_role: 'birthstone' } });
      }
    }
    if (this.hasEngraving()) {
      const variantId = await this.resolveVariantId(this.dataset.engravingAddonHandle);
      if (variantId) {
        items.push({ id: variantId, quantity: 1, properties: { _bundle_id: bundleId, _bundle_role: 'engraving' } });
      }
    }

    this.submitBtn.disabled = true;
    try {
      const res = await fetch(`${window.Shopify.routes.root}cart/add.js`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) throw new Error(await res.text());
      document.dispatchEvent(new CustomEvent('cart:change', { detail: { source: 'co-lab-picker' } }));
      document.dispatchEvent(new CustomEvent('variant:add', { detail: { source: 'co-lab-picker' } }));
    } catch (err) {
      console.error('[co-lab-picker] add to cart failed', err);
      this.submitBtn.disabled = false;
    }
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

  formatMoney(cents) {
    const fmt = this.moneyFormat;
    const amount = (cents / 100);
    const withZeros = (n) => n.toFixed(2);
    const noZeros = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
    return fmt
      .replace(/\{\{\s*amount\s*\}\}/g, withZeros(amount))
      .replace(/\{\{\s*amount_no_decimals\s*\}\}/g, String(Math.round(amount)))
      .replace(/\{\{\s*amount_with_comma_separator\s*\}\}/g, withZeros(amount).replace('.', ','))
      .replace(/\{\{\s*amount_no_decimals_with_comma_separator\s*\}\}/g, String(Math.round(amount)))
      .replace(/\{\{\s*amount_no_decimals_with_space_separator\s*\}\}/g, String(Math.round(amount)))
      .replace(/\{\{\s*amount_with_space_separator\s*\}\}/g, withZeros(amount))
      .replace(/\{\{\s*amount_with_apostrophe_separator\s*\}\}/g, withZeros(amount))
      .replace(/\{\{\s*amount_no_decimals_with_dot_separator\s*\}\}/g, String(Math.round(amount)))
      .replace(/\{\{\s*amount_without_trailing_zeros\s*\}\}/g, noZeros(amount));
  }
}

customElements.define('c-co-lab-picker', CoLabPicker);
