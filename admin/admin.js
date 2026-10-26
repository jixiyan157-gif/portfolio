/* ============================================================
   作品集后台逻辑：登录 / 项目列表 / 新增 / 编辑 / 删除
   会话 Token 存 localStorage，请求统一带 Authorization 头
   ============================================================ */
(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const TOKEN_KEY = 'adminToken';

  const loginView = $('#view-login');
  const managerView = $('#view-manager');
  const loginForm = $('#login-form');
  const loginPw = $('#login-pw');
  const loginBtn = $('#login-btn');
  const loginError = $('#login-error');
  const listEl = $('#project-list');
  const listStatus = $('#list-status');
  const modal = $('#modal');
  const modalTitle = $('#modal-title');
  const projectForm = $('#project-form');
  const formError = $('#form-error');
  const imageInput = $('#image-input');
  const imagePreview = $('#image-preview');
  const imageLabel = $('#image-label');
  const saveBtn = $('#btn-save');

  let editingId = null;   // null = 新增，否则为编辑的项目 id
  let projects = [];

  /* ---------- 视图切换 ---------- */
  function show(view) {
    loginView.hidden = view !== 'login';
    managerView.hidden = view !== 'manager';
  }

  /* ---------- API 封装 ---------- */
  async function api(path, opts = {}) {
    const headers = Object.assign({}, opts.headers);
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) headers.Authorization = 'Bearer ' + token;
    if (opts.body && !(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
    const res = await fetch(path, Object.assign({}, opts, { headers }));
    if (res.status === 401) { logout(false); throw new Error('请重新登录'); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || '请求失败');
    return data;
  }

  /* ---------- 登录 / 退出 ---------- */
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.hidden = true;
    loginBtn.disabled = true;
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: loginPw.value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '登录失败');
      localStorage.setItem(TOKEN_KEY, data.token);
      loginPw.value = '';
      show('manager');
      loadList();
    } catch (err) {
      loginError.textContent = err.message;
      loginError.hidden = false;
    } finally {
      loginBtn.disabled = false;
    }
  });

  $('#btn-logout').addEventListener('click', () => logout(true));
  function logout(callApi) {
    if (callApi) {
      api('/api/logout', { method: 'POST' }).catch(() => {});
    }
    localStorage.removeItem(TOKEN_KEY);
    show('login');
  }

  /* ---------- 项目列表 ---------- */
  async function loadList() {
    listStatus.textContent = '加载中…';
    try {
      projects = await api('/api/projects');
      renderList();
      listStatus.textContent = projects.length
        ? '共 ' + projects.length + ' 个项目，前台按发布时间倒序展示'
        : '还没有项目，点击右上角「新增项目」开始添加。';
    } catch (err) {
      listStatus.textContent = err.message;
    }
  }

  function renderList() {
    listEl.innerHTML = '';
    projects.forEach((p) => {
      const li = document.createElement('li');
      li.className = 'prow';

      const thumb = document.createElement('img');
      thumb.className = 'prow-thumb';
      thumb.src = p.image;
      thumb.alt = p.title;

      const info = document.createElement('div');
      info.className = 'prow-info';
      const h = document.createElement('h3');
      h.textContent = p.title;
      info.appendChild(h);
      const meta = document.createElement('p');
      meta.className = 'prow-meta';
      const bits = [
        p.category || '未分类',
        p.year || '',
        p.createdAt ? new Date(p.createdAt).toLocaleDateString('zh-CN') : '',
      ].filter(Boolean);
      bits.forEach((b) => {
        const s = document.createElement('span');
        s.textContent = b;
        meta.appendChild(s);
      });
      info.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'prow-actions';
      const editBtn = document.createElement('button');
      editBtn.className = 'link-btn';
      editBtn.textContent = '编辑';
      editBtn.addEventListener('click', () => openModal(p));
      const delBtn = document.createElement('button');
      delBtn.className = 'link-btn danger';
      delBtn.textContent = '删除';
      delBtn.addEventListener('click', () => removeProject(p));
      actions.append(editBtn, delBtn);

      li.append(thumb, info, actions);
      listEl.appendChild(li);
    });
  }

  /* ---------- 新增 / 编辑弹窗 ---------- */
  function openModal(p) {
    editingId = p ? p.id : null;
    modalTitle.textContent = p ? '编辑项目' : '新增项目';
    formError.hidden = true;
    projectForm.reset();
    imagePreview.hidden = true;
    imagePreview.removeAttribute('src');
    imageLabel.textContent = p ? '项目图片（不选择则保留原图）' : '项目图片 *';
    if (p) {
      projectForm.elements.title.value = p.title || '';
      projectForm.elements.category.value = p.category || '';
      projectForm.elements.year.value = p.year || '';
      projectForm.elements.desc.value = p.desc || '';
      projectForm.elements.tags.value = (p.tags || []).join(', ');
      if (p.image) {
        imagePreview.src = p.image;
        imagePreview.hidden = false;
      }
    }
    modal.hidden = false;
    projectForm.elements.title.focus();
  }

  function closeModal() {
    modal.hidden = true;
    editingId = null;
  }
  $('#btn-cancel').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });

  /* 图片本地预览 */
  imageInput.addEventListener('change', () => {
    const f = imageInput.files && imageInput.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      imagePreview.src = reader.result;
      imagePreview.hidden = false;
    };
    reader.readAsDataURL(f);
  });

  /* 提交 */
  projectForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    formError.hidden = true;
    saveBtn.disabled = true;

    const fd = new FormData(projectForm);
    if (editingId && (!imageInput.files || !imageInput.files.length)) {
      fd.delete('image');   // 编辑且未选新图：保留原图
    }
    if (!editingId && (!imageInput.files || !imageInput.files.length)) {
      formError.textContent = '请上传项目图片';
      formError.hidden = false;
      saveBtn.disabled = false;
      return;
    }
    // 标签：逗号分隔字符串直接提交，后端解析
    fd.set('tags', String(fd.get('tags') || ''));

    try {
      if (editingId) {
        await api('/api/projects/' + editingId, { method: 'PUT', body: fd });
      } else {
        await api('/api/projects', { method: 'POST', body: fd });
      }
      closeModal();
      await loadList();
    } catch (err) {
      formError.textContent = err.message;
      formError.hidden = false;
    } finally {
      saveBtn.disabled = false;
    }
  });

  /* ---------- 删除 ---------- */
  async function removeProject(p) {
    if (!window.confirm('确定删除「' + p.title + '」？图片文件将一并删除，此操作不可恢复。')) return;
    try {
      await api('/api/projects/' + p.id, { method: 'DELETE' });
      await loadList();
    } catch (err) {
      window.alert(err.message);
    }
  }

  /* ---------- 入口 ---------- */
  $('#btn-add').addEventListener('click', () => openModal(null));

  if (localStorage.getItem(TOKEN_KEY)) {
    show('manager');
    loadList();
  } else {
    show('login');
  }
})();
