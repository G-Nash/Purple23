// ===== PERFORMANCE & STABILITY GUARDS =====

// 1. Wait for fonts before letting reveal animations + intro text fire,
//    so we don't see fallback fonts snap into the custom ones mid-animation.
//    Falls through after 1.5s if fonts API is unavailable / slow.
const fontsReady = ('fonts' in document)
  ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))])
  : Promise.resolve();

// 2. Detect slow devices / low-end hardware → trim particle counts
const isSlowDevice =
  (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
  (navigator.deviceMemory && navigator.deviceMemory <= 2) ||
  window.matchMedia('(max-width: 640px)').matches;

// 3. Pause expensive timers when tab is hidden (battery, jank on resume)
let intervalRegistry = [];
function registerInterval(fn, delay) {
  const id = setInterval(fn, delay);
  intervalRegistry.push({ id, fn, delay });
  return id;
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    intervalRegistry.forEach(item => { clearInterval(item.id); item.id = null; });
  } else {
    intervalRegistry.forEach(item => {
      if (item.id === null) item.id = setInterval(item.fn, item.delay);
    });
  }
});

// ===== INTRO OVERLAY =====
const intro = document.getElementById('intro');
const introStars = document.getElementById('introStars');
const introCta = document.getElementById('introCta');

// Sprinkle stars at random — fewer on slower devices
const STAR_COUNT = isSlowDevice ? 40 : 70;
for (let i = 0; i < STAR_COUNT; i++) {
  const s = document.createElement('div');
  s.className = 'intro-star';
  const size = 1 + Math.random() * 2.5;
  s.style.width = size + 'px';
  s.style.height = size + 'px';
  s.style.left = Math.random() * 100 + '%';
  s.style.top = Math.random() * 100 + '%';
  s.style.animationDelay = (Math.random() * 3) + 's';
  s.style.animationDuration = (1.5 + Math.random() * 2) + 's';
  introStars.appendChild(s);
}

// Falling petals in intro
const introPetalColors = ['#b89ec9', '#d9c4e6', '#d4a574', '#fbe8d8', '#f4c8c0', '#c8859b'];
function introPetalSVG(color) {
  return `<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 2 Q14 6 14 10 Q14 14 10 18 Q6 14 6 10 Q6 6 10 2 Z"
          fill="${color}" opacity="0.85"/>
  </svg>`;
}
function spawnIntroPetal() {
  if (intro.classList.contains('gone')) return;
  const p = document.createElement('div');
  p.className = 'intro-petal';
  // Every 3rd one is a heart instead of a petal
  const isHeart = Math.random() < 0.33;
  if (isHeart) {
    const heartShades = ['#b89ec9', '#d9c4e6', '#fbe8d8', '#f4c8c0'];
    const color = heartShades[Math.floor(Math.random() * heartShades.length)];
    p.innerHTML = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="${color}" opacity="0.85"/>
    </svg>`;
  } else {
    const color = introPetalColors[Math.floor(Math.random() * introPetalColors.length)];
    p.innerHTML = introPetalSVG(color);
  }
  const size = 10 + Math.random() * 16;
  p.style.width = size + 'px';
  p.style.height = size + 'px';
  p.style.left = Math.random() * 100 + '%';
  p.style.animationDuration = (6 + Math.random() * 5) + 's';
  introStars.appendChild(p);
  setTimeout(() => p.remove(), 11000);
}
// initial burst + ongoing
for (let i = 0; i < 8; i++) {
  setTimeout(spawnIntroPetal, i * 400);
}
const introPetalInterval = registerInterval(spawnIntroPetal, isSlowDevice ? 900 : 600);

// Dismiss intro
function dismissIntro() {
  intro.classList.add('gone');
  clearInterval(introPetalInterval);
  setTimeout(() => intro.remove(), 1500);
}
introCta.addEventListener('click', dismissIntro);

// Custom cursor
const cursor = document.getElementById('cursor');
if (window.matchMedia('(min-width: 641px)').matches) {
  document.addEventListener('mousemove', (e) => {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
  });
  document.addEventListener('mousedown', () => cursor.classList.add('expand'));
  document.addEventListener('mouseup', () => cursor.classList.remove('expand'));
}

// Intersection observer to reveal scenes
const scenes = document.querySelectorAll('.scene');
const dots = document.querySelectorAll('.progress .dot');

const io = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
      entry.target.classList.add('reveal');
      const idx = parseInt(entry.target.dataset.scene);
      dots.forEach((d, i) => d.classList.toggle('active', i === idx));
    }
  });
}, { threshold: [0.5] });

scenes.forEach(s => io.observe(s));

// Progress dot click navigation
dots.forEach(dot => {
  dot.addEventListener('click', () => {
    const idx = parseInt(dot.dataset.scene);
    scenes[idx].scrollIntoView({ behavior: 'smooth' });
  });
});

// ===== SLOW SMOOTH SNAP (all devices) =====
// Custom JS scroll for consistent slow, graceful section transitions
// on desktop (wheel) and mobile/tablet (swipe).
const isTouchDevice = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
const journey = document.getElementById('journey');

if (journey) {
  let scrollTimer = null;
  let isSnapping = false;

  // Custom smooth scroll with controllable duration & easing
  function smoothScrollTo(target, duration) {
    const start = journey.scrollTop;
    const change = target - start;
    if (Math.abs(change) < 1) return Promise.resolve();
    const startTime = performance.now();
    const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    return new Promise((resolve) => {
      function step(now) {
        const elapsed = now - startTime;
        const t = Math.min(elapsed / duration, 1);
        journey.scrollTop = start + change * ease(t);
        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          resolve();
        }
      }
      requestAnimationFrame(step);
    });
  }

  function snapToNearest() {
    if (isSnapping) return;
    const scrollTop = journey.scrollTop;
    const sceneHeight = journey.clientHeight;
    const nearestIdx = Math.round(scrollTop / sceneHeight);
    const targetY = nearestIdx * sceneHeight;
    if (Math.abs(scrollTop - targetY) < 2) return;
    isSnapping = true;
    smoothScrollTo(targetY, 1100).then(() => { isSnapping = false; });
  }

  function goToScene(idx) {
    if (isSnapping) return;
    const targetIdx = Math.max(0, Math.min(scenes.length - 1, idx));
    isSnapping = true;
    smoothScrollTo(targetIdx * journey.clientHeight, 1100).then(() => {
      isSnapping = false;
    });
  }

  // ----- DESKTOP: wheel handling -----
  if (!isTouchDevice) {
    let wheelLock = false;
    journey.addEventListener('wheel', (e) => {
      if (wheelLock) { e.preventDefault(); return; }
      if (Math.abs(e.deltaY) < 8) return;
      const dir = e.deltaY > 0 ? 1 : -1;
      const sceneHeight = journey.clientHeight;
      const currentIdx = Math.round(journey.scrollTop / sceneHeight);
      const targetIdx = Math.max(0, Math.min(scenes.length - 1, currentIdx + dir));
      if (targetIdx === currentIdx) return;
      e.preventDefault();
      wheelLock = true;
      goToScene(targetIdx);
      setTimeout(() => { wheelLock = false; }, 1200);
    }, { passive: false });
  }

  // ----- TOUCH: swipe handling -----
  if (isTouchDevice) {
    let touchStartY = 0;
    let touchStartTime = 0;
    let touchLock = false;

    journey.addEventListener('touchstart', (e) => {
      if (touchLock) return;
      touchStartY = e.touches[0].clientY;
      touchStartTime = performance.now();
    }, { passive: true });

    // Prevent native scroll - we control it
    journey.addEventListener('touchmove', (e) => {
      if (touchLock || isSnapping) {
        e.preventDefault();
      }
    }, { passive: false });

    journey.addEventListener('touchend', (e) => {
      if (touchLock || isSnapping) return;
      const touchEndY = e.changedTouches[0].clientY;
      const deltaY = touchStartY - touchEndY;
      const deltaTime = performance.now() - touchStartTime;
      // Threshold: 50px swipe OR a fast flick (60px in <300ms)
      const isSwipe = Math.abs(deltaY) > 50 || (Math.abs(deltaY) > 30 && deltaTime < 300);
      if (!isSwipe) return;

      const dir = deltaY > 0 ? 1 : -1;
      const sceneHeight = journey.clientHeight;
      const currentIdx = Math.round(journey.scrollTop / sceneHeight);
      const targetIdx = Math.max(0, Math.min(scenes.length - 1, currentIdx + dir));
      if (targetIdx === currentIdx) return;

      touchLock = true;
      goToScene(targetIdx);
      setTimeout(() => { touchLock = false; }, 1200);
    }, { passive: true });
  }

  // ----- Common: detect any other scroll motion (e.g. arrow keys, dragging
  // scroll edge) and snap back to the nearest section after a pause -----
  journey.addEventListener('scroll', () => {
    if (isSnapping) return;
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(snapToNearest, 180);
  }, { passive: true });

  // Override dot click to use the slow scroll
  document.querySelectorAll('.progress .dot').forEach(dot => {
    dot.addEventListener('click', (e) => {
      e.stopImmediatePropagation();
      const idx = parseInt(dot.dataset.scene);
      goToScene(idx);
    }, true);
  });
}

// Floating petals on click
const petalsLayer = document.getElementById('petals');
const petalColors = ['#b89ec9', '#d9c4e6', '#6b3f7a', '#d4a574', '#f4c8c0', '#c8859b'];

function makePetalSVG(color) {
  return `<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 2 Q14 6 14 10 Q14 14 10 18 Q6 14 6 10 Q6 6 10 2 Z"
          fill="${color}" opacity="0.85"/>
  </svg>`;
}

function spawnPetal(x, y) {
  // Safety cap — never let petals accumulate runaway
  if (petalsLayer.childElementCount > 80) return;
  const petal = document.createElement('div');
  petal.className = 'petal';
  const color = petalColors[Math.floor(Math.random() * petalColors.length)];
  petal.innerHTML = makePetalSVG(color);

  const size = 8 + Math.random() * 14;
  petal.style.width = size + 'px';
  petal.style.height = size + 'px';
  petal.style.left = x + 'px';
  petal.style.top = y + 'px';

  const drift = (Math.random() - 0.5) * 200;
  const duration = 2.5 + Math.random() * 2;
  petal.style.transition = `transform ${duration}s cubic-bezier(0.4, 0.2, 0.6, 1), opacity ${duration}s ease`;

  petalsLayer.appendChild(petal);

  requestAnimationFrame(() => {
    petal.style.transform = `translate(${drift}px, ${window.innerHeight - y + 100}px) rotate(${Math.random() * 720}deg)`;
    petal.style.opacity = '0';
  });

  setTimeout(() => petal.remove(), duration * 1000);
}

// Click anywhere → confetti burst of petals + hearts
// Throttle so rapid taps can't flood the page; skip on interactive elements
let lastBurst = 0;
document.addEventListener('click', (e) => {
  const now = performance.now();
  if (now - lastBurst < 120) return;            // throttle
  lastBurst = now;
  // Don't burst on interactive controls (CTA, dots)
  if (e.target.closest('button, .dot, a, input, textarea, select')) return;
  // Don't burst while intro is up — its own animation is enough
  if (intro && !intro.classList.contains('gone')) return;
  const burstSize = isSlowDevice ? 8 : 14;
  for (let i = 0; i < burstSize; i++) {
    setTimeout(() => {
      const offsetX = (Math.random() - 0.5) * 40;
      const offsetY = (Math.random() - 0.5) * 40;
      // every 4th one is a heart instead of a petal
      if (i % 4 === 0) {
        spawnHeartBurst(e.clientX + offsetX, e.clientY + offsetY);
      } else {
        spawnPetal(e.clientX + offsetX, e.clientY + offsetY);
      }
    }, i * 30);
  }
});

// Heart in the click burst — drifts up like a petal
function spawnHeartBurst(x, y) {
  const heart = document.createElement('div');
  heart.style.position = 'fixed';
  heart.style.pointerEvents = 'none';
  heart.style.zIndex = '100';
  heart.style.left = x + 'px';
  heart.style.top = y + 'px';
  const size = 12 + Math.random() * 10;
  heart.style.width = size + 'px';
  heart.style.height = size + 'px';
  const heartShades = ['#6b3f7a', '#b89ec9', '#d9c4e6', '#c8859b'];
  const color = heartShades[Math.floor(Math.random() * heartShades.length)];
  heart.innerHTML = `<svg viewBox="0 0 24 24" fill="${color}" style="width:100%;height:100%;">
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
  </svg>`;
  const drift = (Math.random() - 0.5) * 150;
  const rise = -(80 + Math.random() * 100);
  const duration = 2.5 + Math.random() * 1.5;
  heart.style.transition = `transform ${duration}s cubic-bezier(0.16, 1, 0.3, 1), opacity ${duration}s ease`;
  petalsLayer.appendChild(heart);
  requestAnimationFrame(() => {
    heart.style.transform = `translate(${drift}px, ${rise}px) rotate(${(Math.random() - 0.5) * 60}deg) scale(1.4)`;
    heart.style.opacity = '0';
  });
  setTimeout(() => heart.remove(), duration * 1000);
}

// ===== Ambient rising hearts — drift up across the page =====
const risingHearts = document.getElementById('risingHearts');
const heartShadesAmbient = [
  { color: '#6b3f7a', opacity: 0.55 },
  { color: '#b89ec9', opacity: 0.7 },
  { color: '#d9c4e6', opacity: 0.85 },
  { color: '#c8859b', opacity: 0.65 }
];
function spawnRisingHeart() {
  const h = document.createElement('div');
  h.className = 'heart-rise';
  const shade = heartShadesAmbient[Math.floor(Math.random() * heartShadesAmbient.length)];
  const size = 10 + Math.random() * 14;
  h.style.width = size + 'px';
  h.style.height = size + 'px';
  h.style.left = (5 + Math.random() * 90) + '%';
  const duration = 9 + Math.random() * 6;
  h.style.animation = `heartRise ${duration}s ease-in-out forwards`;
  h.innerHTML = `<svg viewBox="0 0 24 24" fill="${shade.color}" style="opacity:${shade.opacity};">
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
  </svg>`;
  risingHearts.appendChild(h);
  setTimeout(() => h.remove(), duration * 1000 + 200);
}
// Initial spread so hearts are already mid-rise on load
const initialHearts = isSlowDevice ? 3 : 5;
for (let i = 0; i < initialHearts; i++) {
  setTimeout(spawnRisingHeart, i * 1200);
}
// Steady stream — slower cadence on weaker devices
registerInterval(spawnRisingHeart, isSlowDevice ? 3200 : 2200);

// Ambient petals - slow occasional falling
function ambientPetal() {
  const x = Math.random() * window.innerWidth;
  spawnPetal(x, -20);
}
registerInterval(ambientPetal, isSlowDevice ? 2600 : 1800);

// Trigger initial reveal for scene 1 — wait for fonts so text reveals once
fontsReady.then(() => {
  setTimeout(() => scenes[0].classList.add('reveal'), 100);
});

// Keyboard navigation
document.addEventListener('keydown', (e) => {
  const active = document.querySelector('.progress .dot.active');
  const currentIdx = parseInt(active.dataset.scene);
  if (e.key === 'ArrowDown' || e.key === ' ') {
    e.preventDefault();
    const next = Math.min(currentIdx + 1, scenes.length - 1);
    scenes[next].scrollIntoView({ behavior: 'smooth' });
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    const prev = Math.max(currentIdx - 1, 0);
    scenes[prev].scrollIntoView({ behavior: 'smooth' });
  }
});
