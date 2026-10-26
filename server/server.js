/* ============================================================
   作品集轻量后端
   - 静态托管整站 + /uploads 图片
   - 项目数据存 server/data/projects.json（无需数据库）
   - 后台鉴权：密码登录 → Bearer Token（内存会话，12 小时有效）

   启动：   node server.js
   改密码： node server.js --set-password 新密码
   ============================================================ */
'use strict';

const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, '..');                  // 站点根目录
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'projects.json');   // 项目数据
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');   // 后台密码哈希
const UPLOAD_DIR = path.join(ROOT, 'uploads');            // 上传图片目录
const SESSION_TTL = 12 * 3600 * 1000;                     // 登录有效期

const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

/* ---------- 命令行：修改后台密码 ---------- */
if (process.argv.includes('--set-password')) {
  const pw = process.argv[process.argv.indexOf('--set-password') + 1];
  if (!pw) { console.log('用法: node server.js --set-password 新密码'); process.exit(1); }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({ passwordHash: sha256(pw) }, null, 2));
  console.log('后台密码已更新。');
  process.exit(0);
}

/* ---------- 配置 ---------- */
function loadConfig() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ passwordHash: sha256('admin123') }, null, 2));
    console.log('[提示] 已生成默认后台密码 admin123，请尽快运行 node server.js --set-password 新密码 修改');
  }
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
}
const config = loadConfig();

/* ---------- 项目数据读写 ---------- */
function loadProjects() {
  if (!fs.existsSync(DATA_FILE)) { fs.writeFileSync(DATA_FILE, '[]'); }
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch (e) { console.error('projects.json 解析失败：', e.message); return []; }
}
function saveProjects(list) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2));
}

/* ---------- 会话 ---------- */
const sessions = new Set();
function issueToken() {
  const t = crypto.randomBytes(24).toString('hex');
  sessions.add(t);
  setTimeout(() => sessions.delete(t), SESSION_TTL).unref();
  return t;
}

/* ---------- 图片上传 ---------- */
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, Date.now() + '-' + crypto.randomBytes(4).toString('hex') + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, ALLOWED_EXT.includes(path.extname(file.originalname).toLowerCase())),
});

/* ---------- 应用与中间件 ---------- */
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use('/server', (req, res) => res.status(404).end());  // 不暴露后端源码与数据文件
app.use(express.static(ROOT));
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));

function requireAuth(req, res, next) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (token && sessions.has(token)) return next();
  res.status(401).json({ error: '未登录或登录已过期' });
}

function parseTags(raw) {
  if (Array.isArray(raw)) return raw.map(String).map((s) => s.trim()).filter(Boolean).slice(0, 12);
  if (typeof raw === 'string') return raw.split(/[,，]/).map((s) => s.trim()).filter(Boolean).slice(0, 12);
  return [];
}

function removeImage(imagePath) {
  if (typeof imagePath !== 'string' || !imagePath.startsWith('/uploads/')) return;
  const abs = path.join(ROOT, imagePath.replace(/^\/+/, ''));
  if (abs.startsWith(UPLOAD_DIR + path.sep)) fs.unlink(abs, () => {});
}

/* ---------- 公开接口 ---------- */
app.get('/api/projects', (req, res) => {
  res.json(loadProjects().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
});

/* ---------- 鉴权 ---------- */
app.post('/api/login', (req, res) => {
  const got = sha256((req.body && req.body.password) || '');
  const want = config.passwordHash;
  if (got.length !== want.length || !crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want))) {
    return res.status(401).json({ error: '密码错误' });
  }
  res.json({ token: issueToken() });
});

app.post('/api/logout', requireAuth, (req, res) => {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  sessions.delete(token);
  res.json({ ok: true });
});

/* ---------- 项目增删改 ---------- */
app.post('/api/projects', requireAuth, upload.single('image'), (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.title || !String(b.title).trim()) return res.status(400).json({ error: '请填写项目标题' });
    if (!req.file) return res.status(400).json({ error: '请上传项目图片' });
    const p = {
      id: crypto.randomUUID(),
      title: String(b.title).trim().slice(0, 60),
      category: String(b.category || '').trim().slice(0, 20),
      year: String(b.year || '').trim().slice(0, 8),
      desc: String(b.desc || '').trim().slice(0, 200),
      tags: parseTags(b.tags),
      image: '/uploads/' + req.file.filename,
      createdAt: Date.now(),
    };
    const list = loadProjects(); list.push(p); saveProjects(list);
    res.json(p);
  } catch (e) { next(e); }
});

app.put('/api/projects/:id', requireAuth, upload.single('image'), (req, res, next) => {
  try {
    const list = loadProjects();
    const p = list.find((x) => x.id === req.params.id);
    if (!p) return res.status(404).json({ error: '项目不存在' });
    const b = req.body || {};
    if (!b.title || !String(b.title).trim()) return res.status(400).json({ error: '请填写项目标题' });
    p.title = String(b.title).trim().slice(0, 60);
    p.category = String(b.category || '').trim().slice(0, 20);
    p.year = String(b.year || '').trim().slice(0, 8);
    p.desc = String(b.desc || '').trim().slice(0, 200);
    p.tags = parseTags(b.tags);
    if (req.file) { removeImage(p.image); p.image = '/uploads/' + req.file.filename; }
    saveProjects(list);
    res.json(p);
  } catch (e) { next(e); }
});

app.delete('/api/projects/:id', requireAuth, (req, res) => {
  const list = loadProjects();
  const p = list.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: '项目不存在' });
  removeImage(p.image);
  saveProjects(list.filter((x) => x.id !== req.params.id));
  res.json({ ok: true });
});

/* ---------- 错误处理 ---------- */
app.use('/api', (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? '图片不能超过 15MB' : '图片上传失败' });
  }
  console.error(err);
  res.status(500).json({ error: '服务器出错了，请稍后再试' });
});
app.use('/api', (req, res) => res.status(404).json({ error: '接口不存在' }));

app.listen(PORT, () => {
  console.log('作品集服务已启动：');
  console.log('  前台  http://localhost:' + PORT);
  console.log('  后台  http://localhost:' + PORT + '/admin/');
});
