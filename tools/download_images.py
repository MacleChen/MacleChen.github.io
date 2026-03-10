#!/usr/bin/env python3
"""
Download all external images in posts/*.md and replace URLs with local paths.

Usage: python3 tools/download_images.py
"""

import re
import os
import sys
import ssl
import hashlib
import glob
import time
import subprocess
import urllib.request
import urllib.parse
import urllib.error
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock

# ── Config ──────────────────────────────────────────────────────────────────
POSTS_DIR   = Path(__file__).parent.parent / 'posts'
IMAGES_DIR  = Path(__file__).parent.parent / 'images' / 'posts'
LOCAL_BASE  = 'images/posts'       # path used inside markdown
TIMEOUT     = 20                   # seconds per request
WORKERS     = 12                   # concurrent downloads
MAX_RETRIES = 2

# Disable SSL certificate verification (many old CDNs use self-signed certs)
SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE

HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/122.0.0.0 Safari/537.36'
    ),
}

IMG_PATTERN = re.compile(
    r'(!\[[^\]]*\]\()('
    r'https?://[^\s\)"\']+'
    r'\.(?:png|jpg|jpeg|gif|webp|svg)'
    r'(?:\?[^\s\)"\']*)?)(\))',
    re.IGNORECASE
)

print_lock = Lock()

def log(msg):
    with print_lock:
        print(msg, flush=True)

# ── Helpers ──────────────────────────────────────────────────────────────────
def url_to_local_name(url: str) -> str:
    """Stable local filename: md5(url) + original extension."""
    parsed = urllib.parse.urlparse(url)
    path   = parsed.path.lower()
    ext    = os.path.splitext(path)[1]
    # Normalise extension
    if ext not in ('.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'):
        ext = '.jpg'
    uid = hashlib.md5(url.encode()).hexdigest()[:12]
    return uid + ext

def download_image(url: str, dest: Path) -> bool:
    """Download url → dest. Returns True on success."""
    if dest.exists() and dest.stat().st_size > 0:
        return True  # already cached

    req = urllib.request.Request(url, headers=HEADERS)
    for attempt in range(1, MAX_RETRIES + 2):
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT, context=SSL_CTX) as resp:
                data = resp.read()
            if len(data) < 64:      # suspiciously small → probably an error page
                return False
            dest.write_bytes(data)
            return True
        except Exception:
            if attempt <= MAX_RETRIES:
                time.sleep(0.5 * attempt)
            else:
                return False
    return False

# ── Step 1: Collect all unique image URLs ────────────────────────────────────
def collect_urls():
    url_to_file: dict[str, set] = {}   # url → set of md files containing it
    for md_path in sorted(POSTS_DIR.glob('*.md')):
        text = md_path.read_text(encoding='utf-8', errors='ignore')
        for m in IMG_PATTERN.finditer(text):
            url = m.group(2).split('?')[0]   # strip query string for file key
            url_to_file.setdefault(url, set()).add(md_path)
    return url_to_file

# ── Step 2: Download images concurrently ─────────────────────────────────────
def download_all(url_to_file):
    urls     = list(url_to_file.keys())
    total    = len(urls)
    ok_map   = {}   # url → local filename (only for successes)
    failed   = []
    done     = 0

    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    def task(url):
        name = url_to_local_name(url)
        dest = IMAGES_DIR / name
        ok   = download_image(url, dest)
        return url, name, ok

    log(f'\n📥  Downloading {total} unique images with {WORKERS} workers …\n')
    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        futures = {ex.submit(task, u): u for u in urls}
        for fut in as_completed(futures):
            url, name, ok = fut.result()
            done += 1
            if ok:
                ok_map[url] = name
                log(f'  ✓ [{done}/{total}] {name}')
            else:
                failed.append(url)
                log(f'  ✗ [{done}/{total}] FAIL  {url[:80]}')

    return ok_map, failed

# ── Step 3: Rewrite markdown files ───────────────────────────────────────────
def rewrite_md_files(ok_map):
    changed = 0
    skipped = 0

    def replacer(m):
        url_raw = m.group(2)
        url_key = url_raw.split('?')[0]
        if url_key in ok_map:
            local = f'{LOCAL_BASE}/{ok_map[url_key]}'
            return m.group(1) + local + m.group(3)
        return m.group(0)   # leave as-is if download failed

    for md_path in sorted(POSTS_DIR.glob('*.md')):
        original = md_path.read_text(encoding='utf-8', errors='ignore')
        updated  = IMG_PATTERN.sub(replacer, original)
        if updated != original:
            md_path.write_text(updated, encoding='utf-8')
            changed += 1
        else:
            skipped += 1

    return changed, skipped

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print('🔍  Scanning posts for image URLs …')
    url_to_file = collect_urls()
    print(f'    Found {len(url_to_file)} unique image URLs across {len(list(POSTS_DIR.glob("*.md")))} posts.\n')

    ok_map, failed = download_all(url_to_file)

    print(f'\n📝  Rewriting markdown files …')
    changed, skipped = rewrite_md_files(ok_map)

    print('\n' + '─' * 60)
    print(f'  ✅  Downloaded : {len(ok_map):4d} images')
    print(f'  ❌  Failed     : {len(failed):4d} images  (links kept as-is)')
    print(f'  📄  MD updated : {changed:4d} files')
    print(f'  📄  MD unchanged:{skipped:4d} files')

    if failed:
        fail_log = Path(__file__).parent / 'failed_images.txt'
        fail_log.write_text('\n'.join(failed), encoding='utf-8')
        print(f'\n  Failed URLs saved to: {fail_log}')

    print('\nDone. Run git add + commit when satisfied.')

if __name__ == '__main__':
    main()
