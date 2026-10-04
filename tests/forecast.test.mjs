import test from 'node:test';import assert from 'node:assert/strict';import {forecast} from '../src/forecast.mjs';
const locations=['a','b'].map(id=>({id,name:id}));const e=(location,date)=>({location,date});
test('test outcomes never change training coefficients or predictions',()=>{const history=['2025-03-01','2025-04-01','2025-05-01','2025-06-01','2025-09-01','2026-06-01'].map(d=>e('a',d)).concat(e('a','2023-03-01'),e('a','2024-03-01'));const a=forecast(history,locations,{dataEnd:"2026-10-03"}),b=forecast([...history,...Array.from({length:20},()=>e('b','2026-07-01'))],locations,{dataEnd:'2026-10-03'});assert.deepEqual(a.coefficients,b.coefficients);assert.deepEqual(a.top.map(r=>r.predicted),b.top.map(r=>r.predicted));assert.equal(b.unseenFutureEvents-a.unseenFutureEvents,20)});
test('future windows exclude cutoff and include horizon endpoint',()=>{const r=forecast([e('a','2023-03-01'),e('a','2024-03-01'),e('a','2025-03-01'),e('a','2026-06-30'),e('a','2026-07-07'),e('a','2026-07-08')],locations,{horizon:7,dataEnd:'2026-07-08'});assert.equal(r.evaluation.total,1);assert.equal(r.end,'2026-07-07');assert.ok(r.top.every(x=>Number.isFinite(x.predicted)&&x.predicted>0))});

test('forecast comparison uses matching history and excludes later outcomes',()=>{
  const history=['2025-03-01','2025-04-01','2025-05-01','2025-06-01','2025-09-01','2026-06-01'].map(d=>e('a',d)).concat(e('a','2023-03-01'),e('a','2024-03-01'));
  const a=forecast(history,locations,{dataEnd:"2026-10-03"}),b=forecast([...history,...Array.from({length:20},()=>e('b','2026-07-01'))],locations,{dataEnd:"2026-10-03"});
  assert.equal(a.comparison.start,'2026-04-02');
  assert.deepEqual(a.comparison,b.comparison);
  assert.equal(a.comparison.retained,1);
  assert.equal(a.comparison.reactiveTop[0].count,1);
  assert.equal(b.evaluation.reactiveCoverage,0);
});

test('future forecast extends beyond snapshot without fabricated outcomes',()=>{
 const history=['2025-03-01','2025-04-01','2025-05-01','2025-06-01','2026-10-03'].map(d=>e('a',d)).concat(e('a','2023-03-01'),e('a','2024-03-01'));
 const r=forecast(history,locations,{mode:'future',cutoff:'2026-10-03',dataEnd:'2026-10-03',horizon:30});
 assert.equal(r.end,'2026-11-02');assert.equal(r.evaluation,null);assert.equal(r.unseenFutureEvents,null);
 assert.ok(r.rows.every(x=>x.target===null));assert.ok(r.top.every(x=>x.predicted>0));
 assert.throws(()=>forecast(history,locations,{mode:'future',cutoff:'2026-11-02',dataEnd:'2026-10-03'}),/latest dataset date/);
 assert.throws(()=>forecast(history,locations,{cutoff:'2026-06-30',dataEnd:'2026-07-07',horizon:30}),/complete observed forecast window|entire forecast window/);
});

test('all 2026 outcomes are excluded from training and parameter selection',()=>{
 const history=[2023,2024,2025].flatMap(y=>['03-01','04-01','06-01','07-01','09-01','10-01','12-01'].map(d=>e('a',y+'-'+d))).concat(e('a','2026-06-01'));
 const config={cutoff:'2026-06-30',horizon:30,dataEnd:'2026-10-03'};
 const a=forecast(history,locations,config),b=forecast([...history,...Array.from({length:30},()=>e('a','2026-07-03'))],locations,config);
 assert.deepEqual(a.trials,b.trials);assert.deepEqual(a.top.map(r=>r.predicted),b.top.map(r=>r.predicted));assert.equal(b.evaluation.total-a.evaluation.total,30);
 assert.ok(a.trainEnds.every(d=>d<'2026-01-01'));assert.ok(a.validationEnds.every(d=>d<'2026-01-01'));
});

test('expanding CV folds precede validation years and refit excludes 2026',()=>{
 const events=[2023,2024,2025].flatMap(y=>['03-01','04-01','07-01','10-01','12-01'].map(d=>e('a',y+'-'+d))).concat(e('a','2026-06-01'));
 const r=forecast(events,locations,{cutoff:'2026-06-30',dataEnd:'2026-10-03'});
 assert.deepEqual(r.crossValidation.folds,[{trainYears:[2023],validationYear:2024},{trainYears:[2023,2024],validationYear:2025}]);
 assert.equal(r.crossValidation.trials.length,4);assert.equal(r.trainEnds.length,12);
 for(const trial of r.crossValidation.trials)for(const fold of trial.folds){assert.ok(fold.trainYears.every(y=>y<fold.validationYear));assert.equal(fold.windows.length,4);assert.ok(fold.windows.every(w=>w.end<'2026-01-01'));}
});

test('type-aware model predicts only collision reports and keeps outcomes independent',()=>{
 const history=[2023,2024,2025].flatMap(y=>['03-01','04-01','07-01','10-01','12-01'].map(d=>({...e('a',y+'-'+d),category:'Collision-related'}))).concat({...e('a','2026-06-01'),category:'Signals'});
 const c={weighting:'learned',objective:'collision',cutoff:'2026-06-30',dataEnd:'2026-10-03',horizon:30};
 const a=forecast(history,locations,c),b=forecast([...history,{...e('a','2026-07-01'),category:'Signals'},{...e('a','2026-07-02'),category:'Collision-related'}],locations,c);
 assert.equal(b.evaluation.total,1);assert.deepEqual(a.coefficients,b.coefficients);assert.equal(a.features.length,10);assert.equal(a.top[0].count,1);assert.equal(a.top[0].baseline,0);assert.equal(a.top[0].x[4],Math.log(2));assert.ok(a.learnedEffects.every(x=>Number.isFinite(x.rateMultiplier)));
});

test('forecast equal and learned weighting are independent of target',()=>{
 const history=[2023,2024,2025].flatMap(y=>['03-01','04-01','07-01','10-01','12-01'].map(d=>({...e('a',y+'-'+d),category:'Collision-related'}))).concat({...e('a','2026-06-01'),category:'Signals'});
 const c={objective:'collision',cutoff:'2026-06-30',dataEnd:'2026-10-03'};
 const equal=forecast(history,locations,{...c,weighting:'equal'}),learned=forecast(history,locations,{...c,weighting:'learned'}),all=forecast(history,locations,{...c,objective:'all',weighting:'learned'});
 assert.equal(equal.features.length,6);assert.equal(learned.features.length,10);assert.equal(all.features.length,10);assert.equal(equal.evaluation.total,learned.evaluation.total);
});
