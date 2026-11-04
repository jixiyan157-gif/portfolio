/* ============================================================
   入口「生成」特效 + 首屏粒子场 + 站点交互
   全部逻辑无外部依赖，种子固定保证每次打开画面一致。
   ============================================================ */
(() => {
  'use strict';

  const SEED = 58391207;                    // 页面种子的固定值（Hero 底部展示）
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 可复现随机数 ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rand = mulberry32(SEED);

  /* ---------- 粒子场引擎 ---------- */
  class ParticleField {
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {object} opts
     *  density: 粒子疏密（数值越大越稀疏）
     *  link:    连线距离阈值（px）
     *  drift:   漂移速度
     *  alpha:   粒子透明度上限
     *  accent:  主色粒子占比
     */
    constructor(canvas, { density = 16000, link = 96, drift = 0.08, alpha = 0.5, accent = 0.18 } = {}) {
      this.cv = canvas;
      this.ctx = canvas.getContext('2d');
      this.opts = { density, link, drift, alpha, accent };
      this.particles = [];
      this.convergeT = null;      // 聚拢目标点（入口页点击后启用）
      this.active = true;         // 是否应处于运行状态
      this.running = false;
      this.raf = null;
      this.mx = 0; this.my = 0;   // 鼠标视差（当前值）
      this.tx = 0; this.ty = 0;   // 鼠标视差（目标值）
      this.resize();
      this.build();
      if (reduceMotion) { this.draw(); }
      else if (this.active) { this.play(); }
    }

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = this.cv.clientWidth, h = this.cv.clientHeight;
      if (!w || !h) return;
      this.w = w; this.h = h;
      this.cv.width = w * dpr; this.cv.height = h * dpr;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.count = Math.min(Math.round((w * h) / this.opts.density), 170);
    }

    build() {
      this.particles = [];
      for (let i = 0; i < this.count; i++) {
        const isAccent = rand() < this.opts.accent;
        this.particles.push({
          x: rand() * this.w, y: rand() * this.h,
          vx: (rand() - 0.5) * this.opts.drift,
          vy: (rand() - 0.5) * this.opts.drift,
          r: 0.6 + rand() * 1.3,
          a: 0.12 + rand() * this.opts.alpha,
          acc: isAccent ? (rand() < 0.5 ? 0 : 1) : -1,   // 0 紫罗兰 / 1 青 / -1 灰
        });
      }
    }

    /* 入口页点击后：粒子向屏幕中心聚拢 */
    converge(x, y) {
      this.particles.forEach((p) => {
        p.ox = (rand() - 0.5) * 46;
        p.oy = (rand() - 0.5) * 46;
      });
      this.convergeT = { x, y };
    }

    play() {
      if (this.running || reduceMotion) return;
      this.running = true;
      const step = () => {
        if (!this.running) return;
        this.tick();
        this.raf = requestAnimationFrame(step);
      };
      this.raf = requestAnimationFrame(step);
    }

    pause() {
      this.running = false;
      if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; }
    }

    tick() {
      // 鼠标视差平滑跟随
      this.mx += (this.tx - this.mx) * 0.05;
      this.my += (this.ty - this.my) * 0.05;

      for (const p of this.particles) {
        if (this.convergeT) {
          const tx = this.convergeT.x + p.ox, ty = this.convergeT.y + p.oy;
          p.x += (tx - p.x) * 0.085;
          p.y += (ty - p.y) * 0.085;
        } else {
          p.x += p.vx; p.y += p.vy;
          if (p.x < -10) p.x = this.w + 10; else if (p.x > this.w + 10) p.x = -10;
          if (p.y < -10) p.y = this.h + 10; else if (p.y > this.h + 10) p.y = -10;
        }
      }
      this.draw();
    }

    draw() {
      const { ctx, w, h, opts } = this;
      ctx.clearRect(0, 0, w, h);

      // 连线：距离越近越亮
      const D = opts.link;
      for (let i = 0; i < this.particles.length; i++) {
        for (let j = i + 1; j < this.particles.length; j++) {
          const a = this.particles[i], b = this.particles[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < D * D) {
            const al = (1 - Math.sqrt(d2) / D) * 0.12;
            ctx.strokeStyle = 'rgba(148,158,196,' + al.toFixed(3) + ')';
            ctx.beginPath();
            ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // 粒子
      for (const p of this.particles) {
        const px = p.x + this.mx * p.r * 6;
        const py = p.y + this.my * p.r * 6;
        const color = p.acc === 0 ? '139,143,255' : p.acc === 1 ? '95,217,255' : '158,168,190';
        ctx.fillStyle = 'rgba(' + color + ',' + p.a.toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(px, py, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /* ---------- 元素 ---------- */
  const body = document.body;
  const entry = document.getElementById('entry');
  const entryCore = document.getElementById('entry-core');
  const enterBtn = document.getElementById('enter-btn');
  const entryCv = document.getElementById('entry-canvas');
  const heroCv = document.getElementById('hero-canvas');
  const siteEl = document.getElementById('site');
  const header = document.getElementById('header');
  const seedEl = document.getElementById('seed');
  const menuBtn = document.getElementById('menu-btn');
  const menu = document.getElementById('menu');

  if (seedEl) seedEl.textContent = 'SEED ' + SEED;

  /* ---------- 两个粒子场 ---------- */
  const entryField = new ParticleField(entryCv, { density: 10000, link: 100, drift: 0.15, alpha: 0.55, accent: 0.22 });
  const heroField = new ParticleField(heroCv, { density: 20000, link: 110, drift: 0.08, alpha: 0.45, accent: 0.16 });
  heroField.active = false;
  heroField.pause();

  // 3D 唱片画廊接管后，停用粒子背景（见 hero-gallery.js）
  window.addEventListener('hero-gallery-active', () => {
    heroField.active = false;
    heroField.pause();
    heroCv.style.display = 'none';
  });

  /* ---------- 进入主站 ---------- */
  let entered = false;
  function enter() {
    if (entered) return;
    entered = true;

    body.classList.add('entered');
    body.classList.remove('no-scroll');
    updateHeader();
    entry.classList.add('is-leaving');
    enterBtn.disabled = true;

    // 粒子向入口核心文字聚拢，随后关停入口画布
    const r = entryCore.getBoundingClientRect();
    entryField.converge(r.left + r.width / 2, r.top + r.height / 2);
    entryField.active = false;
    setTimeout(() => entryField.pause(), 900);

    // 首屏粒子场开始运行
    heroField.active = true;
    heroField.play();

    // 焦点移入主站
    siteEl.focus({ preventScroll: true });
  }
  enterBtn.addEventListener('click', enter);
  entry.addEventListener('click', (e) => { if (e.target !== enterBtn) enter(); });
  document.addEventListener('keydown', (e) => {
    if (!entered && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); enter(); }
  });

  /* ---------- 首屏鼠标视差（仅精确指针设备） ---------- */
  if (window.matchMedia('(pointer: fine)').matches) {
    window.addEventListener('pointermove', (e) => {
      heroField.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      heroField.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    });
  }

  /* ---------- 导航滚动状态 ---------- */
  function updateHeader() {
    header.classList.toggle('scrolled', window.scrollY > 24);
  }
  window.addEventListener('scroll', updateHeader, { passive: true });
  updateHeader();

  /* ---------- 移动端菜单 ---------- */
  function setMenu(open) {
    body.classList.toggle('menu-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? '关闭菜单' : '打开菜单');
    menu.setAttribute('aria-hidden', String(!open));
  }
  menuBtn.addEventListener('click', () => setMenu(!body.classList.contains('menu-open')));
  menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && body.classList.contains('menu-open')) setMenu(false);
  });

  /* ---------- 窗口尺寸与后台切换 ---------- */
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      entryField.resize(); entryField.build();
      heroField.resize(); heroField.build();
      if (reduceMotion) { entryField.draw(); heroField.draw(); }
    }, 200);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      entryField.pause(); heroField.pause();
    } else {
      if (entryField.active) entryField.play();
      if (heroField.active) heroField.play();
    }
  });
})();
