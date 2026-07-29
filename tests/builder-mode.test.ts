import test from 'node:test';
import assert from 'node:assert/strict';
import { selectBuilderMode } from '../src/main/builder-mode.ts';

test('Foundry Cloud can be selected before a user has signed in',()=>{
  assert.equal(selectBuilderMode('hosted'),'hosted');
});

test('users can switch back to their own API key',()=>{
  assert.equal(selectBuilderMode('byok'),'byok');
});
