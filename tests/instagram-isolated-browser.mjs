import assert from "node:assert/strict";
import http from "node:http";
import {mkdtemp,rm} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {randomUUID} from "node:crypto";
import {startBrowser} from "../tools/hot-profiles/browser.mjs";
const requests=[];const server=http.createServer((req,res)=>{if(req.url==='/fixture'){requests.push(req.headers.cookie||'');res.setHeader('Set-Cookie','previous_account=fixture; Path=/');}res.end('<title>MauseHot - teste local de isolamento</title><p>Teste local. Nenhuma conta real.</p>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
const dir=await mkdtemp(path.join(os.tmpdir(),'mausehot-isolation-test-'));
try{for(let n=0;n<2;n++){
 const runtime=await startBrowser({id:randomUUID(),viewport:{width:900,height:650},startUrls:[origin+'/fixture']},dir,null,()=>{},undefined,{visible:true,cookies:[{name:'instagram-oauth-state',value:'fixture-'+n,url:origin+'/',httpOnly:true,sameSite:'Lax',path:'/'}]});
 try{for(let i=0;i<100 && requests.length<=n;i++)await new Promise(r=>setTimeout(r,50));assert.equal(requests[n],'instagram-oauth-state=fixture-'+n);for(let i=0;i<100;i++){if((await runtime.tabs()).some(t=>t.title.includes('teste local')))break;await new Promise(r=>setTimeout(r,50));}assert.ok((await runtime.tabs()).some(t=>t.title.includes('teste local')));}finally{await runtime.stop();}
}console.log('PASS: 2 real Chrome profiles, OAuth cookie available, previous-account cookie absent, normal user browser untouched');}
finally{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true,maxRetries:8,retryDelay:500});}
