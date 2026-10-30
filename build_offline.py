# -*- coding: utf-8 -*-
"""
生成离线预览目录：index.html 内嵌页面代码、项目数据、图片；视频作为独立媒体文件随目录播放。
用法：运行 python build_offline.py --out dist/index.html，随后打开 dist/index.html。
"""
import base64
import json
import os
import shutil
import re
import sys
import urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "作品集离线版.html")
API = os.environ.get("PORTFOLIO_API", "http://localhost:3000")

def read(p):
    with open(os.path.join(ROOT, p), encoding="utf-8") as f:
        return f.read()

def ensure_three():
    """确保 vendor/three.min.js 存在（发布环境克隆后自动下载）"""
    p = os.path.join(ROOT, "vendor", "three.min.js")
    if os.path.exists(p):
        return
    os.makedirs(os.path.dirname(p), exist_ok=True)
    urls = [
        "https://registry.npmmirror.com/three/0.160.0/files/build/three.min.js",
        "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js",
    ]
    for u in urls:
        try:
            with urllib.request.urlopen(u, timeout=60) as r:
                data = r.read()
            with open(p, "wb") as f:
                f.write(data)
            print("[下载] three.min.js", len(data), "bytes")
            return
        except Exception:
            continue
    print("[错误] three.min.js 下载失败，请检查网络后重试")
    sys.exit(1)

def inline_css(html):
    css = read("css/style.css")
    html = re.sub(
        r'<link rel="stylesheet" href="css/style\.css">',
        "<style>\n" + css + "\n</style>",
        html,
    )
    return html

def inline_portrait(html):
    """内嵌个人头像，保证 dist/index.html 可独立预览。"""
    rel = "uploads/works/portrait-jixiyan.jpg"
    path = os.path.join(ROOT, rel.replace("/", os.sep))
    if not os.path.isfile(path):
        return html
    with open(path, "rb") as f:
        data = base64.b64encode(f.read()).decode()
    return html.replace('src="' + rel + '"', 'src="data:image/jpeg;base64,' + data + '"')

def drop_web_fonts(html):
    # 离线版去掉网络字体（回退系统字体，观感接近）
    html = re.sub(r'<link rel="preconnect"[^>]*fonts\.loli\.net[^>]*>', "", html)
    html = re.sub(r'<link rel="stylesheet" href="https://fonts\.loli\.net[^"]*">', "", html)
    return html

def inline_scripts(html):
    # 内联本地脚本；three.js 注入在 projects.js 之前（hero-gallery 检测到 window.THREE 即跳过 CDN）
    three = "<script>\n" + read("vendor/three.min.js") + "\n</script>"
    html = html.replace('<script src="js/projects.js"></script>',
                        three + "\n  <script>\n" + read("js/projects.js") + "\n</script>")
    for src in ["js/hero-gallery.js", "js/main.js"]:
        html = html.replace('<script src="' + src + '"></script>',
                            "<script>\n" + read(src) + "\n</script>")
    return html

def embed_projects(html):
    """将项目数据与图片内嵌，支持后端在线和本地离线构建。"""
    try:
        with urllib.request.urlopen(API + "/api/projects", timeout=10) as r:
            projects = json.load(r)
    except Exception as e:
        try:
            projects = json.loads(read("server/data/projects.json"))
            print("[提示] 使用本地项目清单生成离线版：", e)
        except Exception as local_error:
            print("[提示] 无法读取项目数据，将使用前端演示项目：", local_error)
            return html
    for p in projects:
        image = p.get("image", "")
        if image.startswith("data:"):
            continue
        rel = image.lstrip("/\\")
        local_path = os.path.join(ROOT, rel.replace("/", os.sep))
        try:
            if os.path.isfile(local_path):
                with open(local_path, "rb") as f:
                    b = f.read()
            else:
                url_path = "/" + rel.replace("\\", "/")
                with urllib.request.urlopen(API + url_path, timeout=20) as r:
                    b = r.read()
            ext = os.path.splitext(local_path)[1].lower()
            mime = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml"}.get(ext, "application/octet-stream")
            p["image"] = "data:" + mime + ";base64," + base64.b64encode(b).decode()
        except Exception as e:
            print("[跳过图片]", p.get("title", "(未命名)"), e)
            p["image"] = ""
    payload = "<script>window.__EMBEDDED_PROJECTS = " + json.dumps(projects, ensure_ascii=False) + ";</script>"
    html = html.replace("</head>", payload + "\n</head>")
    return html

def copy_media(out_file):
    """将压缩后的网页视频复制到 HTML 同级目录，支持本地离线播放。"""
    source = os.path.join(ROOT, "media", "videos")
    if not os.path.isdir(source):
        return
    target = os.path.join(os.path.dirname(os.path.abspath(out_file)), "media", "videos")
    os.makedirs(target, exist_ok=True)
    for name in os.listdir(source):
        if not name.lower().endswith(".mp4"):
            continue
        src = os.path.join(source, name)
        dst = os.path.join(target, name)
        if os.path.abspath(src) != os.path.abspath(dst):
            shutil.copy2(src, dst)
    guide = os.path.join(os.path.dirname(os.path.abspath(out_file)), "使用说明.txt")
    with open(guide, "w", encoding="utf-8") as f:
        f.write("离线预览：直接打开 index.html。\n请保留同目录下的 media/videos 文件夹，视频项目从该目录播放。\nUnicorn Studio 首页动效需要联网加载。\n")

def main():
    out = OUT
    if "--out" in sys.argv:           # 发布模式：python build_offline.py --out dist/index.html
        out = os.path.join(ROOT, sys.argv[sys.argv.index("--out") + 1])
        os.makedirs(os.path.dirname(out), exist_ok=True)
    ensure_three()
    html = read("index.html")
    html = inline_css(html)
    html = inline_portrait(html)
    html = drop_web_fonts(html)
    html = embed_projects(html)
    html = inline_scripts(html)
    with open(out, "w", encoding="utf-8") as f:
        f.write(html)
    copy_media(out)
    print("已生成:", out, "(%.1f MB)" % (os.path.getsize(out) / 1048576))

if __name__ == "__main__":
    main()
