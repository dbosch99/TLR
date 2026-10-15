import http from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.md':'text/plain; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
  try {
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
    const decoded=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(decoded.split('/').some(s=>s.startsWith('.'))){res.writeHead(404);res.end('Non trovato');return;}
    let file=path.resolve(root,`.${decoded}`);
    if((await stat(file)).isDirectory())file=path.join(file,'index.html');
    file=await realpath(file);
    if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    const body=await readFile(file);
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    res.end(req.method==='HEAD'?undefined:body);
  }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Non trovato');}
});
let fallback=false;
server.on('error',error=>{if(error.code==='EADDRINUSE'&&!fallback){fallback=true;server.listen(0,'127.0.0.1');}else{console.error(error.message);process.exit(1);}});
server.on('listening',()=>{console.log(`TLR · Anteprima locale\nhttp://127.0.0.1:${server.address().port}\nPremi Ctrl+C per terminare.`);});
server.listen(Number(process.env.PORT)||4173,'127.0.0.1');
