import test from 'node:test';import assert from 'node:assert/strict';import {analysisScope,resolveFocus,effectiveWeights} from '../src/domain/scope.mjs';
test('playback cutoff is isolated from analysis pages',()=>{const c={end:'2025-12-31'};assert.equal(analysisScope(c,'Evidence','2025-02-01'),c);assert.equal(analysisScope(c,'Map preview','2025-02-01').end,'2025-02-01')});
test('outside-scope selection is never silently replaced',()=>{assert.equal(resolveFocus([{id:'a'}],'b'),null)});
test('disabled or zero weights fall back explicitly',()=>{assert.deepEqual(effectiveWeights([0,1,0],false),{weights:[1,0,0],fallback:true});assert.throws(()=>effectiveWeights([NaN,1,0],true))});
