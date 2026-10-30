/* ============================================================
   精选项目：瀑布流渲染
   - 优先从后端 /api/projects 拉取真实项目
   - 后端不可用（如双击 index.html 直接打开）时回退演示数据
   - 瀑布流：按容器宽度分列（≥980px 三列 / ≥620px 两列 / 其余单列），
     每张卡片放入当前最矮的一列，图片加载完成后自动重排
   ============================================================ */
(() => {
  'use strict';

  const container = document.getElementById('works-grid');
  if (!container) return;

  const viewer = document.getElementById('image-viewer');
  const viewerImage = document.getElementById('image-viewer-image');
  const viewerTitle = document.getElementById('image-viewer-title');
  const viewerClose = document.getElementById('image-viewer-close');

  const videoViewer = document.getElementById('video-viewer');
  const videoViewerTitle = document.getElementById('video-viewer-title');
  const videoViewerPlayer = document.getElementById('video-viewer-player');
  const videoViewerClose = document.getElementById('video-viewer-close');
  let videoViewerTrigger = null;
  function closeVideoViewer() {
    if (!videoViewer || videoViewer.hidden) return;
    videoViewerPlayer.pause();
    videoViewerPlayer.removeAttribute('src');
    videoViewerPlayer.removeAttribute('poster');
    videoViewerPlayer.load();
    videoViewer.hidden = true;
    document.body.classList.remove('video-view-open');
    if (videoViewerTrigger) videoViewerTrigger.focus();
  }
  function showVideoViewer(p, trigger) {
    if (!videoViewer) return;
    videoViewerTrigger = trigger;
    videoViewerTitle.textContent = p.title;
    videoViewerPlayer.src = p.video;
    videoViewerPlayer.poster = p.image || '';
    videoViewerPlayer.setAttribute('aria-label', p.title + ' 大屏视频播放器');
    videoViewer.hidden = false;
    document.body.classList.add('video-view-open');
    videoViewerClose.focus();
    videoViewerPlayer.play().catch(() => {});
  }
  if (videoViewerClose) videoViewerClose.addEventListener('click', closeVideoViewer);
  if (videoViewer) videoViewer.addEventListener('click', (e) => { if (e.target === videoViewer) closeVideoViewer(); });
  function closeViewer() {
    if (!viewer) return;
    viewer.hidden = true;
    document.body.classList.remove('image-view-open');
    viewerImage.removeAttribute('src');
  }
  function showDetail(p) {
    if (!viewer) return;
    viewerTitle.textContent = p.title;
    viewerImage.src = p.image;
    viewerImage.alt = p.title + '，完整高分辨率详情页';
    viewer.hidden = false;
    document.body.classList.add('image-view-open');
    viewerClose.focus();
  }
  if (viewerClose) viewerClose.addEventListener('click', closeViewer);
  if (viewer) viewer.addEventListener('click', (e) => { if (e.target === viewer) closeViewer(); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (videoViewer && !videoViewer.hidden) closeVideoViewer();
    else if (viewer && !viewer.hidden) closeViewer();
  });

  /* ---------- 演示占位图（程序生成 SVG，后端未启动时兜底展示） ---------- */
  function demoArt(i) {
    const art = [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="rgba(139,143,255,.28)"/><stop offset=".55" stop-color="rgba(139,143,255,.05)"/><stop offset="1" stop-color="transparent"/></linearGradient><filter id="b"><feGaussianBlur stdDeviation="70"/></filter><pattern id="p" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="rgba(255,255,255,.05)"/></pattern></defs><rect width="800" height="500" fill="#0f1218"/><rect width="800" height="500" fill="url(#p)"/><circle cx="620" cy="150" r="150" fill="rgba(95,217,255,.16)" filter="url(#b)"/><circle cx="200" cy="400" r="120" fill="rgba(139,143,255,.18)" filter="url(#b)"/><rect width="800" height="500" fill="url(#g)"/></svg>`,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 900"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="transparent"/><stop offset=".6" stop-color="rgba(95,217,255,.12)"/><stop offset="1" stop-color="rgba(95,217,255,.24)"/></linearGradient></defs><rect width="700" height="900" fill="#0f1218"/><g fill="none" stroke="rgba(139,143,255,.4)"><circle cx="500" cy="450" r="60"/><circle cx="500" cy="450" r="120"/><circle cx="500" cy="450" r="180"/><circle cx="500" cy="450" r="240"/></g><rect width="700" height="900" fill="url(#g)"/></svg>`,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 1000"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#151a24"/><stop offset="1" stop-color="#0f1218"/></linearGradient></defs><rect width="700" height="1000" fill="url(#g)"/><g fill="none" stroke-width="1.2"><path d="M0 300 C 100 220, 180 380, 280 290 S 460 200, 560 290 S 650 380, 700 300" stroke="rgba(139,143,255,.5)"/><path d="M0 480 C 100 400, 180 560, 280 470 S 460 380, 560 470 S 650 560, 700 480" stroke="rgba(95,217,255,.35)"/><path d="M0 660 C 100 580, 180 740, 280 650 S 460 560, 560 650 S 650 740, 700 660" stroke="rgba(155,163,178,.25)"/></g></svg>`,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600"><defs><radialGradient id="g" cx="30%" cy="30%" r="70%"><stop offset="0" stop-color="rgba(139,143,255,.35)"/><stop offset="1" stop-color="transparent"/></radialGradient></defs><rect width="900" height="600" fill="#0f1218"/><rect width="900" height="600" fill="url(#g)"/><g stroke="rgba(255,255,255,.06)"><line x1="270" y1="30" x2="60" y2="580"/><line x1="270" y1="30" x2="340" y2="580"/><line x1="270" y1="30" x2="620" y2="580"/><line x1="270" y1="30" x2="860" y2="430"/></g></svg>`,
    ];
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(art[i % art.length]);
  }

  /* ---------- 演示项目（占位示例，可随时在后台用真实项目替换） ---------- */
  const DEMO = [
    { id: 'demo1', title: '涌动 · 品牌视觉全案', category: '品牌视觉', year: '2025', desc: '为科技消费品牌构建从概念到 VI 的完整视觉系统，AI 生成与手绘精修结合。', tags: ['Midjourney', 'Photoshop', 'Illustrator'], image: demoArt(0) },
    { id: 'demo2', title: '新消费品牌电商主视觉', category: '电商视觉', year: '2024', desc: '搭建电商详情页的生成式生产管线，一套风格引擎批量产出全店素材。', tags: ['Stable Diffusion', 'ComfyUI', 'Photoshop'], image: demoArt(1) },
    { id: 'demo3', title: '涌现 · 生成艺术装置', category: '数字艺术', year: '2025', desc: '与美术馆合作的实时生成装置，观众行为实时参与画面演化。', tags: ['ComfyUI', 'TouchDesigner'], image: demoArt(2) },
    { id: 'demo4', title: '发布会 Key Visual', category: '活动视觉', year: '2024', desc: '新品发布会主 KV 与全套延展物料，3 天完成从概念到交付。', tags: ['Midjourney', 'After Effects'], image: demoArt(3) },
  ];

  /* ---------- DOM 工具（全部用 textContent 构建，防注入） ---------- */
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* ---------- 瀑布流布局引擎 ---------- */
  const waterfall = {
    gap: 24,
    layout() {
      const w = container.clientWidth;
      if (!w) return;
      const cols = w >= 980 ? 3 : w >= 620 ? 2 : 1;
      const cw = (w - this.gap * (cols - 1)) / cols;
      const heights = new Array(cols).fill(0);
      container.querySelectorAll('.wf-card').forEach((card) => {
        const col = heights.indexOf(Math.min(...heights));
        card.style.width = cw + 'px';
        card.style.transform = 'translate(' + (col * (cw + this.gap)) + 'px,' + heights[col] + 'px)';
        heights[col] += card.offsetHeight + this.gap;
      });
      container.style.height = (Math.max(...heights) - this.gap || 0) + 'px';
    },
  };

  /* ---------- 卡片构建 ---------- */
  function cardEl(p) {
    const card = el('article', 'wf-card');
    card.dataset.projectId = p.id || '';
    if ((p.id || '').startsWith('zero-era-')) card.classList.add('wf-card--video-cover');
    const fig = el('figure', 'wf-visual');
    if (p.video) {
      const video = el('video', 'wf-video');
      video.src = p.video;
      video.poster = p.image || '';
      video.controls = true;
      video.preload = 'metadata';
      video.playsInline = true;
      video.setAttribute('aria-label', p.title + ' 视频播放器');
      video.addEventListener('loadedmetadata', () => waterfall.layout());
      fig.appendChild(video);
    } else {
      const img = el('img');
      const isDetailPage = p.id === 'work-chair-detail' || p.id === 'work-mouse-detail';
      if (isDetailPage) {
        card.classList.add('wf-card--detail');
        img.className = 'wf-detail-preview';
      }
      img.classList.add('wf-image-expand');
      img.tabIndex = 0;
      img.setAttribute('role', 'button');
      img.setAttribute('aria-label', '点击查看完整图片：' + p.title);
      img.addEventListener('click', () => showDetail(p));
      img.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showDetail(p); }
      });
      img.src = p.image;
      img.alt = p.title || '项目图片';
      img.addEventListener('load', () => waterfall.layout());
      fig.appendChild(img);
    }
    if (p.year) fig.appendChild(el('span', 'work-year', p.year));
    card.appendChild(fig);

    const info = el('div', 'wf-info');
    const head = el('div', 'work-head');
    head.appendChild(el('h3', null, p.title));
    if (p.category) head.appendChild(el('span', 'work-cat', p.category));
    info.appendChild(head);
    if (p.desc) info.appendChild(el('p', 'work-desc', p.desc));
    if (Array.isArray(p.tags) && p.tags.length) {
      const tags = el('ul', 'work-tags');
      p.tags.forEach((t) => tags.appendChild(el('li', null, t)));
      info.appendChild(tags);
    }
    if (p.video) {
      const expand = el('button', 'work-watch-link work-video-open', '大屏播放');
      expand.type = 'button';
      expand.addEventListener('click', () => showVideoViewer(p, expand));
      info.appendChild(expand);
    }
    if (p.externalUrl) {
      const link = el('a', 'work-watch-link', '抖音观看');
      link.href = p.externalUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.setAttribute('aria-label', '在抖音观看：' + p.title);
      info.appendChild(link);
    }
    card.appendChild(info);
    return card;
  }

  /* ---------- 渲染 ---------- */
  function render(list) {
    container.innerHTML = '';
    if (!list || !list.length) {
      const empty = el('p', 'works-empty', '还没有发布项目。在后台添加第一个项目后，这里会以瀑布流展示。');
      container.appendChild(empty);
      container.style.height = '';
      return;
    }
    const frag = document.createDocumentFragment();
    list.forEach((p) => frag.appendChild(cardEl(p)));
    container.appendChild(frag);

    // 等全部图片加载完成再排版，保证高度准确
    const imgs = Array.from(container.querySelectorAll('.wf-card img'));
    Promise.all(imgs.map((i) => (i.complete ? Promise.resolve() : new Promise((r) => { i.onload = i.onerror = r; }))))
      .then(() => { waterfall.layout(); waterfall.layout(); });
  }

  async function load() {
    // 离线单文件版：使用内嵌数据（由 build_offline.py 注入）
    if (window.__EMBEDDED_PROJECTS) { render(window.__EMBEDDED_PROJECTS); return; }
    try {
      const res = await fetch('/api/projects');
      if (!res.ok) throw new Error('bad status');
      render(await res.json());
    } catch (e) {
      render(DEMO);   // 后端未启动：展示演示项目
    }
  }
  load();

  /* ---------- 重排时机 ---------- */
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => waterfall.layout(), 150);
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => waterfall.layout());
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) waterfall.layout();
    }).observe(container);
  }
})();
