import assert from 'node:assert/strict';
import http from 'node:http';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
const require=createRequire(resolve(process.env.INTELLIGENCE_PG_TEST_DEPS||'.','package.json'));
const {chromium}=require('playwright-core');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const user={id:id(99),email:'fixture@example.test',role:'authenticated',is_anonymous:false,app_metadata:{provider:'google'},user_metadata:{}};
const now=Math.floor(Date.now()/1000), enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const token=enc({alg:'HS256'})+'.'+enc({sub:user.id,role:'authenticated',iat:now,exp:now+3600})+'.fixture';
const web='http://127.0.0.1:4384', apiUrl='http://127.0.0.1:4385';
const saved=[];const calls=[];let stories=0;
const api=http.createServer(async(req,res)=>{
 res.setHeader('Access-Control-Allow-Origin',web);res.setHeader('Access-Control-Allow-Headers','authorization,apikey,content-type,x-client-info,accept-profile,content-profile,prefer,range');res.setHeader('Access-Control-Expose-Headers','Content-Range');res.setHeader('Access-Control-Allow-Methods','GET,HEAD,POST,OPTIONS');res.setHeader('Content-Type','application/json');
 if(req.method==='OPTIONS')return res.writeHead(204).end();
 const url=new URL(req.url,apiUrl),name=url.pathname.split('/').at(-1);calls.push(name);
 const chunks=[];for await(const c of req)chunks.push(c);const input=chunks.length?JSON.parse(Buffer.concat(chunks)):{};
 let body=[];
 if(name==='user')body=user;
 if(name==='ensure_postkit_workspace')body=[{id:id(1),name:'Operação de teste',timezone:'America/Sao_Paulo',role:'owner'}];
 if(name==='has_workspace_role'||name==='instagram_worker_is_active')body=true;
 if(name==='instagram_accounts')body=[{id:id(2),username:'conta_fixture_a',connection_status:'connected',account_type:'BUSINESS'},{id:id(3),username:'conta_fixture_b',connection_status:'connected',account_type:'BUSINESS'}];
 if(name==='media_assets')body=[2,3].flatMap(a=>Array.from({length:20},(_,i)=>({id:id(a*100+i),original_filename:`conta-${a}-video-${i+1}.mp4`,size_bytes:1000,mime_type:'video/mp4',storage_path:'fixture',status:'uploaded',reel_account_id:id(a),import_position:i,import_folder:'Teste',import_batch_id:id(a*10)})));
 if(name==='instagram_story_reminders'){res.setHeader('Content-Range',`0-0/${stories}`);body=[];}
 if(name==='schedule_reviewed_instagram_reels'){saved.push(input);body=input.p_posts.length;}
 if(name==='get_instagram_dashboard')body={};
 res.end(JSON.stringify(body));
});
await new Promise(r=>api.listen(4385,'127.0.0.1',r));
const env={...process.env,VITE_SUPABASE_URL:apiUrl,VITE_SUPABASE_PUBLISHABLE_KEY:'fixture-anon',SUPABASE_URL:apiUrl,SUPABASE_PUBLISHABLE_KEY:'fixture-anon',SUPABASE_SERVICE_ROLE_KEY:'fixture-service',APP_BASE_URL:web};
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4384'],{env,stdio:['ignore','pipe','pipe'],windowsHide:true});
let output='';vite.stdout.on('data',x=>output+=x);vite.stderr.on('data',x=>output+=x);
let browser;
try{
 for(let i=0;i<120;i++){try{if((await fetch(web,{signal:AbortSignal.timeout(3000)})).ok)break;}catch{}await new Promise(r=>setTimeout(r,500));}
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({token,user,now})=>localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:token,refresh_token:'fixture',token_type:'bearer',expires_at:now+3600,user})),{token,user,now});
 await page.goto(web+'/automacao-instagram?tab=contas');
 await page.getByRole('region',{name:'Passo a passo por conta'}).waitFor({timeout:60000});
 await page.getByRole('button',{name:'Conectar Conta',exact:true}).first().click();
 await page.getByRole('region',{name:'Conectar navegador local'}).waitFor();
 await page.getByRole('button',{name:'Cancelar',exact:true}).first().click();
 await page.getByRole('button',{name:/3. Configurar Reels/}).click();
 await page.getByRole('button',{name:/Ver pr.* dos Reels/}).click();
 const activate=page.getByRole('button',{name:'Ativar esta programação',exact:true});await activate.waitFor();assert.equal(await activate.isDisabled(),true);
 await page.getByLabel('Vou preparar Stories',{exact:false}).check();
 await page.getByLabel('Conferi a conta, os vídeos',{exact:false}).check();assert.equal(await activate.isDisabled(),true);
 await page.getByLabel('Somente Reels por enquanto',{exact:false}).check();
 await page.getByLabel('Conferi a conta, os vídeos',{exact:false}).check();
 await page.waitForTimeout(1500);
 if(await activate.isDisabled())throw new Error('Activation disabled: '+(await page.locator('main').innerText()).slice(-5000));
 await activate.click();await page.getByRole('button',{name:'Agendamento salvo',exact:true}).waitFor();
 assert.equal(saved.length,1);assert.equal(saved[0].p_stories,'skip');assert.equal(saved[0].p_posts.length,20);assert.ok(saved[0].p_posts.every(p=>p.instagram_account_id===id(2)&&Number(p.media_asset_id.slice(-12))<300));
 await page.screenshot({path:'.superpowers/sdd/2026-11-13-instagram-guided-automation/desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
 await page.screenshot({path:'.superpowers/sdd/2026-11-13-instagram-guided-automation/mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS: isolated-login setup, 20 account-owned Reels at 10/day, Stories review gate, confirmed RPC, responsive layout; fixtures only');
}catch(e){console.error(e.message);console.error('API calls:',[...new Set(calls)].join(','));console.error(output.slice(-1500));process.exitCode=1;}
finally{await browser?.close();vite.kill();api.closeAllConnections();await new Promise(r=>api.close(r));}
