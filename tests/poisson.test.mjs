import test from 'node:test';import assert from 'node:assert/strict';import {fitPoisson} from '../src/poisson.mjs';
test('intercept-only known counts recover mean rate',()=>{const rows=Array.from({length:100},(_,i)=>({x:[],target:i%2?3:1}));const result=fitPoisson(rows,.1);assert.ok(Math.abs(Math.exp(result.coefficients[0])-2)<.001);assert.ok(result.diagnostics.converged)});
test('training decreases objective and reports finite diagnostics',()=>{const rows=Array.from({length:100},(_,i)=>({x:[i%2],target:i%2?4:1}));const result=fitPoisson(rows,.01);assert.ok(result.diagnostics.loss<result.diagnostics.initialLoss);assert.ok(result.coefficients[1]>0);assert.ok(Number.isFinite(result.diagnostics.gradientNorm));assert.throws(()=>fitPoisson([],.1))});

test('duplicate feature aggregation preserves count likelihood',()=>{
 const duplicate=[{x:[0],target:0},{x:[0],target:2},{x:[1],target:1},{x:[1],target:3}];
 const averaged=[{x:[0],target:1},{x:[1],target:2}];
 const a=fitPoisson(duplicate,.01),b=fitPoisson(averaged,.01);
 a.coefficients.forEach((v,i)=>assert.ok(Math.abs(v-b.coefficients[i])<1e-10));
});
