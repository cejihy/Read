// Service Worker for 极简电子书阅读器
const CACHE_NAME = 'reader-v1.0.0';
const STATIC_CACHE = 'reader-static-v1.0.0';
const DYNAMIC_CACHE = 'reader-dynamic-v1.0.0';

// 需要缓存的静态资源
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
  'https://cdn.jsdelivr.net/npm/epubjs@0.3/dist/epub.min.js',
  'https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js'
];

// 安装事件 - 缓存静态资源
self.addEventListener('install', (event) => {
  console.log('Service Worker 安装中...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('缓存静态资源');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('静态资源缓存完成');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('缓存静态资源失败:', error);
      })
  );
});

// 激活事件 - 清理旧缓存
self.addEventListener('activate', (event) => {
  console.log('Service Worker 激活中...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('删除旧缓存:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker 激活完成');
        return self.clients.claim();
      })
  );
});

// 消息事件 - 处理来自主线程的消息
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('收到跳过等待消息');
    self.skipWaiting();
  }
});

// 获取事件 - 处理网络请求
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 跳过非GET请求
  if (request.method !== 'GET') {
    return;
  }

  // 跳过Chrome扩展和开发者工具请求
  if (url.protocol === 'chrome-extension:' || url.hostname === 'chrome-devtools-frontend.appspot.com') {
    return;
  }

  // 处理静态资源请求
  if (isStaticAsset(request.url)) {
    event.respondWith(handleStaticAsset(request));
    return;
  }

  // 处理EPUB文件请求
  if (isEpubFile(request.url)) {
    event.respondWith(handleEpubFile(request));
    return;
  }

  // 处理其他请求 - 网络优先，缓存备用
  event.respondWith(handleDynamicRequest(request));
});

// 判断是否为静态资源
function isStaticAsset(url) {
  return STATIC_ASSETS.some(asset => url.includes(asset)) ||
         url.includes('cdn.jsdelivr.net') ||
         url.endsWith('.js') ||
         url.endsWith('.css') ||
         url.endsWith('.json');
}

// 判断是否为EPUB文件
function isEpubFile(url) {
  return url.endsWith('.epub') || url.includes('.epub');
}

// 处理静态资源 - 缓存优先
async function handleStaticAsset(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('处理静态资源失败:', error);
    return new Response('离线模式 - 无法加载资源', { status: 503 });
  }
}

// 处理EPUB文件 - 网络优先，缓存备用
async function handleEpubFile(request) {
  try {
    // 尝试从网络获取
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      // 缓存EPUB文件
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
  } catch (error) {
    console.log('网络获取EPUB失败，尝试从缓存获取');
  }

  // 从缓存获取
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  return new Response('EPUB文件不可用', { status: 404 });
}

// 处理动态请求 - 网络优先，缓存备用
async function handleDynamicRequest(request) {
  try {
    // 尝试从网络获取
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      // 缓存响应
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
  } catch (error) {
    console.log('网络请求失败，尝试从缓存获取');
  }

  // 从缓存获取
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  // 返回离线页面
  return new Response(`
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>离线 - 极简电子书阅读器</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          margin: 0;
          background: #f5f5f5;
          color: #333;
        }
        .container {
          text-align: center;
          padding: 2rem;
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          max-width: 400px;
        }
        h1 { color: #1f6eeb; margin-bottom: 1rem; }
        p { margin-bottom: 1rem; color: #666; }
        button {
          background: #1f6eeb;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 16px;
          cursor: pointer;
          transition: background 0.2s;
        }
        button:hover { background: #0056cc; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>📚 离线模式</h1>
        <p>当前处于离线状态，无法加载新内容。</p>
        <p>您可以继续阅读已缓存的书籍。</p>
        <button onclick="location.reload()">重新连接</button>
      </div>
    </body>
    </html>
  `, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

// 清理过期缓存
async function cleanupExpiredCache() {
  try {
    const cache = await caches.open(DYNAMIC_CACHE);
    const requests = await cache.keys();
    
    // 保留最近使用的100个文件
    if (requests.length > 100) {
      const sortedRequests = requests.sort((a, b) => {
        // 这里可以根据实际需求实现更复杂的清理策略
        return 0;
      });
      
      const toDelete = sortedRequests.slice(0, requests.length - 100);
      await Promise.all(toDelete.map(request => cache.delete(request)));
      console.log('清理了', toDelete.length, '个过期缓存');
    }
  } catch (error) {
    console.error('清理缓存失败:', error);
  }
}

// 定期清理缓存
setInterval(cleanupExpiredCache, 24 * 60 * 60 * 1000); // 每24小时清理一次
