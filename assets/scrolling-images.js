class ScrollingImages extends HTMLElement {
  connectedCallback() {
    if (this.track) return;

    this.track = this.querySelector('.scrolling-images__track');
    this.item = this.track?.firstElementChild;
    if (!this.item) return;

    this.offset = 0;
    this.itemWidth = 0;
    this.momentum = 0;
    this.hovered = false;
    this.dragging = false;
    this.inView = false;
    this.lastFrame = 0;
    this.direction = this.getAttribute('direction') === 'right' ? 1 : -1;
    this.pixelsPerSecond = 300 * (parseFloat(this.getAttribute('speed')) || 0.3);
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    this.tick = this.tick.bind(this);
    this.bindPointer();
    this.bindHover();

    this.resizeObserver = new ResizeObserver(() => this.measure());
    this.resizeObserver.observe(this);
    this.resizeObserver.observe(this.item);

    this.intersectionObserver = new IntersectionObserver(([entry]) => {
      this.inView = entry.isIntersecting;
      if (this.inView) this.start();
    }, { rootMargin: '200px' });
    this.intersectionObserver.observe(this);
  }

  disconnectedCallback() {
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    cancelAnimationFrame(this.frame);
  }

  measure() {
    this.itemWidth = this.item.getBoundingClientRect().width;
    if (!this.itemWidth) return;

    const copiesNeeded = Math.ceil(this.clientWidth / this.itemWidth) + 2;
    let copies = this.track.children.length;

    while (copies < copiesNeeded) {
      this.track.appendChild(this.createCopy());
      copies++;
    }

    this.render();
  }

  createCopy() {
    const copy = this.item.cloneNode(true);
    copy.setAttribute('aria-hidden', 'true');
    copy.querySelectorAll('a').forEach((link) => link.setAttribute('tabindex', '-1'));
    copy.querySelectorAll('img').forEach((image) => image.setAttribute('loading', 'eager'));
    return copy;
  }

  bindHover() {
    if (!this.hasAttribute('pause-on-hover') || !this.canHover) return;

    this.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'mouse') this.hovered = true;
    });
    this.addEventListener('pointerleave', (event) => {
      if (event.pointerType !== 'mouse') return;
      this.hovered = false;
      this.start();
    });
  }

  bindPointer() {
    let startX = 0;
    let startOffset = 0;
    let lastX = 0;
    let lastTime = 0;
    let velocity = 0;
    let pointerId = null;
    let moved = false;

    this.addEventListener('dragstart', (event) => event.preventDefault());

    this.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      pointerId = event.pointerId;
      startX = lastX = event.clientX;
      startOffset = this.offset;
      lastTime = event.timeStamp;
      velocity = 0;
      moved = false;
      this.momentum = 0;
      this.dragging = true;
    });

    this.addEventListener('pointermove', (event) => {
      if (!this.dragging || event.pointerId !== pointerId) return;

      const distance = event.clientX - startX;
      if (!moved && Math.abs(distance) > 6) {
        moved = true;
        try {
          this.setPointerCapture(pointerId);
        } catch {}
        this.classList.add('is-dragging');
      }
      if (!moved) return;

      const elapsed = Math.max(event.timeStamp - lastTime, 1);
      velocity = ((event.clientX - lastX) / elapsed) * 1000;
      lastX = event.clientX;
      lastTime = event.timeStamp;
      this.offset = startOffset + distance;
      this.render();
    });

    const release = (event) => {
      if (!this.dragging || event.pointerId !== pointerId) return;
      this.dragging = false;
      this.classList.remove('is-dragging');
      if (this.hasPointerCapture(pointerId)) this.releasePointerCapture(pointerId);
      if (moved && event.timeStamp - lastTime < 100) this.momentum = velocity;
      pointerId = null;
      this.start();
    };

    this.addEventListener('pointerup', release);
    this.addEventListener('pointercancel', release);

    this.addEventListener('click', (event) => {
      if (!moved) return;
      event.preventDefault();
      event.stopPropagation();
      moved = false;
    }, true);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastFrame = performance.now();
    this.frame = requestAnimationFrame(this.tick);
  }

  tick(now) {
    const seconds = Math.min((now - this.lastFrame) / 1000, 0.05);
    this.lastFrame = now;

    if (!this.dragging) {
      const autoSpeed = this.hovered || this.reducedMotion ? 0 : this.pixelsPerSecond * this.direction;
      this.offset += (autoSpeed + this.momentum) * seconds;
      this.momentum *= Math.pow(0.04, seconds);
      if (Math.abs(this.momentum) < 5) this.momentum = 0;
      this.render();
    }

    const idle = !this.dragging && !this.momentum && (this.hovered || this.reducedMotion);
    if (!this.inView || idle) {
      this.running = false;
      return;
    }

    this.frame = requestAnimationFrame(this.tick);
  }

  render() {
    if (!this.itemWidth) return;
    this.offset = ((this.offset % this.itemWidth) + this.itemWidth) % this.itemWidth;
    this.track.style.transform = `translate3d(${this.offset - this.itemWidth}px, 0, 0)`;
  }
}

if (!window.customElements.get('scrolling-images')) {
  window.customElements.define('scrolling-images', ScrollingImages);
}
