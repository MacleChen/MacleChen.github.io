#!/usr/bin/env python3
"""
CSDN 博客迁移脚本
- 通过 CSDN API 获取全部公开文章列表
- 抓取每篇正文并转换为 Markdown
- 保存到 posts/{id}.md
- 生成 js/posts.js（仅元数据，正文独立存储）
支持断点续传：已下载的文章自动跳过
"""

import requests, json, os, time, re, sys
from bs4 import BeautifulSoup
import markdownify as md_lib

# ─── 配置 ────────────────────────────────────────────────
USERNAME = 'yishengzhiai005'
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POSTS_DIR = os.path.join(BASE_DIR, 'posts')
JS_FILE   = os.path.join(BASE_DIR, 'js', 'posts.js')
DELAY     = 0.65   # 每篇请求间隔（秒），避免被封
PAGE_SIZE = 40
# ────────────────────────────────────────────────────────

HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/122.0.0.0 Safari/537.36'
    ),
    'Referer': f'https://blog.csdn.net/{USERNAME}',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
}


def categorize(tags: list, title: str) -> str:
    text = ' '.join(tags + [title]).lower()
    if any(k in text for k in ['逆向', 'reverse', 'frida', 'hook', 'tweak',
                                'jailbreak', 'crack', 'dylib', 'inject', 'ida',
                                'hopper', 'lldb', 'mach-o', 'fishhook']):
        return '逆向开发'
    if any(k in text for k in ['android', 'kotlin', 'gradle', 'apk', 'dalvik']):
        return 'Android开发'
    if any(k in text for k in ['python', 'crawler', 'spider', '爬虫', 'scrapy',
                                'selenium', 'beautifulsoup', 'requests']):
        return 'Python'
    if any(k in text for k in ['java', 'spring', 'maven', 'mybatis',
                                'backend', '后端', 'springboot']):
        return 'Java后端'
    if any(k in text for k in ['vue', 'react', 'html', 'css', 'javascript',
                                'typescript', 'webpack', 'node', 'frontend', '前端']):
        return 'Web开发'
    if any(k in text for k in ['flutter', 'dart']):
        return 'Flutter'
    return 'iOS开发'


def get_all_articles() -> list:
    articles, page = [], 1
    total = None
    while True:
        try:
            r = requests.get(
                'https://blog.csdn.net/community/home-api/v1/get-business-list',
                params={'page': page, 'size': PAGE_SIZE,
                        'businessType': 'blog', 'username': USERNAME},
                headers=HEADERS, timeout=15
            )
            data = r.json().get('data', {})
            if total is None:
                total = data.get('total', '?')
            items = data.get('list', [])
            if not items:
                break
            articles.extend(items)
            sys.stdout.write(f'\r  获取列表… {len(articles)}/{total}')
            sys.stdout.flush()
            page += 1
            time.sleep(0.3)
        except Exception as e:
            print(f'\n  第 {page} 页失败: {e}')
            break
    print(f'\n  列表获取完毕，共 {len(articles)} 篇')
    return articles


def fetch_content(url: str, retries: int = 2) -> str:
    for attempt in range(retries + 1):
        try:
            r = requests.get(url, headers=HEADERS, timeout=20)
            r.encoding = 'utf-8'
            soup = BeautifulSoup(r.text, 'html.parser')
            el = soup.select_one('#content_views')
            if not el:
                return ''
            # 清理无用标签
            for tag in el.select('style, script, .hide-article-box, '
                                 '.article-end-bar, .article-copyright'):
                tag.decompose()
            # data-src → src
            for img in el.select('img[data-src]'):
                img['src'] = img['data-src']
                del img['data-src']
                if not img.get('alt'):
                    img['alt'] = ''
            text = md_lib.markdownify(
                str(el),
                heading_style='ATX',
                bullets='-',
                strip=['style', 'script'],
            )
            text = re.sub(r'\n{3,}', '\n\n', text)
            text = re.sub(r'[ \t]+$', '', text, flags=re.MULTILINE)
            return text.strip()
        except Exception as e:
            if attempt < retries:
                time.sleep(1.2)
            else:
                return f'> 内容抓取失败：{str(e)[:120]}'
    return ''


def js_str(s: str) -> str:
    """转义为 JS 模板字符串内容"""
    return s.replace('\\', '\\\\').replace('`', '\\`').replace('${', '\\${')


def write_posts_js(posts: list):
    lines = [
        '// 博客文章元数据（正文存储在 posts/{id}.md，由 post.html 动态加载）',
        '// 新增博文：添加元数据条目，并在 posts/ 目录放对应的 .md 文件',
        '',
        'const POSTS = [',
    ]
    for p in posts:
        tags_js = json.dumps(p['tags'], ensure_ascii=False)
        lines += [
            '  {',
            f'    id: {json.dumps(p["id"])},',
            f'    title: `{js_str(p["title"])}`,',
            f'    date: {json.dumps(p["date"])},',
            f'    category: {json.dumps(p["category"])},',
            f'    tags: {tags_js},',
            f'    summary: `{js_str(p["summary"])}`,',
            f'    cover: "",',
            f'    csdn_url: {json.dumps(p["csdn_url"])},',
            '  },',
        ]
    lines.append('];')
    with open(JS_FILE, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))


def main():
    os.makedirs(POSTS_DIR, exist_ok=True)

    print('╔══════════════════════════════╗')
    print('║    CSDN → 个人博客迁移工具    ║')
    print('╚══════════════════════════════╝')
    print(f'  用户名: {USERNAME}')
    print(f'  输出目录: {BASE_DIR}')
    print()

    # ── Step 1: 获取文章列表 ──────────────────────────────
    print('【1/3】获取文章列表…')
    articles = get_all_articles()
    if not articles:
        print('未获取到任何文章，退出。')
        return

    # ── Step 2: 逐篇抓取内容 ─────────────────────────────
    print(f'\n【2/3】抓取正文（共 {len(articles)} 篇，支持断点续传）…\n')
    posts_meta = []
    new_cnt = skip_cnt = fail_cnt = 0

    for i, item in enumerate(articles):
        aid   = str(item['articleId'])
        title = item.get('title', '无标题').strip()
        url   = item.get('url', '')
        date  = item.get('postTime', '2024-01-01')[:10]
        tags  = item.get('tags', [])
        if isinstance(tags, str):
            tags = [t.strip() for t in tags.split(',') if t.strip()]
        summary = re.sub(r'\s+', ' ', item.get('description', '')).strip()[:300]
        category = categorize(tags, title)
        md_path  = os.path.join(POSTS_DIR, f'{aid}.md')
        prefix   = f'[{i+1:3d}/{len(articles)}]'

        if os.path.exists(md_path) and os.path.getsize(md_path) > 20:
            skip_cnt += 1
            sys.stdout.write(f'\r{prefix} ✓ {title[:50]:<50}')
            sys.stdout.flush()
        else:
            sys.stdout.write(f'\r{prefix} ↓ {title[:50]:<50}')
            sys.stdout.flush()
            content = fetch_content(url)
            if content:
                with open(md_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                new_cnt += 1
            else:
                fail_cnt += 1
            time.sleep(DELAY)

        posts_meta.append({
            'id': aid, 'title': title, 'date': date,
            'category': category, 'tags': tags,
            'summary': summary, 'csdn_url': url,
        })

    print(f'\n\n  结果: 新增 {new_cnt} 篇，跳过 {skip_cnt} 篇，失败 {fail_cnt} 篇')

    # ── Step 3: 生成 posts.js ─────────────────────────────
    print('\n【3/3】生成 js/posts.js…')
    posts_meta.sort(key=lambda x: x['date'], reverse=True)
    write_posts_js(posts_meta)
    print(f'  完成，写入 {len(posts_meta)} 条元数据')

    print('\n╔════════════════════════════════╗')
    print('║          迁移完成！             ║')
    print('╚════════════════════════════════╝')
    print(f'  Markdown 文件: posts/  ({new_cnt + skip_cnt} 个)')
    print(f'  元数据文件:    js/posts.js')
    print()
    print('  下一步：git add -A && git commit && git push')


if __name__ == '__main__':
    main()
