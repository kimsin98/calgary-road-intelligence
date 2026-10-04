import fs from 'node:fs';import Papa from 'papaparse';
const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Edmonton',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23',weekday:'short'});
const number=value=>value===''||value===undefined?null:Number.isFinite(+value)?+value:null;
const hours=[];
for(let month=1;month<=12;month++){
 const csv=fs.readFileSync(`data/raw/weather/2025-${String(month).padStart(2,'0')}.csv`,'utf8');const parsed=Papa.parse(csv.replace(/^\uFEFF/,''),{header:true,skipEmptyLines:true});if(parsed.errors.some(e=>e.code!=='TooFewFields'))throw Error(JSON.stringify(parsed.errors));
 for(const row of parsed.data){if(row['Climate ID']!=='3031092')throw Error('Wrong station');
 // ECCC LST is fixed Mountain Standard Time (UTC-7), including summer.
 const utc=new Date(Date.parse(row['Date/Time (LST)'].replace(' ','T')+':00-07:00')).toISOString();const parts=Object.fromEntries(formatter.formatToParts(new Date(utc)).map(p=>[p.type,p.value]));
 hours.push({utc,date:`${parts.year}-${parts.month}-${parts.day}`,hour:+parts.hour,weekend:['Sat','Sun'].includes(parts.weekday),temp:number(row['Temp (°C)']),visibility:number(row['Visibility (km)']),wind:number(row['Wind Spd (km/h)']),description:!row.Weather||row.Weather==='NA'?'':row.Weather,lst:row['Date/Time (LST)']});
 }
}
if(new Set(hours.map(h=>h.utc)).size!==hours.length)throw Error('Duplicate hours');
const manifest=JSON.parse(fs.readFileSync('data/weather-manifest.json'));const audit={station:'CALGARY INTL A',stationID:50430,climateID:'3031092',longitude:-114.01,latitude:51.12,timezone:'Source LST = UTC-7; display America/Edmonton',hours:hours.length,tempMissing:hours.filter(h=>h.temp===null).length,visibilityMissing:hours.filter(h=>h.visibility===null).length,descriptionUnavailable:hours.filter(h=>!h.description).length,downloadedAt:manifest.downloadedAt,firstUTC:hours[0].utc,lastUTC:hours.at(-1).utc,note:'Airport station is city-wide context, not local road surface measurements. Weather descriptions identify reported snow/rain; blank descriptions do not prove clear weather. Precipitation amount is not used.'};
fs.writeFileSync('public/data/weather.json',JSON.stringify({audit,hours}));fs.writeFileSync('reports/weather-audit.json',JSON.stringify(audit,null,2));console.log(audit);
