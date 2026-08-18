/**
 * 🏁 Muntrume Motorsport - Core Theme & Navigation Framework
 * Provides dark/light mode toggle, mobile navigation drawer, and UI utilities.
 */

(function () {
  'use strict';

  // ===== 🌙 THEME SYSTEM =====
  function getPreferredTheme() {
    const saved = localStorage.getItem('muntrume_theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('muntrume_theme', theme);

    // Update all theme toggle icons on page
    const icons = document.querySelectorAll('.theme-icon');
    icons.forEach(i => {
      if (theme === 'dark') {
        // Sun icon for dark mode
        i.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>';
      } else {
        // Moon icon for light mode
        i.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>';
      }
    });
  }

  window.toggleTheme = function () {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  };

  // Listen to OS theme changes if user hasn't explicitly set a preference
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!localStorage.getItem('muntrume_theme')) {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });

  // Apply theme immediately on load
  applyTheme(getPreferredTheme());

  // ===== 📱 MOBILE NAVIGATION DRAWER =====
  window.toggleMobileMenu = function () {
    const drawer = document.getElementById('mobileDrawer');
    const backdrop = document.getElementById('mobileBackdrop');
    if (!drawer || !backdrop) return;

    const isOpen = drawer.classList.contains('open');
    if (isOpen) {
      drawer.classList.remove('open');
      backdrop.classList.remove('open');
      document.body.style.overflow = '';
    } else {
      drawer.classList.add('open');
      backdrop.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  };

  window.closeMobileMenu = function () {
    const drawer = document.getElementById('mobileDrawer');
    const backdrop = document.getElementById('mobileBackdrop');
    if (drawer && backdrop) {
      drawer.classList.remove('open');
      backdrop.classList.remove('open');
      document.body.style.overflow = '';
    }
  };

  // Close drawer on Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      window.closeMobileMenu();
    }
  });

  // DOM ready initializations
  document.addEventListener('DOMContentLoaded', () => {
    applyTheme(getPreferredTheme());
  });

})();
