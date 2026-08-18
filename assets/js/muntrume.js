/**
 * 🏁 Muntrume Motorsport - Core Theme & Navigation Framework
 * High-performance, synchronized Dark/Light mode engine & UI controller.
 */

(function () {
  'use strict';

  const SUN_SVG = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>';
  const MOON_SVG = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>';

  function getPreferredTheme() {
    const saved = localStorage.getItem('muntrume_theme') || localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function updateIcons(theme) {
    const iconContent = theme === 'dark' ? SUN_SVG : MOON_SVG;
    
    // Target all icon instances
    const targets = document.querySelectorAll('.theme-icon, #themeIcon, [data-theme-icon], .theme-toggle-btn svg, .theme-toggle svg');
    targets.forEach(el => {
      if (el.tagName && el.tagName.toLowerCase() === 'svg') {
        el.innerHTML = iconContent;
      } else {
        const svg = el.querySelector('svg');
        if (svg) {
          svg.innerHTML = iconContent;
        } else {
          el.innerHTML = `<svg class="w-5 h-5 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">${iconContent}</svg>`;
        }
      }
    });
  }

  function applyTheme(theme) {
    const isDark = theme === 'dark';
    
    // Set both HTML and Body attributes & Tailwind compatibility classes
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.toggle('dark', isDark);
    if (document.body) {
      document.body.setAttribute('data-theme', theme);
      document.body.classList.toggle('dark', isDark);
    }
    
    // Persist under both legacy and unified storage keys
    localStorage.setItem('muntrume_theme', theme);
    localStorage.setItem('theme', theme);

    // Update UI icons
    updateIcons(theme);
  }

  window.applyTheme = applyTheme;
  window.updateThemeIcon = updateIcons;

  window.toggleTheme = function () {
    const current = document.documentElement.getAttribute('data-theme') || (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  };

  // OS theme synchronization listener
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      if (!localStorage.getItem('muntrume_theme') && !localStorage.getItem('theme')) {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    });
  }

  // Instant execution before DOM render to eliminate flicker
  const initialTheme = getPreferredTheme();
  document.documentElement.setAttribute('data-theme', initialTheme);
  document.documentElement.classList.toggle('dark', initialTheme === 'dark');

  // DOM ready execution
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => applyTheme(getPreferredTheme()));
  } else {
    applyTheme(getPreferredTheme());
  }

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

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      window.closeMobileMenu();
    }
  });

})();
