import fs from 'node:fs';
import {gzipSync} from 'node:zlib';
for(const name of ['dataset','weather','forecast-annual', 'forecast-eb30']) {
 const raw=fs.readFileSync(`public/data/${name}.json`);
 const zipped=gzipSync(raw,{level:9});
 fs.writeFileSync(`public/data/${name}.json.gz`,zipped);
 console.log(`${name}: ${(raw.length/1e6).toFixed(2)} MB → ${(zipped.length/1e6).toFixed(2)} MB`);
}
