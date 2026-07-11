(() => {
  try {
    const enabled =
      new URLSearchParams(window.location.search).get('currencyHoverDebug') === '1' ||
      window.localStorage.getItem('currencyHoverDebug') === '1';
    if (enabled) {
      console.info('[Currency Hover:boot] content boot loaded', { url: window.location.href });
    }
  } catch {
    // Debug helper only.
  }
})();
