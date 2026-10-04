import {chromium} from '@playwright/test';import assert from 'node:assert/strict';
const b=await chromium.launch({args:['--no-sandbox']});
for(const fallback of [false,true]){
 const p=await b.newPage();if(fallback)await p.addInitScript(()=>{window.DecompressionStream=undefined;});
 const errors=[];p.on('pageerror',e=>errors.push(e.message));const requests=[];p.on('request',r=>requests.push(r.url()));
 await p.goto('http://localhost:5173/#map-preview');await p.getByRole('navigation',{name:'Dashboard pages'}).waitFor();await p.getByRole('button',{name:'Weather context',exact:true}).click();await p.getByRole('heading',{name:'Weather observations',exact:true}).waitFor();assert.ok(requests.some(u=>u.endsWith('/data/dataset.json.gz')));assert.ok(requests.some(u=>u.endsWith('/data/weather.json.gz')));assert.ok(!requests.some(u=>u.endsWith('/data/dataset.json')));assert.deepEqual(errors,[]);await p.close();console.log(fallback?'Fallback gzip decoder passed':'Native gzip decoder and weather page passed');
}
await b.close();
