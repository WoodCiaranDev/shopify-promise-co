(() => {
  const SIZES = { slide: [400, 700, 1000, 1600], thumb: [56, 112, 168], compact: [480, 700, 1000] };
  const DISPLAY = { slide: 1000, thumb: 168, compact: 1000 };

  class CoLabStonePreview extends HTMLElement {
    connectedCallback() {
      this.config = this.parse();
      if (!this.config) return;
      this.base = this.dataset.base;
      // One version token for the whole set: all combinations are rebuilt and uploaded together,
      // so this busts the browser/CDN cache whenever the images are replaced.
      this.q = this.dataset.version ? `?v=${this.dataset.version}&` : '?';
      this.state = {
        metal: this.dataset.metal || 'gold',
        centre: this.dataset.centre || 'may',
        halo: this.dataset.halo || 'april',
      };
      this.generation = 0;
      this.onChange = this.onChange.bind(this);
      document.addEventListener('colab:change', this.onChange);

      const picker = document.querySelector('c-co-lab-picker');
      if (picker && typeof picker.emitChange === 'function') picker.emitChange();
    }

    disconnectedCallback() {
      document.removeEventListener('colab:change', this.onChange);
    }

    parse() {
      try { return JSON.parse(this.querySelector('[data-preview-config]').textContent); }
      catch { return null; }
    }

    metalKey(name) {
      if (!name) return null;
      return this.config.metals[name] || (/silver/i.test(name) ? 'silver' : 'gold');
    }

    stoneKey(name) {
      if (!name) return null;
      if (this.config.stones[name]) return this.config.stones[name];
      const hit = Object.keys(this.config.stones).find((k) => k.toLowerCase() === String(name).toLowerCase());
      return hit ? this.config.stones[hit] : null;
    }

    onChange(event) {
      const { metal, slots } = event.detail || {};
      const picked = Object.values(slots || {});
      const metalKey = this.metalKey(metal);
      const centre = this.stoneKey(picked[0]);
      const halo = this.stoneKey(picked[1]);
      if (metalKey) this.state.metal = metalKey;
      if (centre) this.state.centre = centre;
      if (halo) this.state.halo = halo;
      this.render();
    }

    url(role) {
      const { metal, centre, halo } = this.state;
      return `${this.base}colab-heirloom-${metal}-${centre}-${halo}.jpg${this.q}width=${DISPLAY[role] || 1000}`;
    }

    srcset(role) {
      const { metal, centre, halo } = this.state;
      const file = `${this.base}colab-heirloom-${metal}-${centre}-${halo}.jpg`;
      return (SIZES[role] || SIZES.slide).map((w) => `${file}${this.q}width=${w} ${w}w`).join(', ');
    }

    async render() {
      const token = ++this.generation;
      const targets = document.querySelectorAll('[data-colab-preview-img]');
      if (!targets.length) return;

      // Decode the largest variant once, then apply everywhere. The previous frame
      // stays on screen until it is ready, so a fast tap-through never flashes.
      const probe = new Image();
      probe.src = this.url('slide');
      probe.srcset = this.srcset('slide');
      probe.sizes = '1000px';
      try { await probe.decode(); } catch { /* fall through and swap anyway */ }
      if (token !== this.generation) return;

      targets.forEach((img) => {
        const role = img.dataset.colabRole || 'slide';
        img.srcset = this.srcset(role);
        img.src = this.url(role);
      });

      const caption = this.captionText();
      document.querySelectorAll('[data-colab-preview-caption]').forEach((el) => { el.textContent = caption; });
      document.querySelectorAll('[data-colab-preview-img]').forEach((img) => {
        if (img.dataset.colabRole !== 'thumb') img.alt = caption || img.alt;
      });
    }

    captionText() {
      const c = this.config.labels[this.state.centre];
      const h = this.config.labels[this.state.halo];
      return c && h ? `${c} centre stone, ${h} halo` : '';
    }
  }

  if (!customElements.get('co-lab-stone-preview')) {
    customElements.define('co-lab-stone-preview', CoLabStonePreview);
  }
})();
