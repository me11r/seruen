import assert from 'node:assert/strict';
const base=process.env.TEST_URL||'http://localhost:3000';
const checks=[];async function check(name,fn){try{await fn();checks.push({name,status:'PASS'});}catch(e){checks.push({name,status:'FAIL',detail:e.message});process.exitCode=1;}}
const request=async(body)=>{const r=await fetch(base+'/api/recommend',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};};
const position={lat:51.0938,lon:71.41695};
await check('Health and dataset',async()=>{const r=await fetch(base+'/api/health');assert.equal(r.status,200);assert.ok((await r.json()).count>0);});
await check('Landing, JS, CSS and local Leaflet served',async()=>{for(const p of ['/','/app.js','/i18n.js','/style.css','/vendor/leaflet/leaflet.js'])assert.equal((await fetch(base+p)).status,200,p);});
for(const language of ['kk','ru','en'])await check('Walk 60 minutes '+language,async()=>{const {status,body}=await request({position,language,query:'60 minutes walk'});assert.equal(status,200);assert.ok(body.recommendations.length>=1);assert.ok(body.recommendations.length<=3);assert.ok(body.recommendations.every(p=>p.sourceUrl.startsWith('https://www.openstreetmap.org/')&&p.totalMinutes<=60));});
await check('Coffee near Mega',async()=>{const {body}=await request({position:{lat:51.08909,lon:71.40733},language:'ru',query:'кофе и учёба 60 минут'});assert.ok(body.recommendations.length);assert.ok(body.recommendations.every(p=>p.category==='cafe'));});
await check('Refinement preserves category and reduces time',async()=>{const {body}=await request({position:{lat:51.08909,lon:71.40733},language:'ru',query:'осталось 30 минут',context:{interest:'cafe',minutes:60}});assert.equal(body.intent.interest,'cafe');assert.equal(body.intent.minutes,30);assert.ok(body.recommendations.every(p=>p.totalMinutes<=30));});
await check('Indoor does not return parks',async()=>{const {body}=await request({position,language:'en',query:'indoors only',context:{minutes:90}});assert.ok(body.recommendations.every(p=>['cafe','museum','mall','library'].includes(p.category)));});
await check('Free filter only confirmed fee=no',async()=>{const {body}=await request({position,language:'ru',query:'бесплатно 60 минут'});assert.ok(body.recommendations.every(p=>p.tags.fee==='no'));assert.ok(body.summary);});
await check('Invalid coordinates rejected',async()=>{assert.equal((await request({position:{lat:0,lon:0},query:'hi'})).status,400);});
await check('Secrets and server files not exposed',async()=>{for(const p of ['/.env','/server.mjs','/lib/model.mjs'])assert.equal((await fetch(base+p)).status,404);const c=await(await fetch(base+'/api/config')).json();assert.ok(!('apiKey'in c));});
console.log(JSON.stringify({at:new Date().toISOString(),checks},null,2));
