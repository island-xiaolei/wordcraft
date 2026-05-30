// Baidu API CORS Proxy — runs locally, proxies Baidu API calls with CORS headers
// Usage: node baidu-proxy.js
// Listens on port 8765

const http = require('http');

const BAIDU_API_KEY = '7KArEz1YWRoxSxcPdajvCEcm';
const BAIDU_SECRET_KEY = 'vtIHirWGgQjwc7fEieGbELkCyT3YdZt9';

const server = http.createServer((req, res) => {
  // CORS headers — allow any origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, 'http://localhost:8765');
  const path = url.pathname;

  let targetUrl, targetMethod, headers = {}, body = '';

  if (path === '/token') {
    targetUrl = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${BAIDU_API_KEY}&client_secret=${BAIDU_SECRET_KEY}`;
    targetMethod = 'POST';
  } else if (path === '/asr') {
    targetUrl = 'https://vop.baidu.com/server_api';
    targetMethod = 'POST';
    headers['Content-Type'] = 'application/json';
  } else {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }

  // Collect body for POST requests
  let chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    body = Buffer.concat(chunks).toString();

    const options = {
      method: targetMethod,
      headers: Object.assign({
        'Content-Type': path === '/asr' ? 'application/json' : 'application/x-www-form-urlencoded',
      }, headers),
    };

    const proxyReq = (targetUrl.startsWith('https') ? require('https') : require('http')).request(targetUrl, options, proxyRes => {
      let data = [];
      proxyRes.on('data', c => data.push(c));
      proxyRes.on('end', () => {
        const fullData = Buffer.concat(data);
        res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'application/json');
        res.writeHead(proxyRes.statusCode);
        res.end(fullData);
      });
    });

    proxyReq.on('error', e => {
      console.error('Proxy error:', e.message);
      res.writeHead(502);
      res.end(JSON.stringify({ error: 'proxy_error', message: e.message }));
    });

    if (body) proxyReq.write(body);
    proxyReq.end();
  });
});

server.listen(8765, () => {
  console.log('Baidu CORS proxy running on http://localhost:8765');
  console.log('  /token — Baidu OAuth token');
  console.log('  /asr  — Baidu ASR (speech recognition)');
});
