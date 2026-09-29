(() => {
  const WIDTHS = { slide: [400, 700, 1000, 1600], thumb: [56, 112, 168], compact: [400, 700, 1000, 1600] };
  const DISPLAY = { slide: 1000, thumb: 168, compact: 1000 };
  const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const METALS = ['gold', 'silver'];

  class CoLabStonePreview extends HTMLElement {
    connectedCallback() {
      this.config = this.parse();
      if (!this.config) return;
      this.base = this.dataset.base;
      this.q = this.dataset.version ? `?v=${this.dataset.version}&` : '?';
      this.state = {
        metal: this.dataset.metal || 'gold',
        centre: this.dataset.centre || 'october',
        halo: this.dataset.halo || 'june',
      };
      this.shownKey = this.key();
      this.supported = true;
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
      const key = this.config.metals[name];
      return METALS.includes(key) ? key : false;
    }

    stoneKey(name) {
      if (!name) return null;
      let key = this.config.stones[name];
      if (!key) {
        const hit = Object.keys(this.config.stones).find((k) => k.toLowerCase() === String(name).toLowerCase());
        key = hit && this.config.stones[hit];
      }
      return MONTHS.includes(key) ? key : false;
    }

    key() {
      const { metal, centre, halo } = this.state;
      return `${metal}-${centre}-${halo}`;
    }

    onChange(event) {
      const { metal, slots } = event.detail || {};
      const picked = Object.values(slots || {});
      const next = { metal: this.metalKey(metal), centre: this.stoneKey(picked[0]), halo: this.stoneKey(picked[1]) };
      this.supported = !Object.values(next).includes(false);
      if (!this.supported) return;
      Object.entries(next).forEach(([k, v]) => { if (v) this.state[k] = v; });
      if (this.key() === this.shownKey && !this.pending) return;
      this.render();
    }

    url(role) {
      return `${this.base}colab-heirloom-${this.key()}.jpg${this.q}width=${DISPLAY[role] || 1000}`;
    }

    srcset(role) {
      const file = `${this.base}colab-heirloom-${this.key()}.jpg`;
      return (WIDTHS[role] || WIDTHS.slide).map((w) => `${file}${this.q}width=${w} ${w}w`).join(', ');
    }

    reviewImageSrc() {
      if (!this.supported || this.failedKey === this.key()) return null;
      return this.url('slide').replace(/width=\d+/, 'width=900');
    }

    setBusy(busy) {
      document.querySelectorAll('.co-lab-stone-preview__plate').forEach((el) => {
        el.classList.toggle('is-loading', busy);
        el.setAttribute('aria-busy', busy ? 'true' : 'false');
      });
    }

    async render() {
      const token = ++this.generation;
      const key = this.key();
      const targets = [...document.querySelectorAll('[data-colab-preview-img]')];
      if (!targets.length) return;

      this.pending = true;
      this.setBusy(true);
      const probes = targets.filter((img) => img.dataset.colabRole !== 'thumb').map((img) => {
        const probe = new Image();
        probe.sizes = img.sizes;
        probe.srcset = this.srcset(img.dataset.colabRole || 'slide');
        probe.src = this.url(img.dataset.colabRole || 'slide');
        return probe.decode();
      });
      const loaded = await Promise.all(probes).then(() => true, () => false);
      if (token !== this.generation) return;
      this.pending = false;
      this.setBusy(false);
      if (!loaded) { this.failedKey = key; return; }

      targets.forEach((img) => {
        const role = img.dataset.colabRole || 'slide';
        img.srcset = this.srcset(role);
        img.src = this.url(role);
        if (role !== 'thumb') img.alt = this.captionText() || img.alt;
      });
      this.shownKey = key;
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
