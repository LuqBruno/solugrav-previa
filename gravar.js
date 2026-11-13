/* Solugrav — simulador ilustrativo de gravação (canvas 2D, sem dependências). */
(() => {
  'use strict';
  const root = document.querySelector('[data-lab]');
  if (!root) return;
  const $ = s => root.querySelector(s);
  const cv = $('canvas'), ctx = cv.getContext('2d');
  const input = $('[data-lab-text]'), go = $('[data-lab-go]'), want = $('[data-lab-want]'), status = $('[data-lab-status]');
  const mats = Array.from(root.querySelectorAll('input[name="lab-mat"]'));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const MAT = {
    bambu: { label: 'bambu', burn: '#55300f', ghost: '#3b2208' },
    metal: { label: 'metal escovado', burn: '#161616', ghost: '#222222' },
    preto: { label: 'preto fosco', burn: '#d9dce0', ghost: '#ffffff' }
  };
  const mask = document.createElement('canvas'), mctx = mask.getContext('2d');
  const burn = document.createElement('canvas'), ghost = document.createElement('canvas');
  let W = 0, H = 0, dpr = 1, mat = 'bambu', text = '', prog = 0, raf = 0, t0 = 0, dur = 2000, sparks = [], box = { x0: 0, x1: 0, y0: 0, y1: 0 };

  const piece = () => {
    const cx = W / 2, cy = H / 2;
    if (mat === 'bambu') { const r = Math.min(W, H) * 0.41; return { cx, cy, r, tw: r * 1.5 }; }
    if (mat === 'metal') { const w = Math.min(W * 0.8, H * 1.5), h = w * 0.36; return { cx, cy, w, h, rad: h * 0.14, tw: w * 0.8 }; }
    const h = H * 0.74, w = Math.min(W * 0.78, h * 1.25); return { cx: cx - w * 0.04, cy, w, h, rad: 14, tw: w * 0.66, px: cx };
  };
  const rr = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); };

  const drawPiece = () => {
    const p = piece();
    ctx.save();
    ctx.shadowColor = '#000b'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 22;
    if (mat === 'bambu') {
      const g = ctx.createLinearGradient(p.cx - p.r, p.cy - p.r, p.cx + p.r, p.cy + p.r);
      g.addColorStop(0, '#e9c58d'); g.addColorStop(0.5, '#d9ae72'); g.addColorStop(1, '#c79a5e');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.cx, p.cy, p.r, 0, 6.2832); ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.save(); ctx.beginPath(); ctx.arc(p.cx, p.cy, p.r, 0, 6.2832); ctx.clip();
      ctx.strokeStyle = '#a9773c'; ctx.lineWidth = 1;
      for (let i = -12; i <= 12; i++) {
        const y = p.cy + i * (p.r / 9.5);
        ctx.globalAlpha = 0.1 + (Math.abs(i * 7) % 5) * 0.035;
        ctx.beginPath(); ctx.moveTo(p.cx - p.r, y);
        ctx.bezierCurveTo(p.cx - p.r / 3, y + (i % 3) * 2.2, p.cx + p.r / 3, y - (i % 2) * 3, p.cx + p.r, y + (i % 4)); ctx.stroke();
      }
      ctx.restore();
      ctx.globalAlpha = 1; ctx.strokeStyle = '#b98a4f'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.cx, p.cy, p.r - 9, 0, 6.2832); ctx.stroke();
    } else if (mat === 'metal') {
      const x = p.cx - p.w / 2, y = p.cy - p.h / 2;
      const g = ctx.createLinearGradient(x, y, x + p.w, y + p.h);
      g.addColorStop(0, '#f1f2f3'); g.addColorStop(0.35, '#c9ccd0'); g.addColorStop(0.55, '#eef0f1'); g.addColorStop(1, '#b6babf');
      ctx.fillStyle = g; rr(ctx, x, y, p.w, p.h, p.rad); ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.save(); rr(ctx, x, y, p.w, p.h, p.rad); ctx.clip();
      ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = 0.16; ctx.lineWidth = 1;
      for (let i = 0; i < p.h; i += 3) { ctx.beginPath(); ctx.moveTo(x, y + i + 0.5); ctx.lineTo(x + p.w, y + i + 0.5); ctx.stroke(); }
      ctx.restore();
      ctx.globalAlpha = 1; ctx.strokeStyle = '#8f949a'; ctx.lineWidth = 1.5; rr(ctx, x + 5, y + 5, p.w - 10, p.h - 10, Math.max(2, p.rad - 4)); ctx.stroke();
    } else {
      const x = p.px - p.w / 2, y = p.cy - p.h / 2;
      const g = ctx.createLinearGradient(x, y, x + p.w, y + p.h);
      g.addColorStop(0, '#3a3a3c'); g.addColorStop(1, '#232325');
      ctx.fillStyle = g; rr(ctx, x, y, p.w, p.h, p.rad); ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = '#55565a'; ctx.lineWidth = 1; ctx.setLineDash([5, 5]);
      rr(ctx, x + 12, y + 12, p.w - 24, p.h - 24, 8); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#19191a'; ctx.fillRect(x + p.w * 0.89, y, p.w * 0.04, p.h);
    }
    ctx.restore();
  };

  const tint = (c, color) => {
    c.width = mask.width; c.height = mask.height;
    const k = c.getContext('2d');
    k.fillStyle = color; k.fillRect(0, 0, c.width, c.height);
    k.globalCompositeOperation = 'destination-in'; k.drawImage(mask, 0, 0);
  };
  const buildMask = () => {
    if (!W) return;
    const p = piece(), shown = text || 'Seu nome';
    mask.width = W * dpr; mask.height = H * dpr;
    mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mctx.clearRect(0, 0, W, H);
    let s = Math.min(H * 0.2, 92);
    const font = z => `600 ${z}px "Bricolage", system-ui, sans-serif`;
    mctx.font = font(s);
    while (mctx.measureText(shown).width > p.tw && s > 12) { s -= 2; mctx.font = font(s); }
    mctx.textAlign = 'center'; mctx.textBaseline = 'middle'; mctx.fillStyle = '#000';
    mctx.fillText(shown, p.cx, p.cy + s * 0.04);
    const w = mctx.measureText(shown).width;
    box = { x0: p.cx - w / 2, x1: p.cx + w / 2, y0: p.cy - s * 0.62, y1: p.cy + s * 0.62 };
    tint(burn, MAT[mat].burn); tint(ghost, MAT[mat].ghost);
  };

  const draw = now => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    drawPiece();
    ctx.globalAlpha = text ? 0.13 : 0.2; ctx.drawImage(ghost, 0, 0, W, H); ctx.globalAlpha = 1;
    const yCur = box.y0 + (box.y1 - box.y0) * prog;
    if (prog > 0 && text) {
      ctx.save(); ctx.beginPath(); ctx.rect(0, box.y0, W, yCur - box.y0); ctx.clip();
      ctx.drawImage(burn, 0, 0, W, H); ctx.restore();
    }
    if (prog > 0 && prog < 1) {
      const x = box.x0 - 12 + (box.x1 - box.x0 + 24) * (0.5 + 0.5 * Math.sin(now * 0.021));
      ctx.strokeStyle = '#ff2a3655'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(box.x0 - 18, yCur); ctx.lineTo(box.x1 + 18, yCur); ctx.stroke();
      const beam = ctx.createLinearGradient(0, 0, 0, yCur);
      beam.addColorStop(0, '#ff2a3600'); beam.addColorStop(1, '#ff4b55cc');
      ctx.strokeStyle = beam; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, yCur); ctx.stroke();
      const glow = ctx.createRadialGradient(x, yCur, 0, x, yCur, 26);
      glow.addColorStop(0, '#ffffff'); glow.addColorStop(0.18, '#ff8a8f'); glow.addColorStop(1, '#ff2a3600');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, yCur, 26, 0, 6.2832); ctx.fill();
      for (let i = 0; i < 2; i++) sparks.push({ x, y: yCur, vx: (Math.random() - 0.5) * 3.4, vy: -Math.random() * 3 - 0.6, life: 1 });
    }
    sparks = sparks.filter(s => s.life > 0);
    sparks.forEach(s => {
      s.x += s.vx; s.y += s.vy; s.vy += 0.16; s.life -= 0.045;
      ctx.globalAlpha = Math.max(0, s.life); ctx.fillStyle = '#ffd9a8';
      ctx.beginPath(); ctx.arc(s.x, s.y, 1.5, 0, 6.2832); ctx.fill();
    });
    ctx.globalAlpha = 1;
  };

  const describe = () => {
    cv.setAttribute('aria-label', text && prog >= 1
      ? `Simulação ilustrativa: “${text}” gravado em ${MAT[mat].label}.`
      : `Simulação ilustrativa de gravação em ${MAT[mat].label}.`);
  };
  const reset = msg => {
    cancelAnimationFrame(raf); raf = 0; prog = 0; sparks = [];
    want.hidden = true; go.textContent = 'Gravar';
    status.textContent = msg || '';
    buildMask(); draw(0); describe();
  };
  const finish = () => {
    prog = 1; describe();
    status.textContent = `Pronto: “${text}” em ${MAT[mat].label}.`;
    go.textContent = 'Gravar de novo'; want.hidden = false;
  };
  const loop = now => {
    prog = Math.min(1, (now - t0) / dur);
    draw(now);
    if (prog < 1 || sparks.length) raf = requestAnimationFrame(loop); else raf = 0;
    if (prog >= 1 && want.hidden) finish();
  };
  const run = () => {
    text = input.value.trim().slice(0, 16);
    if (!text) { reset('Digite um nome ou uma palavra para gravar.'); input.focus(); return; }
    reset('Gravando…');
    const vr = cv.getBoundingClientRect();
    if (vr.top < 70 || vr.bottom > innerHeight) cv.scrollIntoView({ block: 'center', behavior: reduce.matches ? 'auto' : 'smooth' });
    if (reduce.matches) { prog = 1; draw(0); finish(); return; }
    dur = 1500 + text.length * 110; t0 = performance.now();
    raf = requestAnimationFrame(loop);
  };

  const size = () => {
    const r = cv.getBoundingClientRect();
    if (!r.width) return;
    const keep = prog >= 1;
    W = Math.round(r.width); H = Math.round(r.height); dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = W * dpr; cv.height = H * dpr;
    buildMask(); if (keep) prog = 1; draw(0);
  };

  input.addEventListener('input', () => { text = input.value.trim().slice(0, 16); reset(''); });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); run(); } });
  mats.forEach(m => m.addEventListener('change', () => { mat = m.value; reset(''); }));
  go.addEventListener('click', run);
  want.addEventListener('click', () => {
    const obs = document.getElementById('f-obs');
    if (!obs) return;
    const line = `Ideia de gravação: “${text}” em ${MAT[mat].label}.`;
    const rest = obs.value.split('\n').filter(l => l.trim() && !l.startsWith('Ideia de gravação:')).join('\n');
    obs.value = (rest ? rest + '\n' : '') + line;
    obs.value = obs.value.slice(0, 280);
    obs.dispatchEvent(new Event('input', { bubbles: true }));
  });
  new ResizeObserver(size).observe(cv);
  document.fonts?.ready.then(() => { buildMask(); draw(0); });
  size(); describe();
})();
