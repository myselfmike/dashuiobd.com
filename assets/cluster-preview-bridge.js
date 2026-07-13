(function () {
  window.addEventListener('message', function (event) {
    const message = event.data;
    if (!message || message.type !== 'dashui:restore') return;
    const payload = message.payload || {};
    const rotation = Number(payload.activeRotation);
    if (!payload.rotations && [0, 90, 180, 270].includes(rotation) && typeof window.activateRotation === 'function') {
      window.activateRotation(rotation);
    }
    window.DashUI?.restoreState(payload);
    if (payload.rotations && [0, 90, 180, 270].includes(rotation) && typeof window.activateRotation === 'function') {
      window.activateRotation(rotation);
    }
  });
  setTimeout(function () {
    window.parent.postMessage({ type: 'dashui:ready' }, '*');
  }, 250);
})();
