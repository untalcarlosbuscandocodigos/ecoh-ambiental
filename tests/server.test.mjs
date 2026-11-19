import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import {createApp} from '../server.mjs';

test('Acceso, privacidad, moderación, noticias y persistencia',async t=>{
 const dir=mkdtempSync(path.join(tmpdir(),'ecoh-test-'));const mails=[];
 const app=createApp({dataDir:dir,publicUrl:'http://localhost',production:false,mailer:async mail=>mails.push(mail)});
 app.server.listen(0,'127.0.0.1');await once(app.server,'listening');const base=`http://127.0.0.1:${app.server.address().port}`;
 t.after(async()=>{await new Promise(resolve=>app.server.close(resolve));app.close();rmSync(dir,{recursive:true,force:true});});
 function client(){const jar={};let csrf='';return {jar,async call(route,body,headers={}){
   const response=await fetch(base+route,{method:body===undefined?'GET':'POST',headers:{Cookie:Object.entries(jar).map(([k,v])=>`${k}=${v}`).join('; '),...(body===undefined?{}:{'Content-Type':'application/json',Origin:base,'X-CSRF-Token':csrf}),...headers},body:body===undefined?undefined:JSON.stringify(body)});
   for(const c of response.headers.getSetCookie()){const pair=c.split(';')[0];const at=pair.indexOf('=');jar[pair.slice(0,at)]=pair.slice(at+1);}
   const type=response.headers.get('content-type')||'';const data=type.includes('application/json')?await response.json():await response.text();if(data.csrf)csrf=data.csrf;return {status:response.status,data,headers:response.headers};
 }};}
 const visitor=client(),adult=client(),other=client();
 const register={email:'adult@example.test',isAdult:true,privacyAccepted:true,country:'BO',ageBand:'25-34',gender:'Prefiero no responder',occupation:'Docente'};
 await visitor.call('/api/session');await adult.call('/api/session');await other.call('/api/session');
 await t.test('Sin entrada no se consultan datos de la comunidad',async()=>{assert.equal((await visitor.call('/api/places?country=BO')).status,401);});
 await t.test('CSRF rechaza otro origen y token faltante',async()=>{
  assert.equal((await visitor.call('/api/guest',{isAdult:false,country:'BO'},{Origin:'https://other.example'})).status,403);
  assert.equal((await visitor.call('/api/guest',{isAdult:false,country:'BO'},{'X-CSRF-Token':''})).status,403);
 });
 await t.test('Menores entran sin perfil y solo una sesión agregada',async()=>{
  assert.equal((await visitor.call('/api/guest',{isAdult:false,country:'BO'})).status,200);
  assert.equal((await visitor.call('/api/guest',{isAdult:false,country:'BO'})).status,200);
  assert.equal(app.db.prepare('SELECT count(*) AS n FROM users').get().n,0);
  assert.equal(app.db.prepare("SELECT total FROM stats WHERE audience='minor'").get().total,1);
  assert.equal((await visitor.call('/api/admin/stats')).status,401);assert.equal((await visitor.call('/api/places',{})).status,401);
  assert.equal((await visitor.call('/api/progress',{country:'BO',level:1,score:6})).status,401);
 });
 await t.test('Se rechaza registro de menor, rango incorrecto o falta de aceptación',async()=>{
  assert.equal((await adult.call('/api/register',{...register,isAdult:false})).status,400);
  assert.equal((await adult.call('/api/register',{...register,ageBand:'12-17'})).status,400);
  assert.equal((await adult.call('/api/register',{...register,privacyAccepted:false})).status,400);
 });
 await t.test('Una cuenta requiere correo verificado y enlace de un solo uso',async()=>{
  assert.equal((await adult.call('/api/register',register)).status,200);
  assert.equal((await adult.call('/api/session')).data.user,null);
  const raw=mails.at(-1).link.split('#acceso=')[1];assert.equal((await adult.call('/api/verify',{token:raw})).status,200);
  assert.equal((await adult.call('/api/verify',{token:raw})).status,400);
  assert.equal((await adult.call('/api/session')).data.user.email,register.email);
  assert.equal((await adult.call('/api/admin/stats')).status,403);
 });
 await t.test('Propuestas pendientes no son públicas y el usuario no puede aprobarlas',async()=>{
  const p=await adult.call('/api/places',{name:'Punto de prueba',country:'BO',kind:'recycling',address:'Dirección de prueba',lat:-19.03,lng:-65.26,materials:'Papel',description:'Información sintética de prueba'});assert.equal(p.status,201);assert.equal(p.data.status,'pending');
  assert.equal((await visitor.call('/api/places?country=BO')).data.items.length,0);
  assert.equal((await adult.call('/api/admin/review-place',{id:p.data.id,status:'approved',verified:true,note:'Comprobado en prueba'})).status,403);
  assert.equal((await adult.call('/api/places',{name:'x',country:'BO',kind:'recycling',address:'x',lat:'bad',lng:0,materials:'x'})).status,400);
 });
 await t.test('Progreso conserva el mejor resultado y rechaza puntuaciones imposibles',async()=>{
  await adult.call('/api/progress',{country:'BO',level:1,score:5});await adult.call('/api/progress',{country:'BO',level:1,score:2});
  const p=(await adult.call('/api/progress')).data.items[0];assert.equal(p.best,5);assert.equal(p.attempts,2);
  assert.equal((await adult.call('/api/progress',{country:'BO',level:1,score:200})).status,400);
 });
 await t.test('Administrador valida antes de publicar; no se exponen dueño ni notas internas',async()=>{
  assert.equal(app.promote(register.email).changes,1);const id=(await adult.call('/api/my-places')).data.items[0].id;
  assert.equal((await adult.call('/api/admin/review-place',{id,status:'approved',note:'Verificado mediante prueba'})).status,400);
  assert.equal((await adult.call('/api/admin/review-place',{id,status:'approved',note:'Verificado mediante prueba',verified:true})).status,200);
  const result=await visitor.call('/api/places?country=BO');assert.equal(result.data.items.length,1);assert.equal(result.data.items[0].owner,undefined);assert.equal(result.data.items[0].review_note,undefined);
  assert.equal((await visitor.call('/api/places?country=GU')).data.items.length,0);
 });
 await t.test('Noticias: borrador privado, publicación, edición, filtro y eliminación',async()=>{
  const fields={title:'Noticia de prueba',summary:'Resumen propio de prueba',sourceUrl:'https://example.org/noticia',country:'BO',status:'draft'};
  const n=await adult.call('/api/admin/news',fields);assert.equal(n.status,200);
  assert.equal((await visitor.call('/api/news?country=BO')).data.items.length,0);
  await adult.call('/api/admin/news',{...fields,id:n.data.id,status:'published'});
  assert.equal((await visitor.call('/api/news?country=BO')).data.items.length,1);assert.equal((await visitor.call('/api/news?country=GU')).data.items.length,0);
  assert.equal((await adult.call('/api/admin/news',{...fields,sourceUrl:'javascript:alert(1)'})).status,400);
  await adult.call('/api/admin/delete-news',{id:n.data.id});assert.equal((await visitor.call('/api/news?country=BO')).data.items.length,0);
 });
 await t.test('Exportación propia y eliminación efectiva de cuenta normal',async()=>{
  await other.call('/api/register',{...register,email:'other@example.test'});await other.call('/api/verify',{token:mails.at(-1).link.split('#acceso=')[1]});
  await other.call('/api/progress',{country:'GU',level:2,score:3});const own=await other.call('/api/account/export');assert.equal(own.data.profile.email,'other@example.test');assert.equal(own.data.progress.length,1);
  assert.equal((await other.call('/api/account/delete',{confirm:'ELIMINAR'})).status,200);assert.equal((await other.call('/api/session')).data.user,null);assert.equal(app.db.prepare("SELECT count(*) AS n FROM users WHERE email='other@example.test'").get().n,0);
  assert.equal((await adult.call('/api/account/delete',{confirm:'ELIMINAR'})).status,409);
 });
 await t.test('No se sirven secretos, código de servidor ni bases de datos; API no se cachea',async()=>{
  for(const p of ['/.env','/.runtime/ecoh.sqlite','/server.mjs','/..%2f.env'])assert.equal((await visitor.call(p)).status,404);
  const result=await visitor.call('/api/session');assert.equal(result.headers.get('cache-control'),'no-store');assert.ok(result.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
 });
 await t.test('Sesiones expiran y cerrar sesión revoca el acceso',async()=>{
  assert.equal((await adult.call('/api/logout',{})).status,200);assert.equal((await adult.call('/api/admin/stats')).status,401);
  app.db.prepare('UPDATE tokens SET expires=0').run();assert.equal((await adult.call('/api/verify',{token:'invalid-token'})).status,400);
 });
 await t.test('Los datos se conservan al abrir otra conexión a SQLite',()=>{
  const second=createApp({dataDir:dir,production:false,publicUrl:'http://localhost'});assert.equal(second.db.prepare("SELECT count(*) AS n FROM places WHERE status='approved'").get().n,1);second.close();
 });
});

test('Producción rechaza configuración incompleta',()=>{
 assert.throws(()=>createApp({production:true,publicUrl:'http://localhost',contact:''}),/Producción requiere/);
});
