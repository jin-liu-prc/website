(() => {
  'use strict';

  const preferenceKey = 'jinliu.analytics.exclude';
  const loader = document.currentScript;
  const preferences = document.querySelector('[data-analytics-preferences]');
  let excluded = false;
  let storageAvailable = true;

  try {
    excluded = localStorage.getItem(preferenceKey) === '1';
  } catch (_) {
    storageAvailable = false;
    excluded = true;
  }

  if (preferences) {
    const status = preferences.querySelector('[data-analytics-status]');
    const excludeButton = preferences.querySelector('[data-analytics-exclude]');
    const countButton = preferences.querySelector('[data-analytics-count]');

    const showPreference = () => {
      status.textContent = excluded
        ? 'Your visits are excluded in this browser.'
        : 'Your visits are included in this browser.';
      excludeButton.disabled = excluded;
      countButton.disabled = !excluded;
    };

    const savePreference = (exclude) => {
      try {
        if (exclude) localStorage.setItem(preferenceKey, '1');
        else localStorage.removeItem(preferenceKey);
        excluded = exclude;
        showPreference();
      } catch (_) {
        status.textContent = 'Your browser could not save this preference. Allow site storage and try again.';
      }
    };

    excludeButton.addEventListener('click', () => savePreference(true));
    countButton.addEventListener('click', () => savePreference(false));
    if (storageAvailable) showPreference();
    else status.textContent = 'Your browser could not read this preference. Allow site storage and try again.';
    return;
  }

  if (excluded) return;

  const cityEndpoint = loader && loader.getAttribute('data-city-endpoint');
  if (cityEndpoint) {
    try {
      fetch(cityEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'pageview',
        credentials: 'omit',
        keepalive: true,
        referrerPolicy: 'no-referrer'
      }).catch(() => {});
    } catch (_) {
      // Collection is optional; unavailable networking must not affect the page.
    }
  }

  const beacon = loader && loader.getAttribute('data-cf-beacon');
  if (!beacon) return;

  const script = document.createElement('script');
  script.type = 'module';
  script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  script.setAttribute('data-cf-beacon', beacon);
  document.body.appendChild(script);
})();
