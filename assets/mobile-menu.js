/**
 * Clean Mobile Menu Component
 * Uses BEM naming convention: o-mobile-menu
 */
class MobileMenu extends HTMLElement {
  constructor() {
    super();
    this.currentPanel = 'main';
    this.panelHistory = [];
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.initializePanels();
    this.initializeCountdown();
  }

  setupEventListeners() {
    // Menu toggle button
    this.addEventListener('click', this.handleClick.bind(this));
    
    // Close button
    const closeBtn = this.querySelector('.o-mobile-menu__close');
    if (closeBtn) {
      closeBtn.addEventListener('click', this.close.bind(this));
    }

    // Back buttons
    this.addEventListener('click', (e) => {
      if (e.target.closest('.o-mobile-menu__back')) {
        e.preventDefault();
        this.goBack();
      }
    });

    // Overlay click to close
    const overlay = this.querySelector('.o-mobile-menu__overlay');
    if (overlay) {
      overlay.addEventListener('click', this.close.bind(this));
    }

    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        this.close();
      }
    });
  }

  handleClick(e) {
    const button = e.target.closest('.o-mobile-menu__nav-link[data-panel]');
    if (button) {
      e.preventDefault();
      const panelId = button.getAttribute('data-panel');
      this.openPanel(panelId);
    }
  }

  initializePanels() {
    // Set initial panel states
    const mainPanel = this.querySelector('[data-panel-level="main"]');
    if (mainPanel) {
      mainPanel.classList.add('is-top', 'is-active');
    }

    // Hide secondary and tertiary panels initially
    const secondaryPanels = this.querySelectorAll('[data-panel-level="secondary"]');
    secondaryPanels.forEach(panel => {
      panel.classList.add('is-secondary');
    });

    const tertiaryPanels = this.querySelectorAll('[data-panel-level="tertiary"]');
    tertiaryPanels.forEach(panel => {
      panel.classList.add('is-tertiary');
    });
  }

  openPanel(panelId) {
    const targetPanel = this.querySelector(`[data-panel-id="${panelId}"]`);
    const currentPanel = this.querySelector('.o-mobile-menu__panel:not([style*="display: none"])');
    
    if (!targetPanel || targetPanel === currentPanel) return;

    // Add to history for back navigation
    if (currentPanel) {
      this.panelHistory.push(currentPanel.getAttribute('data-panel-id') || 'main');
    }

    // Animate transition
    this.transitionToPanel(currentPanel, targetPanel);
  }

  transitionToPanel(fromPanel, toPanel) {
    // Slide out current panel
    if (fromPanel) {
      fromPanel.style.transform = 'translateX(-100%)';
      fromPanel.style.opacity = '0';
      
      setTimeout(() => {
        fromPanel.style.display = 'none';
        fromPanel.style.transform = '';
        fromPanel.style.opacity = '';
      }, 300);
    }

    // Slide in new panel
    toPanel.style.display = 'block';
    toPanel.style.transform = 'translateX(100%)';
    toPanel.style.opacity = '0';
    
    setTimeout(() => {
      toPanel.style.transform = 'translateX(0)';
      toPanel.style.opacity = '1';
    }, 50);

    // Update panel classes
    this.updatePanelClasses(toPanel);
  }

  updatePanelClasses(activePanel) {
    const allPanels = this.querySelectorAll('.o-mobile-menu__panel');
    allPanels.forEach(panel => {
      panel.classList.remove('is-active');
    });
    activePanel.classList.add('is-active');
  }

  goBack() {
    if (this.panelHistory.length === 0) {
      this.close();
      return;
    }

    const previousPanelId = this.panelHistory.pop();
    const previousPanel = this.querySelector(`[data-panel-id="${previousPanelId}"]`) || 
                         this.querySelector('.o-mobile-menu__panel[data-panel-level="main"]');
    const currentPanel = this.querySelector('.o-mobile-menu__panel:not([style*="display: none"])');

    this.transitionToPanel(currentPanel, previousPanel);
  }

  open() {
    this.classList.add('is-open');
    document.body.classList.add('mobile-menu-open');
    
    // Reset to main panel
    this.panelHistory = [];
    const mainPanel = this.querySelector('.o-mobile-menu__panel[data-panel-level="main"]');
    if (mainPanel) {
      this.showPanel(mainPanel);
    }

    // Trigger open animation
    setTimeout(() => {
      this.classList.add('is-visible');
    }, 10);
  }

  close() {
    this.classList.remove('is-visible');
    
    setTimeout(() => {
      this.classList.remove('is-open');
      document.body.classList.remove('mobile-menu-open');
      
      // Reset all panels
      this.resetPanels();
    }, 300);
  }

  resetPanels() {
    const panels = this.querySelectorAll('.o-mobile-menu__panel');
    panels.forEach((panel, index) => {
      panel.style.display = index === 0 ? 'block' : 'none';
      panel.style.transform = '';
      panel.style.opacity = '';
      panel.classList.remove('is-active');
    });
    
    this.panelHistory = [];
  }

  showPanel(panel) {
    const allPanels = this.querySelectorAll('.o-mobile-menu__panel');
    allPanels.forEach(p => {
      p.style.display = 'none';
    });
    panel.style.display = 'block';
    this.updatePanelClasses(panel);
  }

  isOpen() {
    return this.classList.contains('is-open');
  }

  toggle() {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  initializeCountdown() {
    const countdownEl = this.querySelector('[data-countdown-date]');
    if (!countdownEl) return;

    const targetDate = new Date(countdownEl.dataset.countdownDate);
    
    const updateCountdown = () => {
      const now = new Date();
      const diff = targetDate - now;

      if (diff <= 0) {
        // Countdown finished
        countdownEl.querySelectorAll('[data-months]').forEach(el => el.textContent = '00');
        countdownEl.querySelectorAll('[data-days]').forEach(el => el.textContent = '00');
        countdownEl.querySelectorAll('[data-hours]').forEach(el => el.textContent = '00');
        countdownEl.querySelectorAll('[data-minutes]').forEach(el => el.textContent = '00');
        countdownEl.querySelectorAll('[data-seconds]').forEach(el => el.textContent = '00');
        return;
      }

      // Calculate time units
      const months = Math.floor(diff / (1000 * 60 * 60 * 24 * 30));
      const days = Math.floor((diff % (1000 * 60 * 60 * 24 * 30)) / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      // Update DOM
      countdownEl.querySelectorAll('[data-months]').forEach(el => el.textContent = String(months).padStart(2, '0'));
      countdownEl.querySelectorAll('[data-days]').forEach(el => el.textContent = String(days).padStart(2, '0'));
      countdownEl.querySelectorAll('[data-hours]').forEach(el => el.textContent = String(hours).padStart(2, '0'));
      countdownEl.querySelectorAll('[data-minutes]').forEach(el => el.textContent = String(minutes).padStart(2, '0'));
      countdownEl.querySelectorAll('[data-seconds]').forEach(el => el.textContent = String(seconds).padStart(2, '0'));
    };

    // Update immediately and then every second
    updateCountdown();
    this.countdownInterval = setInterval(updateCountdown, 1000);
  }

  disconnectedCallback() {
    // Clean up interval when element is removed
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }
}

// Register the custom element
if (!window.customElements.get('mobile-menu')) {
  window.customElements.define('mobile-menu', MobileMenu);
}

// Global mobile menu controller
class MobileMenuController {
  constructor() {
    this.init();
  }

  init() {
    // Find mobile menu toggle button
    const toggleButton = document.querySelector('[aria-controls="mobile-menu"]');
    const mobileMenu = document.getElementById('mobile-menu');

    if (toggleButton && mobileMenu) {
      toggleButton.addEventListener('click', (e) => {
        e.preventDefault();
        mobileMenu.toggle();
      });
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new MobileMenuController();
  });
} else {
  new MobileMenuController();
}