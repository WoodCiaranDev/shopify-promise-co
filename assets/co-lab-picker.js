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

    this.stonesDataEl = this.querySelector('[data-stones-json]');
    try {
      this.stonesData = JSON.parse(this.stonesDataEl?.textContent || '[]');
    } catch {
      this.stonesData = [];
    }

    this.bindEvents();
    this.refresh();
    this.maybePrefillFromCart();
  }

  /**
   * If the URL carries ?edit_bundle=<id>, look the matching bundle up in the
   * cart, populate the picker with the customer's previous selections, and
   * remove that bundle so the next Add to Cart creates a fresh one without
   * duplicating.
   */
  async maybePrefillFromCart() {
    const params = new URLSearchParams(window.location.search);
    const editId = params.get('edit_bundle');
    if (!editId) return;

    try {
      const cart = await fetch(`${window.Shopify.routes.root}cart.js`).then((r) => r.json());
      const parent = cart.items.find(
        (i) => i.properties?._bundle_id === editId && i.properties?._bundle_role === 'parent'
      );
      if (!parent) return;

      this.applyBundleProperties(parent.properties, parent.variant_id);
      await this.removeBundleLines(cart, editId);
    } catch (err) {
      console.warn('[co-lab-picker] prefill from cart failed', err);
    }
  }

  applyBundleProperties(properties, variantId) {
    // Open the customisation section first so its inputs are interactive.
    if (this.stonesToggle?.getAttribute('aria-expanded') !== 'true') {
      this.toggleStones();
    }

    // Variant — sync the hidden form input. The size-select web component
    // listens to its own select element; we update both to keep them in sync.
    if (variantId && this.variantIdInput) {
      this.variantIdInput.value = String(variantId);
      const sizeSelect = document.querySelector('[data-size-select]');
      if (sizeSelect) {
        const opt = [...sizeSelect.options].find((o) => o.value === String(variantId));
        if (opt) {
          sizeSelect.value = String(variantId);
          sizeSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    }

    // Stones — properties carry "Sapphire - September" style values.
    [['1', 'Birthstone One'], ['2', 'Birthstone Two']].forEach(([slot, key]) => {
      const value = properties[key];
      if (!value) return;
      const stoneName = value.split(' - ')[0].trim();
      const stone = this.stonesData.find((s) => s.name === stoneName);
      this.activeSlot = slot;
      this.pickStone({
        name: stone?.name || stoneName,
        month: stone?.month || (value.split(' - ')[1] || '').trim(),
        icon: stone?.icon || '',
      });
    });

    // Engraving
    if (properties.Engraving && this.engravingInput) {
      this.engravingInput.value = properties.Engraving;
      this.onEngravingChange();
    }
  }

  async removeBundleLines(cart, bundleId) {
    const keys = cart.items
      .filter((i) => i.properties?._bundle_id === bundleId)
      .map((i) => i.key);
    if (keys.length === 0) return;
    const updates = {};
    keys.forEach((k) => { updates[k] = 0; });
    await fetch(`${window.Shopify.routes.root}cart/update.js`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    });
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

    this.engravingInput?.addEventListener('input', () => this.onEngravingChange());

    document.addEventListener('variant:change', (e) => {
      if (e.detail?.variant?.id && this.variantIdInput) {
        this.variantIdInput.value = e.detail.variant.id;
        this.refresh();
      }
    });

    this.form?.addEventListener('submit', (e) => this.onSubmit(e));
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
    this.engravingCount.textContent = `${value.length}/12 Characters`;
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

  async onSubmit(event) {
    event.preventDefault();

    if (!this.variantSelected()) return;

    const bundleId = (crypto.randomUUID && crypto.randomUUID()) || `bundle-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const items = [];

    // Parent: the ring. We stash the product URL on a hidden property so the cart
    // page's "Edit My Order" link can return the customer to this PDP without
    // needing a server-side product lookup.
    const productUrl = this.dataset.productUrl || window.location.pathname;
    const parentProps = {
      _bundle_id: bundleId,
      _bundle_role: 'parent',
      _product_url: productUrl,
    };
    if (this.hasStone(1)) parentProps['Birthstone One'] = this.querySelector('[data-stone-input="1"]').value;
    if (this.hasStone(2)) parentProps['Birthstone Two'] = this.querySelector('[data-stone-input="2"]').value;
    if (this.hasEngraving()) parentProps['Engraving'] = this.engravingInput.value.trim();

    items.push({
      id: parseInt(this.variantIdInput.value, 10),
      quantity: 1,
      properties: parentProps,
    });

    const stoneCount = (this.hasStone(1) ? 1 : 0) + (this.hasStone(2) ? 1 : 0);
    if (stoneCount > 0) {
      const variantId = await this.resolveVariantId(this.dataset.birthstoneAddonHandle);
      if (variantId) {
        items.push({
          id: variantId,
          quantity: stoneCount,
          properties: { _bundle_id: bundleId, _bundle_role: 'birthstone' },
        });
      }
    }
    if (this.hasEngraving()) {
      const variantId = await this.resolveVariantId(this.dataset.engravingAddonHandle);
      if (variantId) {
        items.push({
          id: variantId,
          quantity: 1,
          properties: { _bundle_id: bundleId, _bundle_role: 'engraving' },
        });
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
      // Always go to the cart page — the review / confirm step lives there now.
      window.location.assign(`${window.Shopify.routes.root}cart`);
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
}

customElements.define('c-co-lab-picker', CoLabPicker);
