import {getWeather} from './lib/weather.mjs';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseIntent,retrieve,fallback} from './lib/search.mjs';
import {generate} from './lib/model.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const places=JSON.parse(await readFile(path.join(root,'data/places.json'),'utf8'));
const limits=new Map();
function json(res,status,body){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));}
const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api/wind-network'){try{return json(res,200,JSON.parse(await readFile(path.join(root,'data/wind/network.json'),'utf8')));}catch{return json(res,503,{error:'NETWORK_UNAVAILABLE'});}}
 if(url.pathname==='/api/weather'){try{return json(res,200,await getWeather());}catch{return json(res,503,{error:'WEATHER_UNAVAILABLE'});}}
 if(url.pathname==='/api/config')return json(res,200,{mode:process.env.OPENAI_API_KEY?'live':'demo',mapKey:process.env.TWOGIS_MAP_KEY||'',count:places.length,fetchedAt:places[0]?.fetchedAt,anchors:places.filter(p=>/mega silk|мега силк|нұр әлем|nur alem|байтерек|бәйтерек/i.test(p.name)).map(p=>({name:p.name,lat:p.lat,lon:p.lon}))});
 if(url.pathname==='/api/dataset')return json(res,200,{attribution:'© OpenStreetMap contributors',license:'ODbL-1.0',licenseUrl:'https://opendatacommons.org/licenses/odbl/1-0/',places});
 if(url.pathname==='/api/health')return json(res,200,{ok:true,count:places.length});
 if(url.pathname==='/api/recommend'&&req.method==='POST'){
  const ip=req.socket.remoteAddress; const now=Date.now();if(limits.size>5000)limits.clear();const limit=limits.get(ip)||{at:now,n:0};if(now-limit.at>60000){limit.at=now;limit.n=0;}limit.n++;limits.set(ip,limit);if(limit.n>30)return json(res,429,{error:'RATE_LIMIT'});
  try{
   let raw='';for await(const c of req){raw+=c;if(raw.length>16000)return json(res,413,{error:'TOO_LARGE'});}
   const b=JSON.parse(raw);const {position,language='kk',query=''}=b;
   if(!position||![position.lat,position.lon].every(Number.isFinite)||position.lat<50.9||position.lat>51.3||position.lon<71.2||position.lon>71.7||!['kk','ru','en'].includes(language)||typeof query!=='string'||query.length>1200) return json(res,400,{error:'INVALID_INPUT'});
   const f=b.context||{};const context={minutes:Number.isFinite(f.minutes)?Math.max(10,Math.min(180,f.minutes)):60,interest:['any','cafe','walk','museum'].includes(f.interest)?f.interest:'any',indoor:f.indoor===true,budget:['any','low','free'].includes(f.budget)?f.budget:'any',closer:f.closer===true};
   const intent=parseIntent(query,context);const candidates=retrieve(places,position,intent,query);let output=fallback(candidates,language),mode='demo',warning=null;
   if(process.env.OPENAI_API_KEY&&candidates.length){try{output=await generate(candidates,intent,query,language);mode='live';}catch(error){mode='fallback';warning=['MODEL_QUOTA','MODEL_AUTH','MODEL_RATE_LIMIT'].includes(error.message)?error.message:'MODEL_UNAVAILABLE';}}
   else if(process.env.OPENAI_API_KEY)mode='retrieval';
   return json(res,200,{...output,recommendations:output.recommendations.map(r=>({...candidates.find(p=>p.id===r.id),...r,score:undefined})),mode,warning,intent,retrievedCount:candidates.length});
  }catch{return json(res,400,{error:'INVALID_INPUT'});}
 }
 if(url.pathname.startsWith('/api/'))return json(res,404,{error:'NOT_FOUND'});
 if(!['GET','HEAD'].includes(req.method))return json(res,405,{error:'METHOD'});
 const file=url.pathname==='/'||url.pathname==='/app'?'index.html':url.pathname.slice(1);
 if(file.includes('..')||file.startsWith('.')||file.includes('\\'))return json(res,404,{error:'NOT_FOUND'});
 try{const data=await readFile(path.join(root,'public',file));const ext=path.extname(file);res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf'})[ext]||'application/octet-stream'});res.end(data);}catch{json(res,404,{error:'NOT_FOUND'});}
});
server.listen(Number(process.env.PORT||3000),process.env.HOST||'0.0.0.0',()=>console.log(`Seruen ready: http://localhost:${process.env.PORT||3000}`));
