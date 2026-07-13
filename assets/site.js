(function () {
  const header = document.querySelector('.site-header');
  const nav = header?.querySelector('.site-nav');
  if (header && nav) {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'nav-toggle';
    toggle.setAttribute('aria-label', 'Toggle navigation');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.innerHTML = '<span aria-hidden="true">MENU</span>';
    header.querySelector('.site-header-inner')?.appendChild(toggle);
    toggle.addEventListener('click', function () {
      const open = header.dataset.menuOpen !== 'true';
      header.dataset.menuOpen = String(open);
      toggle.setAttribute('aria-expanded', String(open));
    });
    nav.addEventListener('click', function (event) {
      if (event.target.closest('a')) {
        header.dataset.menuOpen = 'false';
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const revealTargets = document.querySelectorAll('main > section, .feature, .truth-row, .download-card, .card');
  revealTargets.forEach(function (target, index) {
    target.style.setProperty('--reveal-delay', `${(index % 6) * 55}ms`);
  });

  if ('IntersectionObserver' in window && !reducedMotion) {
    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px' });
    revealTargets.forEach(function (target) {
      target.classList.add('reveal');
      observer.observe(target);
    });
  } else {
    revealTargets.forEach(function (target) { target.classList.add('is-visible'); });
  }

  if (header) {
    const syncHeader = function () { header.classList.toggle('is-scrolled', scrollY > 18); };
    syncHeader();
    addEventListener('scroll', syncHeader, { passive: true });
  }

  if ('IntersectionObserver' in window && nav) {
    const sectionLinks = new Map();
    nav.querySelectorAll('a[href*="#"]').forEach(function (link) {
      const hash = new URL(link.href, location.href).hash;
      if (hash) sectionLinks.set(hash.slice(1), link);
    });
    const trackedSections = Array.from(sectionLinks.keys()).map(function (id) {
      return document.getElementById(id);
    }).filter(Boolean);
    if (trackedSections.length) {
      const sectionObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          sectionLinks.forEach(function (link) { link.classList.remove('is-section-active'); });
          sectionLinks.get(entry.target.id)?.classList.add('is-section-active');
        });
      }, { rootMargin: '-32% 0px -58%', threshold: 0 });
      trackedSections.forEach(function (section) { sectionObserver.observe(section); });
    }
  }

  if (!reducedMotion && finePointer) {
    document.querySelectorAll('.feature, .download-card, .download-meta-card, .card, .stat').forEach(function (panel) {
      panel.addEventListener('pointermove', function (event) {
        const rect = panel.getBoundingClientRect();
        panel.style.setProperty('--pointer-x', `${event.clientX - rect.left}px`);
        panel.style.setProperty('--pointer-y', `${event.clientY - rect.top}px`);
      }, { passive: true });
    });
  }

  const portraitScreen = document.querySelector('[data-scroll-screen]');
  const portraitContent = portraitScreen?.querySelector('.portrait-scroll-content');
  if (portraitScreen && portraitContent) {
    let scrollFrame = 0;
    const syncPortraitScroll = function () {
      cancelAnimationFrame(scrollFrame);
      scrollFrame = requestAnimationFrame(function () {
        const landscapePhone = document.querySelector('.landscape-phone');
        const finishAt = landscapePhone
          ? landscapePhone.getBoundingClientRect().bottom + scrollY
          : portraitScreen.getBoundingClientRect().bottom + scrollY;
        const rawProgress = Math.max(0, Math.min(1, scrollY / Math.max(1, finishAt)));
        const progress = rawProgress * rawProgress * (3 - 2 * rawProgress);
        const travel = Math.max(0, portraitContent.scrollHeight - portraitScreen.clientHeight);
        portraitContent.style.setProperty('--portrait-scroll-y', `${-travel * progress}px`);
      });
    };
    syncPortraitScroll();
    addEventListener('scroll', syncPortraitScroll, { passive: true });
    addEventListener('resize', syncPortraitScroll, { passive: true });
    portraitContent.querySelector('img')?.addEventListener('load', syncPortraitScroll, { once: true });
  }

  const telemetryFields = {
    rpm: document.querySelectorAll('[data-telemetry="rpm"]'),
    boost: document.querySelectorAll('[data-telemetry="boost"]'),
    speed: document.querySelectorAll('[data-telemetry="speed"]'),
    maf: document.querySelectorAll('[data-telemetry="maf"]'),
    throttle: document.querySelectorAll('[data-telemetry="throttle"]'),
    boostUnit: document.querySelectorAll('[data-telemetry-unit="boost"]'),
    boostLabel: document.querySelectorAll('[data-telemetry-label="boost"]')
  };
  const pullState = document.querySelector('[data-pull-state]');
  const clusterRendererFrame = document.querySelector('[data-cluster-renderer]');
  let clusterRendererReady = false;
  const configureClusterRenderer = function () {
    if (!clusterRendererReady) return;
    clusterRendererFrame?.contentWindow?.postMessage({
      type: 'dashui:restore',
      payload: {
        activeRotation: 90,
        layout: 'performance', tach: 'arc',
        gauge1Sensor: 'boost', gauge2Sensor: 'rpm',
        gauge3Sensor: 'speed', gauge4Sensor: 'oil',
        unitSystem: 'standard',
        theme: '#20c56b', text: '#f2f4f7',
        gaugeGlowEnabled: true, gaugeGlowColor: '#22c55e',
        redline: 9000, maxRpm: 9000
      }
    }, '*');
  };
  addEventListener('message', function (event) {
    if (event.source !== clusterRendererFrame?.contentWindow || event.data?.type !== 'dashui:ready') return;
    clusterRendererReady = true;
    configureClusterRenderer();
  });
  const sparkBuffers = { rpm: [], speed: [], boost: [], maf: [], throttle: [] };
  let lastSparkSample = 0;
  if (telemetryFields.rpm.length && telemetryFields.boost.length && telemetryFields.speed.length) {
    const lerp = function (from, to, amount) { return from + (to - from) * amount; };
    const smooth = function (value) {
      const x = Math.max(0, Math.min(1, value));
      return x * x * (3 - 2 * x);
    };
    const boostForFirstGear = function (rpm) {
      if (rpm < 1800) return lerp(-4.91, -2.45, (rpm - 850) / 950);
      if (rpm < 3200) return lerp(-2.45, 0, (rpm - 1800) / 1400);
      if (rpm < 6200) return lerp(0, 24, smooth((rpm - 3200) / 3000));
      return 24;
    };
    const writeTelemetry = function (rpm, boost, speed, label) {
      telemetryFields.rpm.forEach(function (field) { field.textContent = String(Math.round(rpm)); });
      const inVacuum = boost < 0;
      const manifoldValue = inVacuum ? Math.abs(boost) * 2.036 : boost;
      const throttle = label === 'IDLE' ? 2 : label === 'SHIFT' ? 28 : 100;
      const maf = 5.6 + (rpm / 9000 * 205) + (Math.max(0, boost) / 24 * 190);
      telemetryFields.boost.forEach(function (field) { field.textContent = manifoldValue.toFixed(1); });
      telemetryFields.boostUnit.forEach(function (field) { field.textContent = inVacuum ? 'inHg' : 'psi'; });
      telemetryFields.boostLabel.forEach(function (field) { field.textContent = inVacuum ? 'VACUUM' : 'BOOST'; });
      telemetryFields.speed.forEach(function (field) { field.textContent = String(Math.round(speed)); });
      telemetryFields.maf.forEach(function (field) { field.textContent = maf.toFixed(1); });
      telemetryFields.throttle.forEach(function (field) { field.textContent = String(Math.round(throttle)); });
      if (pullState) pullState.textContent = label;
      if (clusterRendererReady) {
        clusterRendererFrame?.contentWindow?.postMessage({
          type: 'dashui:restore',
          payload: {
            rpm: rpm, redline: 9000, maxRpm: 9000,
            boost: boost / 0.145038, baro: 101,
            speed: speed / 0.621371, oilTemp: 82.8,
            throttle: throttle
          }
        }, '*');
      }

      const now = performance.now();
      if (now - lastSparkSample > 80) {
        lastSparkSample = now;
        const sparkValues = { rpm: rpm / 9000, speed: speed / 60, boost: inVacuum ? 0 : boost / 24, maf: maf / 400, throttle: throttle / 100 };
        Object.entries(sparkValues).forEach(function ([key, value]) {
          const buffer = sparkBuffers[key];
          buffer.push(Math.max(0, Math.min(1, value)));
          if (buffer.length > 34) buffer.shift();
          const points = buffer.map(function (entry, index) {
            const x = buffer.length === 1 ? 100 : index * 100 / (buffer.length - 1);
            return `${x.toFixed(1)},${(20 - entry * 18).toFixed(1)}`;
          }).join(' ');
          document.querySelector(`[data-spark="${key}"]`)?.setAttribute('points', points);
        });
      }
    };
    let pullFrame = 0;
    const syncPullToScroll = function () {
      cancelAnimationFrame(pullFrame);
      pullFrame = requestAnimationFrame(function () {
      const landscapePhone = document.querySelector('.landscape-phone');
      const finishAt = landscapePhone
        ? landscapePhone.getBoundingClientRect().bottom + scrollY
        : document.documentElement.scrollHeight;
      const pullProgress = Math.max(0, Math.min(1, scrollY / Math.max(1, finishAt)));
      let rpm = 850;
      let boost = -4.91;
      let speed = 0;
      let label = 'IDLE';

      if (pullProgress > 0 && pullProgress < 0.58) {
        const progress = smooth(pullProgress / 0.58);
        rpm = lerp(850, 9000, progress);
        speed = lerp(0, 42, progress);
        boost = boostForFirstGear(rpm);
        label = '1ST GEAR';
      } else if (pullProgress >= 0.58 && pullProgress < 0.64) {
        const progress = smooth((pullProgress - 0.58) / 0.06);
        rpm = lerp(9000, 6100, progress);
        boost = lerp(24, 6, progress);
        speed = lerp(42, 44, progress);
        label = 'SHIFT';
      } else if (pullProgress >= 0.64 && pullProgress < 1) {
        const progress = smooth((pullProgress - 0.64) / 0.36);
        rpm = lerp(6100, 9000, progress);
        boost = lerp(6, 24, smooth(Math.min(1, progress * 1.65)));
        speed = lerp(44, 60, progress);
        label = '2ND GEAR';
      } else if (pullProgress >= 1) {
        rpm = 9000;
        boost = 24;
        speed = 60;
        label = 'REDLINE';
      }

      writeTelemetry(rpm, boost, speed, label);
      });
    };
    syncPullToScroll();
    addEventListener('scroll', syncPullToScroll, { passive: true });
    addEventListener('resize', syncPullToScroll, { passive: true });
    addEventListener('message', function (event) {
      if (event.source === clusterRendererFrame?.contentWindow && event.data?.type === 'dashui:ready') {
        syncPullToScroll();
      }
    });
  }
})();
