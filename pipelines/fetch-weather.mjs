import fs from 'node:fs';import crypto from 'node:crypto';
fs.mkdirSync('data/raw/weather',{recursive:true});const files=[];
for(let month=1;month<=12;month++){
 const url=`https://climate.weather.gc.ca/climate_data/bulk_data_e.html?format=csv&stationID=50430&Year=2025&Month=${month}&Day=1&timeframe=1&submit=Download+Data`;
 const response=await fetch(url);if(!response.ok)throw Error(`Weather ${month}: ${response.status}`);const csv=await response.text();if(!csv.includes('CALGARY INTL A')||!csv.includes('Date/Time (LST)'))throw Error('Unexpected weather data');
 const path=`data/raw/weather/2025-${String(month).padStart(2,'0')}.csv`;fs.writeFileSync(path,csv);files.push({path,url,sha256:crypto.createHash('sha256').update(csv).digest('hex')});console.log(`Weather month ${month} downloaded`);
}
fs.writeFileSync('data/weather-manifest.json',JSON.stringify({downloadedAt:new Date().toISOString(),stationID:50430,files},null,2));
