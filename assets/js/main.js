(() => {
  const root = document.documentElement;
  root.classList.add('js');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const form = $('#estimate-form');
  const setFinish = value => {
    const radio = $(`input[name="finish"][value="${value}"]`, form);
    if (radio) radio.checked = true;
  };

  /* Header */
  const head = $('#site-head'), nav = $('#nav'), menuBtn = $('.menu-btn');
  const onScroll = () => head.classList.toggle('is-stuck', scrollY > 24);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  const closeMenu = () => { nav.classList.remove('is-open'); menuBtn.setAttribute('aria-expanded', 'false'); };
  menuBtn.addEventListener('click', () => {
    menuBtn.setAttribute('aria-expanded', String(nav.classList.toggle('is-open')));
  });
  nav.addEventListener('click', e => { if (e.target.closest('a')) closeMenu(); });
  addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

  const links = $$('a', nav);
  const spy = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting) links.forEach(a => a.classList.toggle('is-on', a.hash === '#' + en.target.id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('main section[id]').forEach(s => spy.observe(s));

  /* Light sweep reveals */
  const reveal = new IntersectionObserver(entries => {
    entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('is-in'); reveal.unobserve(en.target); } });
  }, { rootMargin: '0px 0px -12% 0px' });
  $$('.reveal').forEach(el => reveal.observe(el));

  /* Soft entrances. Only blocks still below the fold are hidden, so nothing already on screen ever blinks. */
  if (!reduce) {
    const enter = new IntersectionObserver(entries => {
      // Blocks that arrive together (one row) come in one after another.
      entries.filter(en => en.isIntersecting).forEach((en, i) => {
        en.target.style.animationDelay = Math.min(i, 5) * 90 + 'ms';
        en.target.classList.add('is-in');
        enter.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    const blocks = 'main section h2, .about-copy > *, .card, .fin-card, .rooms, .vs-card, .vs-badge, .reel, .quote, .why-panel, .steps li, .qa details, .est-form > *, .est-map, main .wrap > .btn';
    new Set($$(blocks)).forEach(el => {
      if (el.getBoundingClientRect().top < innerHeight) return;
      el.classList.add('in');
      if (el.matches('h2')) el.classList.add('in-soft');
      enter.observe(el);
    });
  }

  /* Mobile dock: shown once the hero band leaves, hidden while the form is in view */
  const dock = $('#dock');
  const seen = { band: true, form: false };
  const dockIO = new IntersectionObserver(entries => {
    entries.forEach(en => { seen[en.target.dataset.dock] = en.isIntersecting; });
    dock.classList.toggle('is-on', !seen.band && !seen.form);
  });
  [['.band', 'band'], ['#estimate-form', 'form']].forEach(([s, k]) => { const el = $(s); el.dataset.dock = k; dockIO.observe(el); });

  /* A service card carries its finish into the estimate form */
  $$('.card a').forEach(a => a.addEventListener('click', () => setFinish(a.dataset.finish)));

  /* Finish textures, drawn on tileable canvases the first time the section comes near */
  const S = 512, N = 8;
  const lcg = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const noise = (seed, n = N) => {
    const r = lcg(seed), g = new Float32Array(n * n).map(() => r());
    const at = (x, y) => g[((y % n) + n) % n * n + ((x % n) + n) % n];
    const base = (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
    return (x, y) => base(x, y) * .55 + base(x * 2, y * 2) * .28 + base(x * 4, y * 4) * .17;
  };
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const step = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const pixels = (fn, size = S) => {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const ctx = c.getContext('2d'), img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const [r, g, b] = fn(x / size * N, y / size * N), i = (y * size + x) * 4;
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  };
  const draw = {
    // A full broadcast: small chips packed edge to edge, as on the floor in the hero photo.
    flake() {
      const c = document.createElement('canvas'); c.width = c.height = S;
      const ctx = c.getContext('2d'), r = lcg(7);
      ctx.fillStyle = '#101114'; ctx.fillRect(0, 0, S, S);
      const chips = ['#040405', '#040405', '#040405', '#2b2d32', '#2b2d32', '#4d5157', '#4d5157', '#8a8e95', '#c3c6cb', '#f0efeb', '#b08a3c'];
      for (let i = 0; i < 15000; i++) {
        const x = r() * S, y = r() * S, w = 1.5 + r() * 4.5, h = 1.5 + r() * 3.5, a = r() * Math.PI;
        ctx.fillStyle = chips[Math.floor(r() * chips.length)];
        // Chips near an edge are repeated on the far side so the tile wraps cleanly.
        const xs = x < 8 ? [0, S] : x > S - 8 ? [0, -S] : [0], ys = y < 8 ? [0, S] : y > S - 8 ? [0, -S] : [0];
        for (const ox of xs) for (const oy of ys) {
          ctx.save(); ctx.translate(x + ox, y + oy); ctx.rotate(a); ctx.fillRect(-w / 2, -h / 2, w, h); ctx.restore();
        }
      }
      return c;
    },
    quartz() {
      const r = lcg(21), n = noise(3);
      return pixels((x, y) => {
        const t = r(), cloud = n(x, y);
        const grain = t < .12 ? [58, 55, 50] : t > .9 ? [236, 232, 222] : mix([128, 122, 111], [176, 169, 156], r());
        return mix(grain, [150, 143, 130], cloud * .25);
      }, S / 2);
    },
    // The low grids are half size, so sampling them at half scale still wraps at the tile edge.
    metallic() {
      const n = noise(11), m = noise(29), lo = noise(41, N / 2);
      const ramp = [[20, 22, 27], [44, 47, 55], [82, 87, 97], [128, 133, 143], [182, 180, 172]];
      return pixels((x, y) => {
        const wx = x + 2.8 * n(x + 1.7, y + 5.2), wy = y + 2.8 * m(x + 6.3, y + 2.8);
        const swirl = .5 + .5 * Math.sin((lo(wx / 2, wy / 2) * 2.2 + n(wx, wy) * .6) * Math.PI * 2);
        const t = Math.min(.999, Math.pow(swirl, 1.15)) * (ramp.length - 1), i = Math.floor(t);
        return mix(ramp[i], ramp[i + 1], t - i);
      });
    },
    marble() {
      const n = noise(5), m = noise(17), lo = noise(23, N / 2);
      return pixels((x, y) => {
        // One family of open diagonal veins. The drift stays gentler than the diagonal, so lines wander without closing into cells.
        const drift = .8 * lo(x / 2 + .3, y / 2 + .7) + .2 * n(x, y);
        const v1 = 1 - Math.abs(Math.sin((x * .25 + y * .25 + drift) * Math.PI));
        const v2 = 1 - Math.abs(Math.sin((x * .25 - y * .125 + .3 * m(x, y)) * Math.PI));
        const base = mix([247, 246, 243], [228, 227, 223], lo(x / 2 + 4, y / 2 + 2));
        const soft = mix(base, [172, 175, 182], Math.min(1, step(.7, 1, v1) * .6 + step(.9, 1, v2) * .24));
        return mix(soft, [98, 101, 108], step(.955, 1, v1) * .6);
      });
    }
  };

  /* Finish selector */
  const FIN = {
    flake: { name: 'Epoxy Flake', desc: 'Durable and easy to clean surfaces ideal for high traffic areas.', fit: 'garages', form: 'Flake' },
    quartz: { name: 'Quartz', desc: 'Slip resistant and incredibly strong finishes perfect for outdoor spaces.', fit: 'patios and pool decks', form: 'Quartz' },
    metallic: { name: 'Metallic Epoxy', desc: 'Unique and highly customizable designs providing a modern glossy appearance.', fit: 'rooms that want a statement floor', form: 'Metallic' },
    marble: { name: 'Marble Finish', desc: 'Elegant and seamless flooring solutions for a sophisticated interior look.', fit: 'refined interiors', form: 'Marble', size: '820px' }
  };
  const sw = $$('.swatches button'), floorA = $('.floor-a'), floorB = $('.floor-b'), light = $('.floor-light'), cta = $('#fin-cta');
  const tex = {};
  let current = 'flake';
  const texture = key => {
    if (!tex[key]) {
      tex[key] = `url(${draw[key]().toDataURL('image/webp', .9)})`;
      $('i', sw.find(b => b.dataset.f === key)).style.backgroundImage = tex[key];
    }
    return tex[key];
  };
  // One texture per task, so drawing them never blocks a frame for long.
  const paint = (keys = Object.keys(draw)) => {
    if (!keys.length) return;
    texture(keys[0]);
    if (keys[0] === current) floorA.style.backgroundImage = tex[current];
    setTimeout(() => paint(keys.slice(1)), 60);
  };
  new IntersectionObserver((entries, io) => {
    if (!entries[0].isIntersecting) return;
    io.disconnect();
    paint();
  }, { rootMargin: '1400px' }).observe($('#finishes'));

  let pouring = null;
  const choose = (btn, focus) => {
    const key = btn.dataset.f, f = FIN[key];
    if (btn.getAttribute('aria-checked') === 'true') return;
    sw.forEach(b => { const on = b === btn; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; });
    if (focus) btn.focus();
    $('#fin-name').textContent = f.name; $('#fin-desc').textContent = f.desc; $('#fin-fit').textContent = f.fit;
    current = key;
    setFinish(f.form);
    const px = 22 + sw.indexOf(btn) / (sw.length - 1) * 56;
    if (pouring) pouring.finish();
    floorB.style.backgroundImage = texture(key);
    // Marble tiles far larger than the stage shows, so its veins never visibly repeat.
    floorB.style.backgroundSize = f.size || '';
    const opts = { duration: reduce ? 1 : 1250, easing: 'cubic-bezier(.16,1,.3,1)' };
    pouring = floorB.animate({ clipPath: [`circle(0% at ${px}% 34%)`, `circle(150% at ${px}% 34%)`] }, opts);
    light.animate({ backgroundPosition: ['100% 0', '0% 0'] }, opts);
    pouring.onfinish = () => { floorA.style.backgroundImage = tex[key]; floorA.style.backgroundSize = f.size || ''; pouring = null; };
  };
  sw.forEach((b, i) => {
    b.addEventListener('click', () => choose(b));
    b.addEventListener('keydown', e => {
      const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!d) return;
      e.preventDefault();
      choose(sw[(i + d + sw.length) % sw.length], true);
    });
  });
  cta.addEventListener('click', () => setFinish(FIN[current].form));

  /* Estimate wizard */
  const steps = $$('fieldset', form), dots = $$('.wiz-steps li', form), status = $('.wiz-status', form);
  const show = (i, focus) => {
    form.dataset.at = i;
    steps.forEach((s, k) => s.classList.toggle('is-on', k === i));
    dots.forEach((d, k) => d.classList.toggle('is-on', k <= i));
    if (focus) { const el = $('input:checked, input, select', steps[i]); if (el) el.focus({ preventScroll: true }); }
  };
  show(0);
  $('[data-next]', form).addEventListener('click', () => show(+form.dataset.at + 1, true));
  $('[data-back]', form).addEventListener('click', () => show(+form.dataset.at - 1, true));

  const rules = {
    name: v => v.trim() ? '' : 'Enter your name.',
    phone: v => v.replace(/\D/g, '').length >= 10 ? '' : 'Enter a 10 digit phone number.',
    email: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : 'Enter a valid email address.',
    zip: v => /^\d{5}$/.test(v) ? '' : 'Enter a 5 digit ZIP code.'
  };
  const mark = (name, msg) => {
    const input = form.elements[name], err = $('#e-' + name);
    err.textContent = msg;
    input.setAttribute('aria-invalid', String(!!msg));
    if (msg) input.setAttribute('aria-describedby', err.id); else input.removeAttribute('aria-describedby');
    return !msg;
  };
  Object.keys(rules).forEach(name => {
    form.elements[name].addEventListener('blur', e => { if (e.target.value) mark(name, rules[name](e.target.value)); });
  });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const bad = Object.keys(rules).filter(name => !mark(name, rules[name](form.elements[name].value)));
    if (bad.length) { form.elements[bad[0]].focus(); return; }
    const send = $('[type="submit"]', form);
    send.disabled = true;
    status.textContent = 'Sending your request.';
    const thanks = () => {
      form.classList.add('is-done');
      status.textContent = `Thank you, ${form.elements.name.value.trim()}. We will reply within 24 hours.`;
    };
    // The email goes out through Web3Forms, straight from the browser (its key is public by design).
    const web3forms = async () => {
      const f = form.elements;
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: form.dataset.web3forms,
          subject: `New estimate request: ${f.name.value.trim()} (${f.space.value})`,
          from_name: 'Imperial Concrete Coatings website',
          replyto: f.email.value.trim(),
          botcheck: '',
          form_id: form.dataset.formId,
          name: f.name.value.trim(), phone: f.phone.value.trim(), email: f.email.value.trim(), zip: f.zip.value.trim(),
          space: f.space.value, finish: f.finish.value, size: f.size.value
        })
      });
      const out = await res.json();
      if (!out.success) throw new Error(out.message);
    };
    form.elements.t.value = Math.round(performance.now());
    let data;
    try {
      // contact.php screens for spam and forwards the lead to the webhook.
      const res = await fetch(form.action, { method: 'POST', body: new FormData(form) });
      data = await res.json();
    } catch (err) {
      data = { ok: true, relay: true, fallback: true }; // Endpoint unreachable: still deliver the lead by email.
    }
    try {
      if (data.errors) { Object.entries(data.errors).forEach(([k, m]) => mark(k, m)); status.textContent = ''; }
      else if (data.test) status.textContent = 'Test website: estimate requests are disabled until launch.';
      else if (data.ok && data.relay) { await web3forms(); thanks(); }
      else if (data.ok) thanks();
      else throw new Error(data.error);
    } catch (err) {
      status.textContent = 'We could not send your request. Please call (913) 995-2657.';
    }
    send.disabled = false;
  });

  /* Map loads only when it scrolls near the viewport */
  const map = $('.map');
  new IntersectionObserver((entries, io) => {
    if (!entries[0].isIntersecting) return;
    io.disconnect();
    const frame = document.createElement('iframe');
    frame.src = map.dataset.src;
    frame.title = 'Map showing Imperial Concrete Coatings in Olathe, Kansas';
    frame.loading = 'lazy';
    frame.referrerPolicy = 'no-referrer-when-downgrade';
    map.replaceChildren(frame);
  }, { rootMargin: '400px' }).observe(map);

  /* Light travels, objects stay */
  if (window.gsap && !reduce) {
    gsap.registerPlugin(ScrollTrigger);
    gsap.from('.streaks i', { xPercent: -320, duration: 2.4, ease: 'expo.out', stagger: .14 });
    gsap.fromTo('.band', { '--sheen': '-70%' }, { '--sheen': '70%', duration: 2.2, ease: 'expo.out', delay: .5 });
    gsap.to('.streaks i', { x: i => (i % 2 ? -220 : 260), ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.fromTo('.floor-light', { '--lx': '95%' }, { '--lx': '5%', ease: 'none', scrollTrigger: { trigger: '.stage', start: 'top bottom', end: 'bottom top', scrub: true } });
  }
})();
