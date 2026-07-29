import test from 'node:test';
import assert from 'node:assert/strict';
import { billingReturnPage } from '../src/main/gateway/billing-pages.ts';

test('billing success page explains automatic credit refresh without exposing account data',()=>{const page=billingReturnPage('success');assert.match(page,/Payment successful/);assert.match(page,/refreshing your credit balance automatically/);assert.doesNotMatch(page,/Authentication required/);assert.match(page,/Content|<!doctype html>/)});

test('billing cancel page confirms that no charge occurred',()=>{const page=billingReturnPage('cancel');assert.match(page,/Checkout canceled/);assert.match(page,/not charged/i);assert.doesNotMatch(page,/Payment successful/)});
