import fs from 'node:fs';
const base='https://data.calgary.ca/resource/';fs.mkdirSync('data/raw',{recursive:true});
async function get(file,id,params){const url=base+id+'.json?'+new URLSearchParams(params);const r=await fetch(url);if(!r.ok)throw Error(`${r.status} ${url}`);const data=await r.json();fs.writeFileSync('data/raw/'+file,JSON.stringify(data));console.log(file,data.length);return data}
const traffic=[];const upper=new Date().toISOString().replace('Z','');
for(let offset=0;;offset+=10000){const rows=await get('traffic-page.json','35ra-9556',{'$where':"start_dt_utc >= '2023-01-01T00:00:00' AND start_dt_utc < '"+upper+"'",'$limit':'10000','$offset':String(offset),'$order':'start_dt_utc,id'});traffic.push(...rows);if(rows.length<10000)break;}
fs.writeFileSync('data/raw/traffic-official.json',JSON.stringify(traffic));fs.unlinkSync('data/raw/traffic-page.json');
for(const [i,file] of ['roads.json','roads-next.json','roads-last.json'].entries())await get(file,'4dx8-rtm5',{'$limit':'50000','$offset':String(i*50000),'$select':'segment_id,full_name,ctp_class,line','$order':'segment_id'});
await get('volumes.json','cauu-7hnw',{'$limit':'10000'});
