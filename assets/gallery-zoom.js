(() => {
  if (window.promiseGalleryZoom) return;
  window.promiseGalleryZoom = true;

  const IMAGE = '.product-gallery[inline-zoom] .product-gallery__media[data-media-type="image"] img';
  const HOVER_SCALE = 2;
  const SWIPE_ON_SCALE = 1.15;
  const EDGE_PULL = 60;
  const state = new WeakMap();

  const maxScale = (img) => parseFloat(img.closest('.product-gallery').getAttribute('inline-zoom')) || 3;
  const get = (img) => state.get(img) || { scale: 1, x: 0, y: 0 };

  const clamp = (img, s) => {
    const limitX = ((s.scale - 1) * img.offsetWidth) / 2;
    const limitY = ((s.scale - 1) * img.offsetHeight) / 2;
    return {
      x: Math.max(-limitX, Math.min(limitX, s.x)),
      y: Math.max(-limitY, Math.min(limitY, s.y)),
      overX: s.x > limitX ? s.x - limitX : s.x < -limitX ? s.x + limitX : 0,
    };
  };

  const apply = (img, s) => {
    const c = clamp(img, s);
    s.x = c.x;
    s.y = c.y;
    state.set(img, s);
    img.style.transform = s.scale > 1 ? `translate(${s.x}px, ${s.y}px) scale(${s.scale})` : '';
    img.closest('.product-gallery__media').classList.toggle('is-zoomed', s.scale > 1);
  };

  const reset = (img) => apply(img, { scale: 1, x: 0, y: 0 });

  const carouselOf = (img) => img.closest('.product-gallery').querySelector('.product-gallery__carousel');

  document.addEventListener('mousemove', (event) => {
    if (!matchMedia('(pointer: fine)').matches) return;
    const img = event.target.closest?.(IMAGE);
    if (!img) return;
    const rect = img.getBoundingClientRect();
    img.style.transformOrigin = `${((event.clientX - rect.left) / rect.width) * 100}% ${((event.clientY - rect.top) / rect.height) * 100}%`;
    img.style.transform = `scale(${HOVER_SCALE})`;
    img.closest('.product-gallery__media').classList.add('is-zoomed');
  });

  document.addEventListener('mouseout', (event) => {
    const img = event.target.closest?.(IMAGE);
    if (!img || img.contains(event.relatedTarget)) return;
    img.style.transform = '';
    img.style.transformOrigin = '';
    img.closest('.product-gallery__media').classList.remove('is-zoomed');
  });

  let gesture = null;
  let lastTap = 0;

  const distance = (touches) => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);

  document.addEventListener('touchstart', (event) => {
    const img = event.target.closest?.(IMAGE);
    if (!img) return;
    const s = get(img);
    if (event.touches.length === 2) {
      gesture = { img, type: 'pinch', startDistance: distance(event.touches), startScale: s.scale, startX: s.x, startY: s.y };
      event.preventDefault();
    } else if (event.touches.length === 1) {
      const touch = event.touches[0];
      gesture = { img, type: 'pan', startTouchX: touch.clientX, startTouchY: touch.clientY, startX: s.x, startY: s.y, overX: 0 };
    }
  }, { passive: false });

  document.addEventListener('touchmove', (event) => {
    if (!gesture) return;
    const { img } = gesture;
    const s = get(img);
    if (gesture.type === 'pinch' && event.touches.length === 2) {
      event.preventDefault();
      const scale = Math.max(1, Math.min(maxScale(img), gesture.startScale * (distance(event.touches) / gesture.startDistance)));
      apply(img, { scale, x: gesture.startX * (scale / gesture.startScale), y: gesture.startY * (scale / gesture.startScale) });
    } else if (gesture.type === 'pan' && event.touches.length === 1 && s.scale > SWIPE_ON_SCALE) {
      event.preventDefault();
      const touch = event.touches[0];
      const next = { scale: s.scale, x: gesture.startX + touch.clientX - gesture.startTouchX, y: gesture.startY + touch.clientY - gesture.startTouchY };
      gesture.overX = clamp(img, next).overX;
      apply(img, next);
    }
  }, { passive: false });

  document.addEventListener('touchend', (event) => {
    if (!gesture) return;
    const { img } = gesture;
    const s = get(img);

    if (gesture.type === 'pinch') {
      if (s.scale < SWIPE_ON_SCALE) reset(img);
      if (event.touches.length === 0) gesture = null;
      return;
    }

    const touch = event.changedTouches[0];
    const moved = Math.hypot(touch.clientX - gesture.startTouchX, touch.clientY - gesture.startTouchY);
    if (moved < 10) {
      const now = Date.now();
      if (now - lastTap < 300) {
        if (s.scale > 1) {
          reset(img);
        } else {
          const rect = img.getBoundingClientRect();
          const scale = Math.min(2.5, maxScale(img));
          apply(img, { scale, x: (rect.width / 2 - (touch.clientX - rect.left)) * (scale - 1), y: (rect.height / 2 - (touch.clientY - rect.top)) * (scale - 1) });
        }
        lastTap = 0;
      } else {
        lastTap = now;
      }
    } else if (s.scale > SWIPE_ON_SCALE && Math.abs(gesture.overX) > EDGE_PULL) {
      const carousel = carouselOf(img);
      const forward = gesture.overX < 0;
      reset(img);
      forward ? carousel.next?.() : carousel.previous?.();
    }
    gesture = null;
  });

  document.addEventListener('carousel:change', (event) => {
    event.target.querySelectorAll?.('.product-gallery__media.is-zoomed img').forEach(reset);
  }, true);
})();
