import {spawnSync} from 'node:child_process';
const files=['browser.mjs','dashboard-browser.mjs','decisions-browser.mjs','evidence-scope-browser.mjs','forecast-browser.mjs','forecast-modes-browser.mjs','collision-forecast-browser.mjs','compressed-data-browser.mjs','fullscreen.mjs','persistence-browser.mjs','spatial-browser.mjs','weather-browser.mjs','historical-weighting-browser.mjs','annual-browser.mjs','eb30-browser.mjs','inspection-review-browser.mjs','forecast-link-browser.mjs','unsaved-review-browser.mjs'];
const failed=[];for(const file of files){console.log('Running '+file);const r=spawnSync(process.execPath,['tests/'+file],{stdio:'inherit',timeout:90000});if(r.status!==0)failed.push(file);}
console.log(JSON.stringify({total:files.length,failed}));if(failed.length)process.exit(1);
