import assert from 'node:assert/strict';import {compareRoutes} from '../public/wind-engine.js';
const base=process.env.TEST_URL||'http://localhost:3000';
for(const file of ['/','/wind.js','/wind-engine.js','/wind.css','/fonts/NotoSans.ttf']){const r=await fetch(base+file);assert.equal(r.status,200);}
const network=await (await fetch(base+'/api/wind-network')).json();assert.ok(network.edges.length>100);
const result=compareRoutes(network,{start:network.anchors.find(a=>a.id==='north').node,end:network.anchors.find(a=>a.id==='south').node,from:30,speed:10,roundTrip:true});assert.ok(result.windAware.length<=result.fastest.length+300);
const r=await fetch(base+'/api/weather');assert.equal(r.status,200);const weather=await r.json();assert.equal(weather.kind,'forecast');assert.ok(Number.isFinite(weather.from)&&Number.isFinite(weather.speed));
console.log(JSON.stringify({ok:true,graph:{nodes:network.nodes.length,edges:network.edges.length},routes:{fastMeters:Math.round(result.fastest.length),windMeters:Math.round(result.windAware.length),same:result.same},weather:{source:weather.source,at:weather.at,speed:weather.speed,from:weather.from}}));
