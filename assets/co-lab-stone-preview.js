(() => {
  class CoLabStonePreview extends HTMLElement {
    connectedCallback() {
      this.config = this.parseConfig();
      this.centreEl = this.querySelector('[data-layer="centre"]');
      this.haloEl = this.querySelector('[data-layer="halo"]');
      this.captionEl = this.querySelector('[data-preview-caption]');
      if (!this.config || !this.centreEl || !this.haloEl) return;

      this.state = {
        metal: this.dataset.defaultMetal || '',
        centre: this.dataset.defaultCentre || '',
        halo: this.dataset.defaultHalo || '',
      };
      this.onPickerChange = this.onPickerChange.bind(this);
      document.addEventListener('colab:change', this.onPickerChange);
      this.render();

      const picker = document.querySelector('c-co-lab-picker');
      if (picker && typeof picker.emitChange === 'function') picker.emitChange();
    }

    disconnectedCallback() {
      document.removeEventListener('colab:change', this.onPickerChange);
    }

    parseConfig() {
      const el = this.querySelector('[data-preview-config]');
      try { return JSON.parse(el.textContent); } catch { return null; }
    }

    metalKey(name) {
      if (!name) return null;
      const exact = this.config.metals[name];
      if (exact) return exact;
      return /silver/i.test(name) ? 'silver' : 'gold';
    }

    stoneKey(name) {
      if (!name) return null;
      const entry = this.config.stones[name];
      if (entry) return entry.key;
      const match = Object.keys(this.config.stones).find(
        (k) => k.toLowerCase() === String(name).toLowerCase()
      );
      return match ? this.config.stones[match].key : null;
    }

    onPickerChange(event) {
      const { metal, slots } = event.detail || {};
      const values = Object.values(slots || {});
      const centre = this.stoneKey(values[0]);
      const halo = this.stoneKey(values[1]);
      if (metal) this.state.metal = metal;
      if (centre) this.state.centre = centre;
      if (halo) this.state.halo = halo;
      this.render();
    }

    urlsFor(metalKey, stoneKey) {
      const set = this.config.urls[metalKey];
      return set ? set[stoneKey] : null;
    }

    async render() {
      const mk = this.metalKey(this.state.metal) || 'gold';
      const centre = this.urlsFor(mk, this.state.centre);
      const halo = this.urlsFor(mk, this.state.halo);
      if (!centre || !halo) return;

      // Decode before swapping so the ring never flashes an empty setting.
      const next = [centre.centre, halo.halo];
      const [a, b] = await Promise.all(next.map((src) => this.decoded(src)));
      if (a) this.centreEl.src = a;
      if (b) this.haloEl.src = b;
      this.setAttribute('data-ready', 'true');
      if (this.captionEl) this.captionEl.textContent = this.caption();
      this.warm(mk);
    }

    decoded(src) {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(src);
        img.onerror = () => resolve(null);
        img.src = src;
      });
    }

    caption() {
      const name = (key) => {
        const hit = Object.entries(this.config.stones).find(([, v]) => v.key === key);
        return hit ? hit[0] : '';
      };
      const c = name(this.state.centre);
      const h = name(this.state.halo);
      if (!c && !h) return '';
      return `${c} centre stone, ${h} halo`;
    }

    warm(metalKey) {
      if (this.warmed === metalKey || !('requestIdleCallback' in window)) return;
      this.warmed = metalKey;
      requestIdleCallback(() => {
        Object.values(this.config.urls[metalKey] || {}).forEach((u) => {
          new Image().src = u.centre;
          new Image().src = u.halo;
        });
      });
    }
  }

  if (!customElements.get('co-lab-stone-preview')) {
    customElements.define('co-lab-stone-preview', CoLabStonePreview);
  }
})();
