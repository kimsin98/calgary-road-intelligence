import fs from 'node:fs';
import crypto from 'node:crypto';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const roads=['roads','roads-next','roads-last'].flatMap(n=>read(`data/raw/${n}.json`));
const raw=read('data/raw/traffic-official.json');
const project=([lon,lat])=>[(lon+114.1)*69900,(lat-51)*111200];
const bins=new Map();
const lines=[];
for(const r of roads){for(const coords of r.line?.coordinates??[]){const ps=coords.map(project);for(let i=1;i<ps.length;i++){const a=ps[i-1],b=ps[i];const seg={a,b,r};lines.push(seg);for(let x=Math.floor(Math.min(a[0],b[0])/100);x<=Math.floor(Math.max(a[0],b[0])/100);x++)for(let y=Math.floor(Math.min(a[1],b[1])/100);y<=Math.floor(Math.max(a[1],b[1])/100);y++){let key=`${x},${y}`;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(seg)}}}}
const distance=(p,a,b)=>{let dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)};
const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Edmonton',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23',weekday:'short'});
const events=[], seen=new Set();let rejected=0,duplicates=0,matched=0;
for(const r of raw){const lon=+r.longitude,lat=+r.latitude;if(!Number.isFinite(lon)||!Number.isFinite(lat)||lon< -114.5||lon> -113.8||lat<50.8||lat>51.3){rejected++;continue}if(seen.has(r.id)){duplicates++;continue}seen.add(r.id);const date=new Date(r.start_dt_utc+'Z');if(Number.isNaN(+date)){rejected++;continue}const parts=Object.fromEntries(fmt.formatToParts(date).map(p=>[p.type,p.value]));const local=`${parts.year}-${parts.month}-${parts.day}`;const p=project([lon,lat]);let nearest=null,d=Infinity;
for(let x=Math.floor(p[0]/100)-1;x<=Math.floor(p[0]/100)+1;x++)for(let y=Math.floor(p[1]/100)-1;y<=Math.floor(p[1]/100)+1;y++)for(const s of bins.get(`${x},${y}`)??[]){const v=distance(p,s.a,s.b);if(v<d){d=v;nearest=s.r}}
const ok=d<=50&&nearest; if(ok)matched++;
const key=ok?`road:${nearest.segment_id}`:`grid:${Math.floor(p[0]/150)},${Math.floor(p[1]/150)}`;
const description=r.description?.trim()??'';let category=/signal|traffic light/i.test(description)?'Signals':/stall|breakdown|disabled/i.test(description)?'Stalled vehicle':/snow|ice|icy|flood|debris|hazard|slippery/i.test(description)?'Road conditions':/collision|crash|multi.vehicle|vehicle incident/i.test(description)?'Collision-related':'Other / unverified';
events.push({id:r.id,utc:date.toISOString(),date:local,hour:+parts.hour,weekend:['Sat','Sun'].includes(parts.weekday),lon,lat,location:key,name:ok?nearest.full_name:r.incident_info?.trim()||'Unmatched area',reportedLocation:r.incident_info?.trim(),category,description,distance:ok?Math.round(d):null,count:1});}
const groups=new Map();for(const e of events){if(!groups.has(e.location))groups.set(e.location,{id:e.location,name:e.name,lon:0,lat:0,total:0,geometry:null});const g=groups.get(e.location);g.lon+=e.lon;g.lat+=e.lat;g.total++}
const roadIndex=new Map(roads.map(r=>[`road:${r.segment_id}`,r]));for(const g of groups.values()){g.lon/=g.total;g.lat/=g.total;g.geometry=roadIndex.get(g.id)?.line??null}
fs.mkdirSync('public/data',{recursive:true});const audit={downloadedAt:new Date().toISOString(),rawEvents:raw.length,events:events.length,duplicates,rejected,roads:roads.length,matched,matchRate:matched/events.length,locations:groups.size,first:events.map(e=>e.date).sort()[0],last:events.map(e=>e.date).sort().at(-1),timezone:'America/Edmonton',sourceTime:'UTC',countValues:[...new Set(raw.map(r=>r.count))],projection:'Local equirectangular metre approximation at latitude 51N; 50m matching threshold',categories:Object.fromEntries([...new Set(events.map(e=>e.category))].map(c=>[c,events.filter(e=>e.category===c).length]))};
fs.writeFileSync('public/data/dataset.json',JSON.stringify({audit,events,locations:[...groups.values()]}));
fs.writeFileSync('reports/data-audit.json',JSON.stringify(audit,null,2));
const sources=['traffic-official.json','roads.json','roads-next.json','roads-last.json'].map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(`data/raw/${file}`)).digest('hex')}));fs.writeFileSync('data/manifest.json',JSON.stringify({audit,sources},null,2));console.log(audit);
