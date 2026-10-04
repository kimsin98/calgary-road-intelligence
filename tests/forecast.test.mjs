import test from 'node:test';import assert from 'node:assert/strict';import {forecast} from '../src/forecast.mjs';
const locations=['a','b'].map(id=>({id,name:id}));const e=(location,date)=>({location,date});
test('test outcomes never change training coefficients or predictions',()=>{const history=['2025-03-01','2025-04-01','2025-05-01','2025-06-01','2025-09-01','2025-11-01'].map(d=>e('a',d));const a=forecast(history,locations),b=forecast([...history,...Array.from({length:20},()=>e('b','2025-12-01'))],locations);assert.deepEqual(a.coefficients,b.coefficients);assert.deepEqual(a.top.map(r=>r.predicted),b.top.map(r=>r.predicted));assert.equal(b.unseenFutureEvents-a.unseenFutureEvents,20)});
test('future windows exclude cutoff and include horizon endpoint',()=>{const r=forecast([e('a','2025-03-01'),e('a','2025-11-30'),e('a','2025-12-07'),e('a','2025-12-08')],locations,{horizon:7});assert.equal(r.evaluation.total,1);assert.equal(r.end,'2025-12-07');assert.ok(r.top.every(x=>Number.isFinite(x.predicted)&&x.predicted>0))});

test('forecast comparison uses matching history and excludes later outcomes',()=>{
  const history=['2025-03-01','2025-04-01','2025-05-01','2025-06-01','2025-09-01','2025-11-01'].map(d=>e('a',d));
  const a=forecast(history,locations),b=forecast([...history,...Array.from({length:20},()=>e('b','2025-12-01'))],locations);
  assert.equal(a.comparison.start,'2025-09-02');
  assert.deepEqual(a.comparison,b.comparison);
  assert.equal(a.comparison.retained,1);
  assert.equal(a.comparison.reactiveTop[0].count,1);
  assert.equal(b.evaluation.reactiveCoverage,0);
});

test('future forecast extends beyond snapshot without fabricated outcomes',()=>{
 const history=['2025-03-01','2025-04-01','2025-05-01','2025-06-01','2025-12-31'].map(d=>e('a',d));
 const r=forecast(history,locations,{mode:'future',cutoff:'2025-12-31',dataEnd:'2025-12-31',horizon:30});
 assert.equal(r.end,'2026-01-30');assert.equal(r.evaluation,null);assert.equal(r.unseenFutureEvents,null);
 assert.ok(r.rows.every(x=>x.target===null));assert.ok(r.top.every(x=>x.predicted>0));
 assert.throws(()=>forecast(history,locations,{mode:'future',cutoff:'2026-01-30',dataEnd:'2025-12-31'}),/latest dataset date/);
 assert.throws(()=>forecast(history,locations,{cutoff:'2025-11-30',dataEnd:'2025-12-07',horizon:30}),/entire forecast window/);
});
