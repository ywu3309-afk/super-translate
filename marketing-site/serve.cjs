'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const pages = new Map([['/', 'index.html'], ['/index.html', 'index.html'], ['/style.css', 'style.css'], ['/app.js', 'app.js']]);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
http.createServer((request, response) => {
  const file = pages.get(new URL(request.url, 'http://127.0.0.1').pathname);
  if (!file || !['GET', 'HEAD'].includes(request.method)) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'Content-Type': types[path.extname(file)], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'none'; frame-ancestors 'none'; form-action 'none'; base-uri 'none'" });
  response.end(request.method === 'HEAD' ? undefined : fs.readFileSync(path.join(__dirname, file)));
}).listen(4176, '127.0.0.1', () => console.log('Local draft: http://127.0.0.1:4176'));
