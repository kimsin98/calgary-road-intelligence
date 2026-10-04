import test from 'node:test';
import assert from 'node:assert/strict';
import {optimize,scoreWindow,describeComparison} from '../src/decision.mjs';
import {rank,defaults} from '../src/analysis.mjs';
const locations=['a','b','c'].map(id=>({id,name:id}));
const event=(location,date)=>({id:location+date,location,date,hour:8,weekend:false,category:'Signals'});
test('validation records cannot change chosen search weights',()=>{
 const history=[event('a','2025-04-05'),event('a','2025-05-05'),event('b','2025-07-05'),event('b','2025-08-05'),event('c','2026-06-05')];
 const a=optimize(history,locations,{...defaults,capacity:1});
 const b=optimize([...history,...Array.from({length:40},(_,i)=>({...event('c','2026-07-05'),id:'future'+i}))],locations,{...defaults,capacity:1});
 assert.deepEqual(a.weights,b.weights);assert.deepEqual(a.candidates,b.candidates);assert.equal(b.validation.candidate-a.validation.candidate,40);
 assert.equal(a.candidates.length,21);
});
test('search ties favour count-only; empty filtered evidence remains visible',()=>{
 const result=optimize([],locations,defaults);assert.deepEqual(result.weights,[1,0,0]);assert.equal(result.validation.total,0);assert.equal(result.tuningTotal,0);
});
test('future coverage starts after history cutoff with fixed capacity',()=>{
 const result=scoreWindow([event('a','2025-11-30'),event('b','2025-12-01'),event('a','2025-12-30'),event('a','2025-12-31')],locations,{...defaults,capacity:1},'2025-11-30');
 assert.equal(result.total,2);assert.equal(result.candidate,1);assert.equal(result.size,1);
});
test('comparison shows rank movements and omits percentage at different capacities',()=>{
 const events=[event('a','2025-04-01'),event('a','2025-04-02'),event('b','2025-12-01'),event('c','2025-04-03')];
 const before=rank(events,locations,{...defaults,capacity:1,weights:[1,0,0]});
 const after=rank(events,locations,{...defaults,capacity:2,weights:[0,1,0]});
 const result=describeComparison(before,after);assert.equal(result.overlap,null);assert.ok(result.changes.some(r=>r.status==='entered'));assert.ok(result.changes.every(r=>typeof r.row.score==='number'));
});
