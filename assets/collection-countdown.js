/**
 * Collection Countdown Component
 * Handles countdown timers for both mobile menu and mega menu
 */
class CollectionCountdown {
  constructor() {
    this.countdowns = [];
    this.init();
  }

  init() {
    // Find all countdown elements
    const countdownElements = document.querySelectorAll('[data-countdown-date]');
    
    countdownElements.forEach(element => {
      this.initializeCountdown(element);
    });
  }

  initializeCountdown(countdownEl) {
    const targetDate = new Date(countdownEl.dataset.countdownDate);
    
    const updateCountdown = () => {
      const now = new Date();
      const diff = targetDate - now;

      if (diff <= 0) {
        // Countdown finished
        this.setCountdownValues(countdownEl, 0, 0, 0, 0, 0);
        return;
      }

      // Calculate time units
      const months = Math.floor(diff / (1000 * 60 * 60 * 24 * 30));
      const days = Math.floor((diff % (1000 * 60 * 60 * 24 * 30)) / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      // Update DOM
      this.setCountdownValues(countdownEl, months, days, hours, minutes, seconds);
    };

    // Update immediately and then every second
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    
    // Store interval reference for cleanup
    this.countdowns.push({ element: countdownEl, interval });
  }

  setCountdownValues(countdownEl, months, days, hours, minutes, seconds) {
    countdownEl.querySelectorAll('[data-months]').forEach(el => el.textContent = String(months).padStart(2, '0'));
    countdownEl.querySelectorAll('[data-days]').forEach(el => el.textContent = String(days).padStart(2, '0'));
    countdownEl.querySelectorAll('[data-hours]').forEach(el => el.textContent = String(hours).padStart(2, '0'));
    countdownEl.querySelectorAll('[data-minutes]').forEach(el => el.textContent = String(minutes).padStart(2, '0'));
    countdownEl.querySelectorAll('[data-seconds]').forEach(el => el.textContent = String(seconds).padStart(2, '0'));
  }

  destroy() {
    // Clean up all intervals
    this.countdowns.forEach(({ interval }) => {
      clearInterval(interval);
    });
    this.countdowns = [];
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new CollectionCountdown();
  });
} else {
  new CollectionCountdown();
}