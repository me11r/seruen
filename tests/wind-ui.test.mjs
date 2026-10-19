import test from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';import {readFile} from 'node:fs/promises';import {windView,mountWind} from '../public/wind.js';
const network=JSON.parse(await readFile(new URL('../data/wind/network.json',import.meta.url)));const wait=()=>new Promise(r=>setTimeout(r,20));
test('wind UI: simulated/real separation, sliders, both routes, weather failure, teardown',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost:3000/#wind'});globalThis.window=dom.window;globalThis.document=dom.window.document;const $=s=>document.querySelector(s);let weatherFail=false,weatherCalls=0,removed=false;
 const layer=()=>({addTo(){return this;},remove(){},on(){return this;}});const L={map:()=>({fitBounds(){},remove(){removed=true;}}),control:{zoom:layer},tileLayer:layer,polyline:layer,marker:layer,divIcon:x=>x};globalThis.L=window.L=L;
 globalThis.fetch=async url=>{if(url==='/api/wind-network')return {ok:true,json:async()=>network};weatherCalls++;return {ok:!weatherFail,json:async()=>({speed:6,from:270,at:new Date().toISOString()})};};
 for(const lang of ['ru','kk','en']){
  $('#root').innerHTML=windView(lang);const destroy=mountWind(lang);await wait();assert.equal(weatherCalls,0);assert.ok($('[data-route="fastest"]'));assert.ok($('[data-route="windAware"]'));assert.ok($('#air-arrow').style.transform.includes('210deg'));assert.ok($('#wind-sources a'));
  $('#wind-speed').value='0';$('#wind-speed').dispatchEvent(new window.Event('input'));assert.ok($('.route-explanation').textContent.length>30);
  $('[data-route="fastest"]').click();assert.ok($('[data-route="fastest"]').classList.contains('selected'));
  $('#wind-return').checked=false;$('#wind-return').dispatchEvent(new window.Event('change'));assert.equal($('[data-leg="back"]').disabled,true);
  $('#wind-real').click();await wait();assert.equal($('#wind-sliders').hidden,true);assert.ok($('#air-arrow').style.transform.includes('90deg'));assert.ok($('#weather-meta a'));assert.equal($('#wind-demo').getAttribute('aria-pressed'),'false');
  weatherFail=true;$('#wind-refresh').click();await wait();assert.ok($('#wind-status').classList.contains('error'));assert.equal($('#wind-options').innerHTML,'');assert.equal($('#wind-real').getAttribute('aria-pressed'),'true');
  $('#wind-demo').click();assert.equal($('#wind-sliders').hidden,false);assert.ok($('[data-route="windAware"]'));assert.equal($('#weather-meta').textContent,'');destroy();assert.ok(removed);weatherCalls=0;weatherFail=false;
 }
 dom.window.close();
});
