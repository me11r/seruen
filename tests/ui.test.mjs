import test from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';import {readFile} from 'node:fs/promises';import {parseIntent,retrieve,fallback} from '../lib/search.mjs';
const places=JSON.parse(await readFile(new URL('../data/places.json',import.meta.url),'utf8'));
const wait=()=>new Promise(r=>setTimeout(r,30));
test('UI: scenarios, markers, refinements, languages, location denial and failures',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost:3000/#app'});const {window}=dom;
 for(const k of ['window','document','location','localStorage','navigator'])Object.defineProperty(globalThis,k,{value:window[k],configurable:true});globalThis.innerWidth=1280;globalThis.CSS={escape:s=>s};window.HTMLElement.prototype.scrollIntoView=function(){};
 let mapEvents={},tileEvents={},markerList=[],unavailable=false;
 const makeMap=()=>({setView(){return this;},on(k,fn){mapEvents[k]=fn;return this;},getZoom(){return 14},setZoom(){},remove(){},invalidateSize(){}});
 const L={map:makeMap,tileLayer:()=>({addTo(){return this;},on(k,fn){tileEvents[k]=fn;return this;}}),divIcon:x=>x,marker:(coords,opts)=>{const m={coords,opts,events:{},addTo(){markerList.push(this);return this;},on(k,fn){this.events[k]=fn;return this;},remove(){markerList=markerList.filter(x=>x!==this);}};return m;}};globalThis.L=window.L=L;
 globalThis.fetch=async(url,opts)=>{if(unavailable)throw Error('offline');if(url==='/api/config')return {json:async()=>({mode:'demo',count:places.length,mapKey:''})};const b=JSON.parse(opts.body),intent=parseIntent(b.query,b.context),found=retrieve(places,b.position,intent,b.query),answer=fallback(found,b.language);return {ok:true,json:async()=>({...answer,intent,mode:'demo',recommendations:answer.recommendations.map(r=>({...found.find(p=>p.id===r.id),...r}))})};};
 const $=s=>document.querySelector(s);await import('../public/app.js?test');assert.equal(document.documentElement.lang,'kk');assert.match($('#mode').textContent,/Демо/);assert.equal(markerList.length,1);
 $('[data-scenario="0"]').click();await wait();assert.ok(document.querySelectorAll('.place-card').length>0);assert.equal(markerList.length,document.querySelectorAll('.place-card').length+1);
 const first=$('[data-select]');first.click();assert.ok($('.place-card.selected'));const id=first.dataset.select;assert.ok($('#card-'+id).classList.contains('selected'));
 const m=markerList.find(m=>m.events.click);m.events.click();assert.ok($('.place-card.selected'));
 $('[data-follow="remaining"]').click();await wait();assert.ok($('[data-time="30"]').classList.contains('chosen'));
 for(const lang of ['ru','en','kk']){$('#language').value=lang;$('#language').dispatchEvent(new window.Event('change'));await wait();assert.equal(document.documentElement.lang,lang);assert.equal(localStorage.getItem('seruen-language'),lang);assert.ok($('.place-card'));}
 Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition:(_ok,fail)=>fail({code:1})},configurable:true});$('#geo').click();assert.ok($('#notice').textContent.includes('анықталмады'));
 tileEvents.tileerror();assert.equal($('#map-message').hidden,false);assert.ok($('#map-message').textContent.includes('жүктелмеді'));assert.ok($('#search'));
 mapEvents.click({latlng:{lat:51.08909,lng:71.40733}});assert.equal($('#location').value,'custom');assert.equal(document.querySelectorAll('.place-card').length,0);
 $('#map-tab').click();assert.ok($('.workspace').classList.contains('show-map'));$('#list-tab').click();assert.ok(!$('.workspace').classList.contains('show-map'));
 unavailable=true;$('#search').click();await wait();assert.ok($('[role="alert"]'));assert.ok($('#retry'));unavailable=false;$('#retry').click();await wait();assert.ok($('.place-card'));
 dom.window.close();
});
