import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const DAY = 86400000;
const hash = value => createHash('sha256').update(value).digest('hex');
const token = () => randomBytes(32).toString('hex');
const eq = (a = '', b = '') => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const country = value => ['BO', 'GU'].includes(value) ? value : fail(400, 'Selecciona Bolivia o Guatemala.');
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const clean = (value, max, label, min = 1) => {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) fail(400, `Revisa ${label}.`);
  return value.trim();
};
const httpsUrl = value => {
  try { const url = new URL(value); if (url.protocol !== 'https:' || url.username || url.password) throw new Error(); return url.href; }
  catch { fail(400, 'Usa un enlace completo que empiece por https://.'); }
};
const emailAddress = value => {
  const email = clean(value, 254, 'el correo').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'Revisa el correo electrónico.');
  return email;
};
const cookieValues = req => Object.fromEntries((req.headers.cookie || '').split(';').map(v => v.trim().split(/=(.*)/s)).filter(v => v.length >= 2));
const profile = row => row ? { id: row.id, email: row.email, country: row.country, ageBand: row.age_band, gender: row.gender, occupation: row.occupation, role: row.role } : null;

export function createApp(options = {}) {
  const production = options.production ?? process.env.NODE_ENV === 'production';
  const publicUrl = options.publicUrl ?? process.env.PUBLIC_URL ?? 'http://127.0.0.1:4173';
  const contact = options.contact ?? process.env.CONTACT_EMAIL ?? '';
  const dataDir = path.resolve(options.dataDir ?? process.env.DATA_DIR ?? path.join(ROOT, '.runtime'));
  if (production && (!publicUrl.startsWith('https://') || !contact || (!options.mailer && (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM)))) {
    throw new Error('Producción requiere PUBLIC_URL HTTPS, CONTACT_EMAIL y correo configurado.');
  }
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path.join(dataDir, 'ecoh.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,country TEXT NOT NULL,age_band TEXT NOT NULL,gender TEXT NOT NULL,occupation TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'user',verified INTEGER NOT NULL DEFAULT 0,consent_at TEXT NOT NULL,privacy_version TEXT NOT NULL DEFAULT '2026-11-18');
    CREATE TABLE IF NOT EXISTS tokens(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS places(id TEXT PRIMARY KEY,owner TEXT REFERENCES users(id) ON DELETE SET NULL,name TEXT NOT NULL,country TEXT NOT NULL,kind TEXT NOT NULL,address TEXT NOT NULL,lat REAL NOT NULL,lng REAL NOT NULL,materials TEXT NOT NULL,description TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',review_note TEXT NOT NULL DEFAULT '',reviewed_at TEXT,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS news(id TEXT PRIMARY KEY,title TEXT NOT NULL,summary TEXT NOT NULL,source_url TEXT NOT NULL,country TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS progress(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,country TEXT NOT NULL,level INTEGER NOT NULL,best INTEGER NOT NULL,attempts INTEGER NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(user_id,country,level));
    CREATE TABLE IF NOT EXISTS stats(day TEXT NOT NULL,country TEXT NOT NULL,audience TEXT NOT NULL,event TEXT NOT NULL,total INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(day,country,audience,event));
    CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,actor TEXT,action TEXT NOT NULL,record_id TEXT NOT NULL,created_at TEXT NOT NULL);
  `);
  const guests = new Map();
  const limits = new Map();
  const now = () => Date.now();
  const stamp = () => new Date().toISOString();
  function limited(key, max, period) {
    const time = now();
    if (limits.size > 10000) for (const [k,v] of limits) if (v.until < time) limits.delete(k);
    const item = limits.get(key);
    if (!item || item.until < time) limits.set(key, { total: 1, until: time + period });
    else if (++item.total > max) fail(429, 'Demasiados intentos. Espera unos minutos y vuelve a intentar.');
  }
  function stats(co, audience, event) {
    db.prepare('INSERT INTO stats(day,country,audience,event,total) VALUES(?,?,?,?,1) ON CONFLICT(day,country,audience,event) DO UPDATE SET total=total+1').run(stamp().slice(0,10),co,audience,event);
  }
  function audit(user, action, id) { db.prepare('INSERT INTO audit(actor,action,record_id,created_at) VALUES(?,?,?,?)').run(user.id,action,id,stamp()); }
  function auth(req) {
    const cookies = cookieValues(req);
    const user = db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=? AND s.expires>? AND u.verified=1').get(hash(cookies.ecoh_session || ''), now());
    const guest = guests.get(cookies.ecoh_guest);
    return { user, guest: guest && guest.expires > now() ? guest : null };
  }
  function member(ctx) { if (!ctx.user) fail(401, 'Inicia sesión con una cuenta de adulto.'); return ctx.user; }
  function admin(ctx) { const u = member(ctx); if (u.role !== 'admin') fail(403, 'Esta función es solo para administración.'); return u; }
  function admitted(ctx) { if (!ctx.user && !ctx.guest) fail(401, 'Elige cómo entrar antes de continuar.'); }
  function setCookie(res, name, value, age) {
    const valueString = `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${production ? '; Secure' : ''}`;
    res.setHeader('Set-Cookie', [...(res.getHeader('Set-Cookie') || []), valueString]);
  }
  async function body(req) {
    if (!(req.headers['content-type'] || '').startsWith('application/json')) fail(415, 'Formato de solicitud no admitido.');
    let raw = ''; for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 16384) fail(413, 'El formulario es demasiado grande.'); }
    try { const data = JSON.parse(raw || '{}'); if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(); return data; }
    catch { fail(400, 'No se pudo leer el formulario.'); }
  }
  async function sendAccess(user) {
    const raw = token();
    db.prepare('DELETE FROM tokens WHERE user_id=?').run(user.id);
    db.prepare('INSERT INTO tokens(hash,user_id,expires) VALUES(?,?,?)').run(hash(raw),user.id,now()+15*60000);
    const link = `${publicUrl}/#acceso=${raw}`;
    try {
      if (options.mailer) await options.mailer({ to: user.email, link });
      else if (production) {
        const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: process.env.MAIL_FROM, to: [user.email], subject: 'Tu acceso a ECOH Ambiental', text: `Solicitaste entrar a ECOH Ambiental. Abre este enlace y confirma el acceso en los próximos 15 minutos: ${link}\nSi no lo solicitaste, ignora este correo.` }), signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error('mail');
      } else {
        const outbox = path.join(dataDir, 'outbox'); mkdirSync(outbox, { recursive: true, mode: 0o700 });
        writeFileSync(path.join(outbox, `${now()}-${randomBytes(3).toString('hex')}.json`), JSON.stringify({ to: user.email, link }, null, 2), { mode: 0o600 });
      }
    } catch { db.prepare('DELETE FROM tokens WHERE hash=?').run(hash(raw)); fail(503, 'No se pudo enviar el acceso. Inténtalo más tarde.'); }
  }
  function newsFields(b) {
    const co = b.country === 'ALL' ? 'ALL' : country(b.country);
    if (!['draft','published'].includes(b.status)) fail(400,'Selecciona borrador o publicado.');
    return [clean(b.title,160,'el título'),clean(b.summary,2000,'el resumen'),httpsUrl(b.sourceUrl),co,b.status];
  }
  const publicPlace = 'id,name,country,kind,address,lat,lng,materials,description,reviewed_at';
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src https://www.youtube-nocookie.com https://www.openstreetmap.org; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
    if (production) res.setHeader('Strict-Transport-Security','max-age=31536000');
    const json = (status, data) => { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(data)); };
    try {
      const url = new URL(req.url, 'http://local'); const route = url.pathname;
      if (!route.startsWith('/api/')) {
        if (!['GET','HEAD'].includes(req.method)) fail(405,'Método no admitido.');
        let pathname; try { pathname = decodeURIComponent(route); } catch { fail(400,'Ruta incorrecta.'); }
        const target = path.resolve(PUBLIC, '.' + (pathname === '/' ? '/index.html' : pathname));
        if (!target.startsWith(PUBLIC + path.sep) || pathname.split('/').some(v=>v.startsWith('.'))) fail(404,'Archivo no encontrado.');
        if (!existsSync(target) || !statSync(target).isFile()) fail(404,'Archivo no encontrado.');
        const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.mp3':'audio/mpeg'};
        res.setHeader('Content-Type',types[path.extname(target)] || 'application/octet-stream');
        res.setHeader('Cache-Control',route.startsWith('/assets/') ? 'public, max-age=86400' : 'no-cache');
        res.end(req.method==='HEAD' ? undefined : readFileSync(target)); return;
      }
      const cookies = cookieValues(req); const ctx = auth(req);
      if (req.method !== 'GET') {
        const origin = req.headers.origin;
        const expected = production ? new URL(publicUrl).origin : `http://${req.headers.host}`;
        if (origin !== expected || !eq(cookies.ecoh_csrf, req.headers['x-csrf-token'] || '') || !cookies.ecoh_csrf) fail(403,'La sesión del formulario expiró. Recarga la página.');
        limited(`request:${req.socket.remoteAddress}`,120,60000);
      }
      const b = req.method === 'POST' ? await body(req) : {};
      if (route === '/api/session' && req.method === 'GET') {
        const csrf = cookies.ecoh_csrf || token(); if (!cookies.ecoh_csrf) setCookie(res,'ecoh_csrf',csrf,86400);
        json(200,{user:profile(ctx.user),guest:!!ctx.guest,csrf,reviewMode:!production,contact,privacyVersion:'2026-11-18'}); return;
      }
      if (route === '/api/guest' && req.method === 'POST') {
        if (b.isAdult !== false) fail(400,'Esta entrada es para visitantes menores de edad.');
        const co = country(b.country);
        if (ctx.user) { db.prepare('DELETE FROM sessions WHERE hash=?').run(hash(cookies.ecoh_session || '')); setCookie(res,'ecoh_session','',0); }
        let raw = cookies.ecoh_guest;
        if (!ctx.guest) { raw = token(); guests.set(raw,{expires:now()+30*60000,country:co}); stats(co,'minor','sessions'); }
        setCookie(res,'ecoh_guest',raw,1800);
        json(200,{ok:true}); return;
      }
      if (route === '/api/register' && req.method === 'POST') {
        if (b.isAdult !== true || b.privacyAccepted !== true) fail(400,'El registro es para adultos que acepten el aviso de privacidad.');
        const email = emailAddress(b.email); const co=country(b.country);
        const age = clean(b.ageBand,8,'el rango de edad'); if (!['18-24','25-34','35-44','45-54','55-64','65+'].includes(age)) fail(400,'Selecciona un rango de edad adulto.');
        const gender = b.gender || 'Prefiero no responder'; if (!['Mujer','Hombre','No binario','Otra identidad','Prefiero no responder'].includes(gender)) fail(400,'Revisa el género.');
        const occupation = b.occupation || 'Prefiero no responder'; if (!['Estudiante','Docente','Empleado/a','Independiente','Trabajo del hogar','Jubilado/a','Otra','Prefiero no responder'].includes(occupation)) fail(400,'Revisa la ocupación.');
        limited(`email:${hash(email)}`,3,15*60000);
        let user=db.prepare('SELECT * FROM users WHERE email=?').get(email);
        if (!user) { db.prepare('INSERT INTO users(id,email,country,age_band,gender,occupation,consent_at) VALUES(?,?,?,?,?,?,?)').run(token(),email,co,age,gender,occupation,stamp()); user=db.prepare('SELECT * FROM users WHERE email=?').get(email); }
        await sendAccess(user); json(200,{message:production?'Revisa tu correo y confirma el acceso.':'Modo de revisión: el correo se guardó en el buzón local del servidor; no se envió.'}); return;
      }
      if (route === '/api/login' && req.method === 'POST') {
        const email=emailAddress(b.email); limited(`email:${hash(email)}`,3,15*60000);
        const user=db.prepare('SELECT * FROM users WHERE email=?').get(email); if(user) await sendAccess(user);
        json(200,{message:production?'Si tienes una cuenta, recibirás un enlace de acceso.':'Modo de revisión: si existe la cuenta, el enlace está en el buzón local del servidor.'}); return;
      }
      if (route === '/api/verify' && req.method === 'POST') {
        limited(`verify:${req.socket.remoteAddress}`,20,15*60000);
        const row=db.prepare('SELECT * FROM tokens WHERE hash=? AND expires>?').get(hash(clean(b.token,128,'el enlace')),now());
        if(!row) fail(400,'El enlace expiró o ya fue utilizado. Solicita otro.');
        db.exec('BEGIN IMMEDIATE');
        try {
          db.prepare('DELETE FROM tokens WHERE user_id=?').run(row.user_id);
          db.prepare('UPDATE users SET verified=1 WHERE id=?').run(row.user_id);
          const raw=token(); db.prepare('INSERT INTO sessions(hash,user_id,expires) VALUES(?,?,?)').run(hash(raw),row.user_id,now()+30*DAY);
          db.exec('COMMIT'); setCookie(res,'ecoh_session',raw,30*86400);
        } catch(e) {db.exec('ROLLBACK');throw e;}
        guests.delete(cookies.ecoh_guest);setCookie(res,'ecoh_guest','',0);
        const user=db.prepare('SELECT * FROM users WHERE id=?').get(row.user_id);stats(user.country,'adult','sessions');
        json(200,{user:profile(user)});return;
      }
      if(route==='/api/logout' && req.method==='POST') {
        db.prepare('DELETE FROM sessions WHERE hash=?').run(hash(cookies.ecoh_session||''));guests.delete(cookies.ecoh_guest);
        setCookie(res,'ecoh_session','',0);setCookie(res,'ecoh_guest','',0);json(200,{ok:true});return;
      }
      if(route==='/api/progress' && req.method==='GET') { const u=member(ctx);json(200,{items:db.prepare('SELECT country,level,best,attempts,updated_at FROM progress WHERE user_id=?').all(u.id)});return; }
      if(route==='/api/progress' && req.method==='POST') {
        const u=member(ctx);const co=country(b.country);if(!Number.isInteger(b.level)||b.level<1||b.level>3||!Number.isInteger(b.score)||b.score<0||b.score>6)fail(400,'Resultado no válido.');
        limited(`progress:${u.id}`,20,60000);
        db.prepare('INSERT INTO progress(user_id,country,level,best,attempts,updated_at) VALUES(?,?,?,?,1,?) ON CONFLICT(user_id,country,level) DO UPDATE SET best=max(best,excluded.best),attempts=attempts+1,updated_at=excluded.updated_at').run(u.id,co,b.level,b.score,stamp());
        stats(co,'adult','games');json(200,{ok:true});return;
      }
      if(route==='/api/places' && req.method==='GET') {admitted(ctx);const co=country(url.searchParams.get('country'));json(200,{items:db.prepare(`SELECT ${publicPlace} FROM places WHERE status='approved' AND country=? ORDER BY reviewed_at DESC`).all(co)});return;}
      if(route==='/api/my-places' && req.method==='GET') {const u=member(ctx);json(200,{items:db.prepare('SELECT id,name,status,review_note,created_at FROM places WHERE owner=? ORDER BY created_at DESC').all(u.id)});return;}
      if(route==='/api/places' && req.method==='POST') {
        const u=member(ctx);limited(`places:${u.id}`,10,DAY);const co=country(b.country);
        const lat=Number(b.lat),lng=Number(b.lng);if(b.lat===''||b.lng===''||!Number.isFinite(lat)||!Number.isFinite(lng)||lat < -90||lat>90||lng < -180||lng>180)fail(400,'Revisa las coordenadas.');
        if(!['recycling','container'].includes(b.kind))fail(400,'Selecciona el tipo de lugar.');
        const id=token();db.prepare('INSERT INTO places(id,owner,name,country,kind,address,lat,lng,materials,description,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,u.id,clean(b.name,120,'el nombre'),co,b.kind,clean(b.address,250,'la dirección'),lat,lng,clean(b.materials,250,'los residuos aceptados'),clean(b.description||'',1000,'la descripción',0),stamp());
        json(201,{id,status:'pending'});return;
      }
      if(route==='/api/news' && req.method==='GET') {admitted(ctx);const co=country(url.searchParams.get('country'));json(200,{items:db.prepare("SELECT * FROM news WHERE status='published' AND country IN (?, 'ALL') ORDER BY created_at DESC").all(co)});return;}
      if(route==='/api/admin/places' && req.method==='GET') {admin(ctx);json(200,{items:db.prepare('SELECT * FROM places ORDER BY created_at DESC').all()});return;}
      if(route==='/api/admin/review-place' && req.method==='POST') {
        const u=admin(ctx);if(!['approved','rejected','pending'].includes(b.status))fail(400,'Estado no válido.');
        const note=clean(b.note,1000,'la nota de verificación',b.status==='pending'?0:8);
        if(b.status==='approved' && b.verified!==true)fail(400,'Confirma que verificaste la ubicación y los residuos aceptados.');
        const result=db.prepare('UPDATE places SET status=?,review_note=?,reviewed_at=? WHERE id=?').run(b.status,note,stamp(),b.id||'');if(!result.changes)fail(404,'No se encontró el lugar.');audit(u,`place:${b.status}`,b.id);json(200,{ok:true});return;
      }
      if(route==='/api/admin/news' && req.method==='GET') {admin(ctx);json(200,{items:db.prepare('SELECT * FROM news ORDER BY created_at DESC').all()});return;}
      if(route==='/api/admin/news' && req.method==='POST') {
        const u=admin(ctx);const fields=newsFields(b);let id=b.id||token();
        if(b.id) {const r=db.prepare('UPDATE news SET title=?,summary=?,source_url=?,country=?,status=?,updated_at=? WHERE id=?').run(...fields,stamp(),id);if(!r.changes)fail(404,'Noticia no encontrada.');}
        else db.prepare('INSERT INTO news(title,summary,source_url,country,status,created_at,updated_at,id) VALUES(?,?,?,?,?,?,?,?)').run(...fields,stamp(),stamp(),id);
        audit(u,'news:save',id);json(200,{id});return;
      }
      if(route==='/api/admin/delete-news' && req.method==='POST') {const u=admin(ctx);db.prepare('DELETE FROM news WHERE id=?').run(b.id||'');audit(u,'news:delete',b.id||'');json(200,{ok:true});return;}
      if(route==='/api/admin/stats' && req.method==='GET') {
        admin(ctx);json(200,{visits:db.prepare('SELECT * FROM stats ORDER BY day DESC').all(),adults:db.prepare('SELECT count(*) AS total FROM users WHERE verified=1').get().total,ages:db.prepare('SELECT age_band AS label,count(*) AS total FROM users WHERE verified=1 GROUP BY age_band').all(),genders:db.prepare('SELECT gender AS label,count(*) AS total FROM users WHERE verified=1 GROUP BY gender').all(),occupations:db.prepare('SELECT occupation AS label,count(*) AS total FROM users WHERE verified=1 GROUP BY occupation').all(),pending:db.prepare("SELECT count(*) AS total FROM places WHERE status='pending'").get().total});return;
      }
      if(route==='/api/account/export' && req.method==='GET') {const u=member(ctx);json(200,{profile:profile(u),consentAt:u.consent_at,privacyVersion:u.privacy_version,progress:db.prepare('SELECT country,level,best,attempts,updated_at FROM progress WHERE user_id=?').all(u.id),places:db.prepare('SELECT name,country,address,lat,lng,materials,description,status,review_note FROM places WHERE owner=?').all(u.id)});return;}
      if(route==='/api/account/delete' && req.method==='POST') {
        const u=member(ctx);if(u.role==='admin')fail(409,'Transfiere la administración antes de eliminar esta cuenta.');if(b.confirm!=='ELIMINAR')fail(400,'Confirma la eliminación.');
        db.exec('BEGIN IMMEDIATE');try {db.prepare("DELETE FROM places WHERE owner=? AND status!='approved'").run(u.id);db.prepare('DELETE FROM users WHERE id=?').run(u.id);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
        setCookie(res,'ecoh_session','',0);json(200,{ok:true});return;
      }
      fail(404,'No se encontró esta función.');
    } catch(error) { if(!res.headersSent) json(error.status||500,{error:error.status?error.message:'Ocurrió un problema. Inténtalo nuevamente.'});else res.end(); }
  });
  function cleanup() {
    db.prepare('DELETE FROM tokens WHERE expires<?').run(now());db.prepare('DELETE FROM sessions WHERE expires<?').run(now());
    db.prepare('DELETE FROM users WHERE verified=0 AND consent_at<?').run(new Date(now()-DAY).toISOString());
    db.prepare('DELETE FROM stats WHERE day<?').run(new Date(now()-365*DAY).toISOString().slice(0,10));
    db.prepare('DELETE FROM audit WHERE created_at<?').run(new Date(now()-365*DAY).toISOString());
    for(const [k,v] of guests)if(v.expires<now())guests.delete(k);
    for(const [k,v] of limits)if(v.until<now())limits.delete(k);
  }
  cleanup();const timer=setInterval(cleanup,60000);timer.unref();
  return {server,db,close:()=>{clearInterval(timer);db.close();},promote:email=>db.prepare("UPDATE users SET role='admin' WHERE email=? AND verified=1").run(emailAddress(email))};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app=createApp();
  if(process.argv[2]==='--admin') {const r=app.promote(process.argv[3]||'');console.log(r.changes?'Administrador actualizado.':'Primero registra y verifica esa cuenta.');app.close();process.exit(r.changes?0:1);}
  const port=Number(process.env.PORT||4173);const host=process.env.HOST||'127.0.0.1';
  app.server.listen(port,host,()=>console.log(`ECOH Ambiental: http://${host}:${port} (revisión local)`));
  const stop=()=>app.server.close(()=>{app.close();process.exit(0);});process.on('SIGINT',stop);process.on('SIGTERM',stop);
}
