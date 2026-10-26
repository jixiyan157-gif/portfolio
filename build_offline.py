# -*- coding: utf-8 -*-
"""
生成「作品集离线版.html」—— 单文件、无需联网、任何浏览器直接打开
打包内容：全部页面 + 样式 + 脚本 + three.js + 后台项目数据与图片（base64）
用法：先启动后端（cd server && npm start），再运行  python build_offline.py
"""
import base64
import json
import os
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
    """从后端拉取项目数据与图片，注入为 window.__EMBEDDED_PROJECTS"""
    try:
        with urllib.request.urlopen(API + "/api/projects", timeout=10) as r:
            projects = json.load(r)
    except Exception as e:
        print("[提示] 无法连接后端，离线版将使用内置演示项目：", e)
        return html
    for p in projects:
        try:
            with urllib.request.urlopen(API + p["image"], timeout=20) as r:
                b = r.read()
            p["image"] = "data:image/png;base64," + base64.b64encode(b).decode()
        except Exception as e:
            print("[跳过图片]", p["title"], e)
            p["image"] = ""
    payload = "<script>window.__EMBEDDED_PROJECTS = " + json.dumps(projects, ensure_ascii=False) + ";</script>"
    html = html.replace("</head>", payload + "\n</head>")
    return html

def main():
    out = OUT
    if "--out" in sys.argv:           # 发布模式：python build_offline.py --out dist/index.html
        out = os.path.join(ROOT, sys.argv[sys.argv.index("--out") + 1])
        os.makedirs(os.path.dirname(out), exist_ok=True)
    ensure_three()
    html = read("index.html")
    html = inline_css(html)
    html = drop_web_fonts(html)
    html = embed_projects(html)
    html = inline_scripts(html)
    with open(out, "w", encoding="utf-8") as f:
        f.write(html)
    print("已生成:", out, "(%.1f MB)" % (os.path.getsize(out) / 1048576))

if __name__ == "__main__":
    main()
