/* Solugrav — prévia v0.2. Sem dependências. Conteúdo e contatos funcionam sem este arquivo. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = matchMedia('(min-width: 960px)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const cleanups = [];
  const on = (el, ev, fn, opt) => { el.addEventListener(ev, fn, opt); cleanups.push(() => el.removeEventListener(ev, fn, opt)); };
  const pageTop = el => el.getBoundingClientRect().top + scrollY;

  /* ---------- Cabeçalho e menu ---------- */
  const top = $('[data-top]');
  const menu = $('#menu');
  const menuBtn = $('[data-menu-btn]');
  const setMenu = (open, returnFocus) => {
    menu.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    $('.sr', menuBtn).textContent = open ? 'Fechar menu' : 'Abrir menu';
    if (open) $('a', menu)?.focus({ preventScroll: true });
    else if (returnFocus) menuBtn.focus();
  };
  on(menuBtn, 'click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
  on(menu, 'click', e => { if (e.target.closest('a')) setMenu(false); });
  on(document, 'keydown', e => { if (e.key === 'Escape' && menu.classList.contains('is-open')) setMenu(false, true); });
  on(document, 'click', e => { if (menu.classList.contains('is-open') && !top.contains(e.target)) setMenu(false); });
  on(desktop, 'change', () => setMenu(false));

  /* ---------- Elementos das cenas ---------- */
  const bar = $('[data-progress]');
  const stage = $('[data-stage]');
  const rig = $('[data-rig]');
  const layers = $$('.plate, .tag', rig).map(el => ({ el, z: parseFloat(el.style.getPropertyValue('--z')) || 0 }));
  const canvas = $('[data-dots]');
  const ctx = canvas.getContext('2d');
  const ticker = $('[data-ticker-track]');
  const detail = $('[data-detail]');
  const steps = $('[data-steps]');
  const stepEls = $$('.step', steps);
  const deckRig = $('[data-deck-rig]');
  const panel = $('[data-panel-view]');

  // Fita: duplica o conteúdo para o laço contínuo
  const tickerHTML = ticker.innerHTML;
  ticker.innerHTML = tickerHTML + tickerHTML + tickerHTML;
  let tickerHalf = 1;

  // Títulos: palavras que "acendem" com a rolagem (texto continua real e selecionável)
  const scrubs = $$('[data-scrub]').map(el => {
    const words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    const spans = words.map((w, i) => {
      const s = document.createElement('span'); s.className = 'w'; s.textContent = w;
      el.appendChild(s); if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
      return s;
    });
    return { el, spans, top: 0, vis: false };
  });
  const pars = $$('img[data-par]').map(img => ({ img, frame: img.parentElement, top: 0, h: 0, vis: false }));

  /* ---------- Medidas em cache (sem leitura de layout por quadro) ---------- */
  let vh = innerHeight, docMax = 1, stageTop = 0, stageH = 1, detailTop = 0, stepsTop = 0, stepsH = 1, cw = 0, ch = 0, dpr = 1;
  const measure = () => {
    vh = innerHeight;
    docMax = Math.max(1, document.documentElement.scrollHeight - vh);
    stageTop = pageTop(stage); stageH = stage.offsetHeight;
    detailTop = pageTop(detail);
    stepsTop = pageTop(steps); stepsH = steps.offsetHeight;
    scrubs.forEach(s => { s.top = pageTop(s.el); });
    pars.forEach(p => { p.top = pageTop(p.frame); p.h = p.frame.offsetHeight; });
    tickerHalf = ticker.scrollWidth / 3;
    const r = stage.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    if (Math.round(r.width) !== cw || Math.round(r.height) !== ch) {
      cw = Math.round(r.width); ch = Math.round(r.height);
      canvas.width = cw * dpr; canvas.height = ch * dpr;
    }
  };

  /* ---------- Campo de pontos (meio-tom) no palco vermelho ---------- */
  let px = -999, py = -999, tpx = -999, tpy = -999;
  const drawDots = t => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = '#fff';
    const gap = cw < 520 ? 18 : 22, reach = Math.max(cw, ch) * 0.95;
    for (let y = gap / 2; y < ch; y += gap) {
      for (let x = gap / 2; x < cw; x += gap) {
        const dist = Math.hypot(cw - x, ch - y);
        const fall = clamp(1 - dist / reach);
        const boost = clamp(1 - Math.hypot(x - px, y - py) / 150);
        if (fall < 0.04 && boost <= 0) continue;
        const wave = Math.sin(dist * 0.022 - t * 0.0013);
        const r = 0.5 + fall * fall * 3.1 * (0.62 + 0.38 * wave) + boost * 2.4;
        ctx.globalAlpha = Math.min(1, 0.1 + fall * 0.6 + boost * 0.45);
        ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
      }
    }
  };

  /* ---------- Laço: rolagem e ponteiro suavizados ---------- */
  let sy = scrollY, mx = 0, my = 0, tmx = 0, tmy = 0, raf = 0, heroVis = true, panelVis = false, detailVis = false, stepsVis = false;
  const render = now => {
    bar.style.transform = `scaleX(${clamp(sy / docMax).toFixed(4)})`;
    top.classList.toggle('is-scrolled', sy > 4);
    const still = reduce.matches;
    if (heroVis) {
      const p = still ? 0 : clamp((sy - Math.max(0, stageTop - vh * 0.55)) / (vh * 0.7));
      const k = desktop.matches ? 1 : 0.7;
      rig.style.transform = `rotateX(${((7 * (1 - p) - my * 4) * k).toFixed(2)}deg) rotateY(${((-17 * (1 - p) + mx * 6) * k).toFixed(2)}deg)`;
      layers.forEach(l => l.el.style.setProperty('--y', `${(-p * (20 + l.z * 0.55)).toFixed(1)}px`));
      drawDots(still ? 0 : now);
    }
    ticker.style.transform = `translate3d(${(-((sy * 0.6) % tickerHalf)).toFixed(1)}px,0,0)`;
    scrubs.forEach(s => {
      if (!s.vis && !still) return;
      const prog = still ? 1 : clamp((vh * 0.92 - (s.top - sy)) / (vh * 0.42));
      const n = s.spans.length;
      s.spans.forEach((w, i) => { w.style.opacity = (0.54 + 0.46 * clamp(prog * (n + 1.5) - i)).toFixed(3); });
    });
    if (!still) pars.forEach(p => {
      if (!p.vis) return;
      const c = p.top + p.h / 2 - sy;
      p.img.style.transform = `translate3d(0,${(((c - vh / 2) / vh) * -p.h * 0.07).toFixed(1)}px,0) scale(1.14)`;
    });
    if (detailVis || still) {
      const d = still ? 1 : clamp((vh - (detailTop - sy)) / (vh * 0.75));
      detail.style.clipPath = d >= 1 ? 'none' : `inset(0 ${((1 - d) * 6).toFixed(2)}% round ${((1 - d) * 44).toFixed(1)}px)`;
    }
    if (stepsVis || still) {
      const sp = still ? 1 : clamp((vh * 0.78 - (stepsTop - sy)) / (stepsH * 0.75));
      steps.style.setProperty('--sp', sp.toFixed(3));
      stepEls.forEach((s, i) => s.classList.toggle('is-on', sp >= [0.02, 0.48, 0.96][i]));
    }
    if (panelVis && !still && desktop.matches) deckRig.style.transform = `rotateX(${(4 - my * 3).toFixed(2)}deg) rotateY(${(-11 + mx * 5).toFixed(2)}deg)`;
  };
  const tick = now => {
    raf = 0;
    const target = scrollY;
    sy += (target - sy) * 0.16; if (Math.abs(target - sy) < 0.3) sy = target;
    mx += (tmx - mx) * 0.08; my += (tmy - my) * 0.08;
    px += (tpx - px) * 0.18; py += (tpy - py) * 0.18;
    render(now);
    const moving = sy !== target || Math.abs(tmx - mx) > 0.002 || Math.abs(tmy - my) > 0.002;
    if (moving || (heroVis && !document.hidden)) start();
  };
  const start = () => {
    if (raf) return;
    if (reduce.matches) { sy = scrollY; raf = requestAnimationFrame(now => { raf = 0; render(now); }); return; }
    raf = requestAnimationFrame(tick);
  };
  cleanups.push(() => cancelAnimationFrame(raf));

  const flags = new Map([[stage, v => { heroVis = v; }], [panel, v => { panelVis = v; }], [detail, v => { detailVis = v; }], [steps, v => { stepsVis = v; }]]);
  scrubs.forEach(s => flags.set(s.el, v => { s.vis = v; }));
  pars.forEach(p => flags.set(p.frame, v => { p.vis = v; }));
  const io = new IntersectionObserver(es => { es.forEach(e => flags.get(e.target)?.(e.isIntersecting)); start(); }, { rootMargin: '15% 0px' });
  flags.forEach((_, el) => io.observe(el));
  cleanups.push(() => io.disconnect());

  on(window, 'scroll', start, { passive: true });
  on(window, 'resize', () => { measure(); start(); });
  on(window, 'load', () => { measure(); start(); });
  on(document, 'visibilitychange', start);
  on(reduce, 'change', () => { measure(); start(); });
  on(window, 'pointermove', e => {
    if (!fine.matches || reduce.matches) return;
    tmx = (e.clientX / innerWidth - 0.5) * 2; tmy = (e.clientY / vh - 0.5) * 2;
    const r = stage.getBoundingClientRect();
    tpx = e.clientX - r.left; tpy = e.clientY - r.top;
    start();
  }, { passive: true });
  const ro = new ResizeObserver(() => { measure(); start(); });
  ro.observe(document.body); cleanups.push(() => ro.disconnect());
  document.fonts?.ready.then(() => { measure(); start(); });
  measure(); start();

  /* ---------- Detalhe: linha-guia desenha ao entrar ---------- */
  const dio = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { detail.classList.add('is-in'); dio.disconnect(); } }), { threshold: 0.35 });
  dio.observe(detail); cleanups.push(() => dio.disconnect());

  /* ---------- Vitrine indexada + baralho 3D ---------- */
  const index = $('[data-index]');
  const list = $('[data-list]');
  const lines = $$('.line', list);
  const deckCards = $('[data-deck-cards]'), deckSide = $('[data-deck-side]');
  const pCount = $('[data-p-count]', panel), pTitle = $('[data-p-title]', panel);
  const BIG = new Set(['036-corporativo-kit-agenda-verde','033-garrafas-copo-termico','038-corporativo-canetas-douradas','019-corporativo-bolsa-squeeze-bambu','057-presentes-kit-caneca','035-reconhecimento-placa-em-caixa']);
  const SQUARE = new Set(['033-garrafas-copo-termico','035-reconhecimento-placa-em-caixa']);
  const cards = new Map();
  let built = false, active = null;
  const buildDeck = () => {
    if (built) return; built = true;
    lines.forEach(li => {
      const [main, side, altMain, altSide] = $('template[data-panel]', li).innerHTML.trim().split('|');
      const card = document.createElement('div'); card.className = 'deck__card';
      const m = new Image(); m.decoding = 'async'; m.alt = altMain; m.src = `assets/img/${main}-${BIG.has(main) ? 1000 : 640}.webp`;
      if (SQUARE.has(main)) m.classList.add('is-square');
      card.appendChild(m); deckCards.appendChild(card);
      const s = new Image(); s.decoding = 'async'; s.alt = altSide; s.src = `assets/img/${side}-640.webp`;
      deckSide.appendChild(s);
      cards.set(li.dataset.cat, { card, side: s });
    });
  };
  const layoutDeck = () => {
    if (!built || !active) return;
    const order = $$('.line', list).map(l => l.dataset.cat);
    const a = order.indexOf(active.dataset.cat);
    order.forEach((cat, i) => {
      const { card, side } = cards.get(cat), d = i - a, dd = Math.min(d, 3);
      card.style.zIndex = String(20 - Math.abs(d));
      if (d < 0) { card.style.transform = 'translate3d(-34%,-5%,140px) rotateY(26deg) rotateZ(-9deg)'; card.style.opacity = '0'; }
      else { card.style.transform = `translate3d(${dd * 5.5}%,${-dd * 4.2}%,${-dd * 80}px) rotateZ(${dd * 1.6}deg)`; card.style.opacity = d > 3 ? '0' : '1'; }
      card.style.setProperty('--veil', String(d > 0 ? Math.min(0.4, dd * 0.13) : 0));
      side.classList.toggle('is-on', d === 0);
    });
    pCount.textContent = `${String(a + 1).padStart(2, '0')} / 06`;
    pTitle.textContent = $('.line__t', active).textContent;
  };
  const setActive = (li, force) => {
    if (!li || (li === active && !force)) return;
    active?.classList.remove('is-active');
    active = li; li.classList.add('is-active');
    if (!desktop.matches) return;
    buildDeck(); layoutDeck();
  };
  const lio = new IntersectionObserver(es => { es.forEach(e => { if (e.isIntersecting) setActive(e.target); }); }, { rootMargin: '-45% 0px -50% 0px' });
  lines.forEach(li => {
    lio.observe(li);
    on(li, 'pointerenter', () => { if (fine.matches) setActive(li); });
    on(li, 'focusin', () => setActive(li));
  });
  cleanups.push(() => lio.disconnect());
  const pio = new IntersectionObserver(es => { if (es[0].isIntersecting && desktop.matches) { buildDeck(); setActive(active || $('.line', list), true); } }, { rootMargin: '500px 0px' });
  pio.observe(index); cleanups.push(() => pio.disconnect());
  on(desktop, 'change', () => { if (desktop.matches && active) setActive(active, true); });

  /* Intenção: reordena (FLIP) e destaca, sem esconder nada */
  const ORDER = {
    todas: ['kits','garrafas','canetas','bolsas','presentes','reconhecimento'],
    empresa: ['kits','canetas','reconhecimento','garrafas','bolsas','presentes'],
    presente: ['presentes','bolsas','garrafas','kits','canetas','reconhecimento']
  };
  const MSG = {
    todas: 'Mostrando todas as linhas na ordem original.',
    empresa: 'Linhas para empresas aparecem primeiro. Todas continuam visíveis.',
    presente: 'Linhas para presentear aparecem primeiro. Todas continuam visíveis.'
  };
  const status = $('[data-intent-status]');
  const intentBtns = $$('[data-intent]');
  const applyIntent = mode => {
    intentBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.intent === mode)));
    index.dataset.mode = mode;
    const first = new Map(lines.map(li => [li, li.getBoundingClientRect().top]));
    ORDER[mode].forEach(cat => list.appendChild(lines.find(li => li.dataset.cat === cat)));
    if (!reduce.matches) {
      lines.forEach(li => {
        const dy = first.get(li) - li.getBoundingClientRect().top;
        if (Math.abs(dy) < 1) return;
        li.animate([{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }], { duration: 560, easing: 'cubic-bezier(.23,1,.32,1)' });
      });
    }
    status.textContent = MSG[mode];
    const radio = $(`input[name="intencao"][value="${mode === 'empresa' ? 'Para minha empresa' : 'Para presentear'}"]`);
    if (mode !== 'todas' && radio) { radio.checked = true; update(); }
    if (desktop.matches) setActive($('.line', list), true); else layoutDeck();
  };
  intentBtns.forEach(b => on(b, 'click', () => applyIntent(b.getAttribute('aria-pressed') === 'true' && b.dataset.intent !== 'todas' ? 'todas' : b.dataset.intent)));

  /* ---------- Orçamento → WhatsApp ---------- */
  const form = $('[data-form]');
  const qtd = $('#f-qtd'), data = $('#f-data'), cat = $('#f-cat'), obs = $('#f-obs');
  const summary = $('[data-summary]');
  const count = $('[data-count]');
  const waLinks = $$('[data-wa]');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const maxDate = new Date(today); maxDate.setFullYear(today.getFullYear() + 2);
  data.min = iso(today); data.max = iso(maxDate);

  const setErr = (input, msg) => {
    const el = document.getElementById(input.getAttribute('aria-describedby'));
    el.textContent = msg;
    if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
  };
  const validate = (show = true) => {
    let firstBad = null;
    const q = qtd.value.trim();
    let qMsg = '';
    if (qtd.validity.badInput) qMsg = 'Use apenas números.';
    else if (q && (!/^\d+$/.test(q) || +q < 1 || +q > 100000)) qMsg = 'Informe um número inteiro entre 1 e 100.000.';
    let dMsg = '';
    if (data.validity.badInput) dMsg = 'Data incompleta.';
    else if (data.value) {
      const d = new Date(data.value + 'T00:00:00');
      if (isNaN(d)) dMsg = 'Data inválida.';
      else if (d < today) dMsg = 'Escolha uma data a partir de hoje.';
      else if (d > maxDate) dMsg = 'Escolha uma data nos próximos dois anos.';
    }
    if (show) { setErr(qtd, qMsg); setErr(data, dMsg); }
    if (qMsg) firstBad = qtd; else if (dMsg) firstBad = data;
    return firstBad;
  };
  const message = () => {
    const fd = new FormData(form);
    const c = (fd.get('categoria') || '').toString();
    const out = [`Olá, Solugrav! Gostaria de consultar opções de ${c ? c.charAt(0).toLowerCase() + c.slice(1) : 'produtos personalizados'}.`];
    const i = (fd.get('intencao') || '').toString();
    if (i) out.push(`Interesse: ${i === 'Para minha empresa' ? 'para a minha empresa' : 'para presentear'}.`);
    const bad = validate(false);
    const q = qtd.value.trim();
    if (q && bad !== qtd) out.push(`Quantidade estimada: ${(+q).toLocaleString('pt-BR')}.`);
    if (data.value && bad !== data) { const [y, m, d] = data.value.split('-'); out.push(`Data desejada: ${d}/${m}/${y}.`); }
    const o = obs.value.trim().replace(/\s+\n/g, '\n').slice(0, 280);
    if (o) out.push(o);
    return out.join('\n');
  };
  function update() {
    const text = message();
    summary.textContent = text;
    waLinks.forEach(a => { a.href = `https://wa.me/${a.dataset.wa}?text=${encodeURIComponent(text)}`; });
    count.textContent = obs.value.length;
  }
  on(form, 'input', e => { if (e.target === qtd || e.target === data) { if (e.target.getAttribute('aria-invalid')) validate(); } update(); });
  on(form, 'change', e => { if (e.target === qtd || e.target === data) validate(); update(); });
  on(form, 'submit', e => e.preventDefault());
  waLinks.forEach(a => on(a, 'click', e => {
    const bad = validate(true);
    if (bad) { e.preventDefault(); bad.focus(); return; }
    update();
  }));
  $$('[data-pick]').forEach(a => on(a, 'click', () => {
    cat.value = a.dataset.pick; update();
    setTimeout(() => cat.focus({ preventScroll: true }), reduce.matches ? 0 : 450);
  }));
  update();

  window.__solugravTeardown = () => { cleanups.splice(0).forEach(fn => fn()); };
})();
