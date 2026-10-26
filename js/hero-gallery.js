/* ============================================================
   首屏 Hero · 3D 唱片画廊（参考 unicorn.studio CD Gallery）
   - 4 张唱片横向排列，滚动浏览：
     桌面：鼠标左右移动 → 画廊横向滚动跟随 + 相机微视差 + 光标灯光
     移动端：横向滑动 → 惯性滚动
   - 封面取后台 /api/projects 前 4 张项目图片
     （无后端或无项目时使用程序生成的占位封面）
   - 降级：three.js 加载失败 / 不支持 WebGL 时保留原粒子背景
   - 尊重 prefers-reduced-motion：仅渲染静态帧
   ============================================================ */
(() => {
  'use strict';

  const canvas = document.getElementById('hero-gallery');
  if (!canvas) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CDN_LIST = [
    'https://registry.npmmirror.com/three/0.160.0/files/build/three.min.js',
    'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js',
    'https://unpkg.com/three@0.160.0/build/three.min.js',
  ];

  /* ---------- three.js 按序加载 ---------- */
  function loadThree(tryIndex, done) {
    if (window.THREE) return done();
    if (tryIndex >= CDN_LIST.length) return done(new Error('three.js 加载失败'));
    const s = document.createElement('script');
    s.src = CDN_LIST[tryIndex];
    s.onload = () => done();
    s.onerror = () => loadThree(tryIndex + 1, done);
    document.head.appendChild(s);
  }

  /* ---------- 程序生成占位封面（亮色调，参考视频的专辑封面质感） ---------- */
  function makeCoverTexture(i) {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d');
    const palettes = [
      ['#2e7d8c', '#5fd9ff', '#b8f4ff'],   // 青绿
      ['#8c3a4e', '#ff8fa8', '#ffd9e2'],   // 玫红
      ['#7a6a2e', '#e8c86a', '#fff0b8'],   // 金
      ['#5a4a8c', '#c9a6ff', '#ece2ff'],   // 紫
    ];
    const [base, a1, a2] = palettes[i % 4];

    // 亮色渐变底：整面保持高亮度，边缘不过暗
    const bg = g.createRadialGradient(200, 170, 30, 256, 256, 420);
    bg.addColorStop(0, a2);
    bg.addColorStop(0.45, a1);
    bg.addColorStop(0.85, a1 + 'cc');
    bg.addColorStop(1, base);
    g.fillStyle = bg;
    g.fillRect(0, 0, 512, 512);

    // 彩色光斑（布满碟面，参考视频的饱和色块）
    const blob = g.createRadialGradient(390, 120, 10, 390, 120, 180);
    blob.addColorStop(0, 'rgba(255,255,255,.75)'); blob.addColorStop(0.4, a2 + 'aa'); blob.addColorStop(1, 'transparent');
    g.fillStyle = blob;
    g.beginPath(); g.arc(390, 120, 180, 0, Math.PI * 2); g.fill();

    const blob2 = g.createRadialGradient(90, 400, 10, 90, 400, 170);
    blob2.addColorStop(0, 'rgba(255,255,255,.5)'); blob2.addColorStop(0.4, a1 + '99'); blob2.addColorStop(1, 'transparent');
    g.fillStyle = blob2;
    g.beginPath(); g.arc(90, 400, 170, 0, Math.PI * 2); g.fill();

    // 唱片沟槽同心环（明显可见）
    g.strokeStyle = 'rgba(255,255,255,.2)';
    for (let r = 58; r < 250; r += 10) {
      g.beginPath(); g.arc(256, 256, r, 0, Math.PI * 2); g.stroke();
    }

    // 中心亮区（呼应参考视频唱片的白色中心）
    const hub = g.createRadialGradient(256, 256, 10, 256, 256, 130);
    hub.addColorStop(0, 'rgba(255,255,255,.95)');
    hub.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = hub;
    g.beginPath(); g.arc(256, 256, 130, 0, Math.PI * 2); g.fill();

    // 细颗粒
    g.fillStyle = 'rgba(255,255,255,.1)';
    for (let n = 0; n < 280; n++) {
      g.fillRect(Math.random() * 512, Math.random() * 512, 1.4, 1.4);
    }
    return new THREE.CanvasTexture(c);
  }

  /* ---------- 封面适配（cover 裁切，避免拉伸变形） ---------- */
  function fitTexture(tex) {
    const img = tex.image;
    if (!img || !img.width) return;
    const a = img.width / img.height;
    if (a > 1) { tex.repeat.set(1, 1 / a); tex.offset.set(0, (1 - 1 / a) / 2); }
    else { tex.repeat.set(a, 1); tex.offset.set((1 - a) / 2, 0); }
  }

  /* ---------- 构建场景 ---------- */
  function build() {
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);
    camera.position.set(0, 0, 9);
    scene.add(camera);

    // 灯光：环境 + 双色点光 + 跟随光标的点光
    scene.add(new THREE.AmbientLight(0x99a2c4, 0.9));
    const violet = new THREE.PointLight(0x8b8fff, 34, 26, 2);
    violet.position.set(-5, 3, 4);
    scene.add(violet);
    const cyan = new THREE.PointLight(0x5fd9ff, 26, 26, 2);
    cyan.position.set(6, -3, 3);
    scene.add(cyan);
    const cursorLight = new THREE.PointLight(0xffffff, 22, 16, 2);
    cursorLight.position.set(0, 0, 3.5);
    scene.add(cursorLight);

    // 唱片行（整体作为滚动主体）
    const group = new THREE.Group();
    scene.add(group);

    /* 单张唱片（几何半径 1，外观尺寸由 depth 与透视决定）
       注意：圆环几何直接 rotateX，封面/轴心保持正对相机 */
    function makeDisc(texture, phase, depth) {
      const disc = new THREE.Group();
      const rim = new THREE.Mesh(
        new THREE.CylinderGeometry(1, 1, 0.05, 64).rotateX(Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0x4a5478, metalness: 0.9, roughness: 0.22 })
      );
      disc.add(rim);
      const art = new THREE.Mesh(
        new THREE.RingGeometry(0.2, 1, 64),
        new THREE.MeshBasicMaterial({ map: texture, toneMapped: false })
      );
      art.position.z = 0.027;
      disc.add(art);
      const hub = new THREE.Mesh(
        new THREE.CircleGeometry(0.2, 32),
        new THREE.MeshBasicMaterial({ color: 0xe8ecf5 })
      );
      hub.position.z = 0.028;
      disc.add(hub);

      disc.rotation.z = (Math.random() - 0.5) * 0.3;
      disc.userData.phase = phase;
      disc.userData.baseZ = depth;
      return disc;
    }

    /* 4 张唱片横向排列：大尺寸 + 纵深错落（近大远小，参考视频的结构） */
    const depths = [-1.7, -0.3, 0.9, 1.6];   // 越近越大
    const discs = [];
    for (let i = 0; i < 4; i++) {
      const tex = i < coverList.length ? coverList[i] : makeCoverTexture(i);
      const disc = makeDisc(tex, i * 1.1, depths[i]);
      disc.position.set(
        (i - 1.5) * 4.4,
        (Math.random() - 0.5) * 0.9,
        depths[i]
      );
      disc.userData.baseRot = disc.rotation.z;
      group.add(disc);
      discs.push(disc);
    }

    /* ---------- 滚动状态 ---------- */
    const scroll = { value: 0, target: 0, velocity: 0 };
    const pointer = { x: 0, y: 0 };
    const camTarget = { x: 0, y: 0 };
    let visibleW = 10;       // 相机在 z=0 平面可见宽度（世界单位）
    let viewportW = 1;

    function unitsPerPx() {
      return visibleW / (viewportW * group.scale.x);
    }

    /* 桌面：鼠标左右移动 → 画廊滚动跟随 */
    if (window.matchMedia('(pointer: fine)').matches) {
      window.addEventListener('pointermove', (e) => {
        pointer.x = (e.clientX / window.innerWidth - 0.5) * 2;
        pointer.y = (e.clientY / window.innerHeight - 0.5) * 2;
        if (!reduceMotion) {
          scroll.target = pointer.x * 1.2;
          camTarget.x = pointer.x * 0.16;
          camTarget.y = -pointer.y * 0.1;
        }
      });
    }

    /* 移动端：横向滑动 → 惯性滚动（纵向滑动交给页面） */
    let touchStart = null;
    const hero = canvas.closest('.hero') || document.body;
    hero.addEventListener('touchstart', (e) => {
      touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY, scroll: scroll.value, last: scroll.value };
      scroll.velocity = 0;
    }, { passive: true });
    hero.addEventListener('touchmove', (e) => {
      if (!touchStart) return;
      const dx = e.touches[0].clientX - touchStart.x;
      const dy = e.touches[0].clientY - touchStart.y;
      if (Math.abs(dx) > Math.abs(dy)) {
        e.preventDefault();   // 横向手势由画廊接管
        const next = touchStart.scroll - dx * unitsPerPx();
        scroll.velocity = (next - touchStart.last) * 0.25;   // 惯性
        touchStart.last = next;
        scroll.value = scroll.target = next;
      } else {
        touchStart = null;    // 纵向：交还页面滚动
      }
    }, { passive: false });
    hero.addEventListener('touchend', () => { touchStart = null; });

    /* ---------- 尺寸适配 ---------- */
    function resize() {
      viewportW = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      renderer.setSize(viewportW, h, false);
      camera.aspect = viewportW / h;
      camera.updateProjectionMatrix();
      visibleW = Math.tan(THREE.MathUtils.degToRad(21)) * 9 * 2 * camera.aspect;
      // 唱片直径约为可见宽度的 24%（近处约 29%，与参考视频一致），窄屏靠滚动浏览
      group.scale.setScalar(Math.min(1, visibleW * 0.12));
    }
    resize();
    window.addEventListener('resize', resize);

    /* ---------- 动画 ---------- */
    let running = true;
    const clock = new THREE.Clock();

    function tick() {
      if (!running) return;
      const t = clock.getElapsedTime();

      // 惯性
      if (!touchStart) {
        scroll.value += scroll.velocity;
        scroll.velocity *= 0.94;
        if (Math.abs(scroll.velocity) < 0.0004) scroll.velocity = 0;
      }
      // 目标平滑跟随
      scroll.value += (scroll.target - scroll.value) * 0.06;
      // 越界回弹
      scroll.value = Math.max(-1.2, Math.min(1.2, scroll.value));
      group.position.x = scroll.value * 2.4;

      camera.rotation.y += (camTarget.x - camera.rotation.y) * 0.05;
      camera.rotation.x += (camTarget.y - camera.rotation.x) * 0.05;
      camera.position.y = Math.cos(t * 0.2) * 0.06;

      cursorLight.position.x = pointer.x * 3.6;
      cursorLight.position.y = -pointer.y * 2.4;
      cursorLight.position.z = 3.5;

      for (const d of discs) {
        const ph = d.userData.phase;
        d.position.z = d.userData.baseZ + Math.sin(t * 0.55 + ph) * 0.07;
        d.rotation.z = d.userData.baseRot + Math.sin(t * 0.35 + ph) * 0.025;
      }
      renderer.render(scene, camera);
      requestAnimationFrame(tick);
    }

    if (reduceMotion) {
      renderer.render(scene, camera);
    } else {
      tick();
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { running = false; }
      else if (!reduceMotion) { running = true; clock.getDelta(); tick(); }
    });

    // 通知 main.js：画廊已接管，停用粒子背景
    window.dispatchEvent(new CustomEvent('hero-gallery-active'));

    // 调试/测试钩子
    window.__heroGallery = {
      discCount: discs.length,
      scrollValue: () => scroll.value,
    };
  }

  /* ---------- 封面来源：后台项目图片 → 程序占位 ---------- */
  let coverList = [];

  function texturesFrom(items) {
    const loader = new THREE.TextureLoader();
    return items.slice(0, 4).map((p) => {
      const src = p.image;
      // 内嵌 data URI：three r160 的 TextureLoader 会返回空 image，需自建 Image
      if (typeof src === 'string' && src.startsWith('data:')) {
        const img = new Image();
        const tex = new THREE.Texture(img);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
        img.onload = () => { tex.needsUpdate = true; fitTexture(tex); };
        img.src = src;
        return tex;
      }
      const tex = loader.load(src);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      const onSet = () => fitTexture(tex);
      if (tex.image && tex.image.width) onSet();
      else if (tex.image) tex.image.addEventListener('load', onSet);
      return tex;
    });
  }

  async function collectCovers() {
    // 离线单文件版：使用内嵌数据（由 build_offline.py 注入）
    if (window.__EMBEDDED_PROJECTS && window.__EMBEDDED_PROJECTS.length) {
      coverList = texturesFrom(window.__EMBEDDED_PROJECTS);
      return;
    }
    try {
      const res = await fetch('/api/projects');
      if (!res.ok) throw new Error('bad status');
      const items = await res.json();
      if (items.length) coverList = texturesFrom(items);
    } catch (e) { /* 无后端：全部使用占位封面 */ }
  }

  loadThree(0, async (err) => {
    if (err) return;   // 加载失败：保留原粒子背景
    try {
      await collectCovers();
      build();
    } catch (e) {
      console.error('Hero 画廊初始化失败：', e);
    }
  });
})();
