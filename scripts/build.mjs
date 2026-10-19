import {mkdir,cp,access} from 'node:fs/promises';
await mkdir('public/vendor/leaflet',{recursive:true});await cp('node_modules/leaflet/dist','public/vendor/leaflet',{recursive:true});
await cp('node_modules/leaflet/LICENSE','public/vendor/leaflet/LICENSE.txt');
await access('data/places.json');await mkdir('dist',{recursive:true});
for(const p of ['public','lib','data','server.mjs','package.json'])await cp(p,`dist/${p}`,{recursive:true});
console.log('Built dist/. Run node --env-file-if-exists=.env dist/server.mjs (or npm start).');
