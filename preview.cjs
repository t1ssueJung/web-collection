const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const files = new Set(['index.html','styles.css','app.js','data.js','favicon.svg']);
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
http.createServer((req,res) => {
  const url = new URL(req.url,'http://localhost');
  const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  if(!files.has(file)){res.writeHead(404);return res.end('Not found');}
  fs.readFile(path.join(__dirname,file),(err,content)=>{if(err){res.writeHead(500);return res.end('Read error');}res.writeHead(200,{'Content-Type':mime[path.extname(file)],'Cache-Control':'no-store'});res.end(content);});
}).listen(4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173'));
