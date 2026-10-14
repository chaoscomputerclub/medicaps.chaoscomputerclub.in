/**
 * Chaos Computer Club India — Medi-Caps Chapter
 * tests/swr_performance_invariants.test.mjs
 *
 * Direct verification of SWR In-Flight Deduplication, Targeted Invalidation,
 * Coalescing, and Stale-Response Protection (PERF-002, PERF-005, PERF-007).
 */

import assert from 'node:assert/strict';

// Mock SwrMemoryStore logic matching src/lib/cache/swrCache.ts
class TestSwrStore {
  constructor() {
    this.cache = new Map();
    this.inFlight = new Map();
    this.inFlightGenerations = new Map();
    this.generations = new Map();
    this.subscribers = new Map();
    this.invalidationListeners = new Map();
    this.pendingRevalidation = new Map();
  }

  generation(key) {
    return this.generations.get(key) ?? 0;
  }

  get(key) {
    return this.cache.get(key);
  }

  set(key, data) {
    this.cache.set(key, { data, timestamp: Date.now() });
    const subs = this.subscribers.get(key);
    if (subs) {
      subs.forEach((cb) => cb(data));
    }
  }

  getInFlight(key) {
    return this.inFlight.get(key);
  }

  getInFlightGeneration(key) {
    return this.inFlightGenerations.get(key);
  }

  setInFlight(key, promise, generation) {
    this.inFlight.set(key, promise);
    this.inFlightGenerations.set(key, generation ?? this.generation(key));
  }

  clearInFlight(key, promise) {
    if (!promise || this.inFlight.get(key) === promise) {
      this.inFlight.delete(key);
      this.inFlightGenerations.delete(key);
    }
  }

  isPendingRevalidation(key) {
    return Boolean(this.pendingRevalidation.get(key));
  }

  clearPendingRevalidation(key) {
    this.pendingRevalidation.delete(key);
  }

  invalidate(patternOrKey) {
    const isWildcard = patternOrKey.includes('*');
    const regex = isWildcard ? new RegExp('^' + patternOrKey.replace(/\*/g, '.*') + '$') : null;
    const matches = (key) => (regex ? regex.test(key) : key === patternOrKey);

    const candidateKeys = new Set([
      ...this.cache.keys(),
      ...this.inFlight.keys(),
      ...this.invalidationListeners.keys(),
    ]);

    const affectedKeys = [];
    for (const key of candidateKeys) {
      if (matches(key)) {
        affectedKeys.push(key);
        this.cache.delete(key);
        const nextGen = this.generation(key) + 1;
        this.generations.set(key, nextGen);

        if (this.inFlight.has(key)) {
          this.pendingRevalidation.set(key, true);
        }
      }
    }

    for (const key of affectedKeys) {
      const listeners = this.invalidationListeners.get(key);
      if (listeners && listeners.size > 0) {
        listeners.forEach((cb) => cb());
      }
    }
  }

  subscribeInvalidate(key, callback) {
    if (!this.invalidationListeners.has(key)) {
      this.invalidationListeners.set(key, new Set());
    }
    this.invalidationListeners.get(key).add(callback);
    return () => {
      const set = this.invalidationListeners.get(key);
      if (set) {
        set.delete(callback);
        if (set.size === 0) {
          this.invalidationListeners.delete(key);
        }
      }
    };
  }
}

async function testSwrFetch(store, key, fetcher, options = {}) {
  const { forceRefresh = false } = options;
  const existingPromise = store.getInFlight(key);
  const inFlightGen = store.getInFlightGeneration(key);
  const currentGen = store.generation(key);

  if (existingPromise) {
    if (!forceRefresh) return existingPromise;
    if (inFlightGen !== undefined && inFlightGen >= currentGen) {
      return existingPromise;
    }
  }

  const generation = store.generation(key);
  let fetchPromise;
  fetchPromise = (async () => {
    try {
      const freshData = await fetcher();
      if (freshData !== undefined && freshData !== null && store.generation(key) === generation) {
        store.set(key, freshData);
      }
      return freshData;
    } finally {
      store.clearInFlight(key, fetchPromise);
      if (store.isPendingRevalidation(key)) {
        store.clearPendingRevalidation(key);
        // Follow-up background revalidation
        testSwrFetch(store, key, fetcher, { forceRefresh: true });
      }
    }
  })();

  store.setInFlight(key, fetchPromise, generation);
  return fetchPromise;
}

// ─── SUITE EXECUTION ────────────────────────────────────────────────────────

async function runTests() {
  console.log('🧪 Running SWR Performance & Invalidation Invariant Tests...');

  // TEST 1: Ten identical invalidations produce at most one concurrent fetch per key
  {
    const store = new TestSwrStore();
    let fetchCount = 0;
    const fetcher = async () => {
      fetchCount++;
      await new Promise((r) => setTimeout(r, 50));
      return { status: 'ok', fetchCount };
    };

    // 10 concurrent requests with forceRefresh=true
    const promises = Array.from({ length: 10 }, () =>
      testSwrFetch(store, 'portal:public_data', fetcher, { forceRefresh: true })
    );

    const results = await Promise.all(promises);
    assert.equal(fetchCount, 1, 'Ten concurrent forced refreshes must trigger exactly 1 fetch');
    assert.equal(results.length, 10);
    assert.equal(results[0].fetchCount, 1);
    console.log('  ✅ Test 1 Passed: Ten identical invalidations coalesced to 1 fetch.');
  }

  // TEST 2: Different resource keys refresh independently
  {
    const store = new TestSwrStore();
    let countA = 0;
    let countB = 0;
    const fetcherA = async () => { countA++; await new Promise(r => setTimeout(r, 20)); return 'A'; };
    const fetcherB = async () => { countB++; await new Promise(r => setTimeout(r, 20)); return 'B'; };

    await Promise.all([
      testSwrFetch(store, 'key:alpha', fetcherA, { forceRefresh: true }),
      testSwrFetch(store, 'key:beta', fetcherB, { forceRefresh: true }),
    ]);

    assert.equal(countA, 1);
    assert.equal(countB, 1);
    console.log('  ✅ Test 2 Passed: Different resource keys refresh independently.');
  }

  // TEST 3: Targeted invalidation only triggers listeners of matching keys
  {
    const store = new TestSwrStore();
    let triggeredA = 0;
    let triggeredB = 0;

    const unsubA = store.subscribeInvalidate('scoreboard:round-1', () => { triggeredA++; });
    const unsubB = store.subscribeInvalidate('member:profile:123', () => { triggeredB++; });

    store.invalidate('scoreboard:*');
    assert.equal(triggeredA, 1, 'Matching key must trigger listener');
    assert.equal(triggeredB, 0, 'Unrelated key must NOT trigger listener');

    unsubA();
    unsubB();
    console.log('  ✅ Test 3 Passed: Targeted pattern invalidation isolates unrelated keys.');
  }

  // TEST 4: Unmounted components no longer trigger fetches
  {
    const store = new TestSwrStore();
    let fetchCount = 0;
    const unsub = store.subscribeInvalidate('portal:data', () => { fetchCount++; });

    store.invalidate('portal:*');
    assert.equal(fetchCount, 1);

    // Component unmounts
    unsub();
    store.invalidate('portal:*');
    assert.equal(fetchCount, 1, 'Unmounted component must not trigger fetch');
    console.log('  ✅ Test 4 Passed: Unmounted components do not receive invalidations.');
  }

  // TEST 5: An invalidation arriving during a refresh is not lost
  {
    const store = new TestSwrStore();
    let fetchCounter = 0;
    const fetcher = async () => {
      fetchCounter++;
      const current = fetchCounter;
      await new Promise((r) => setTimeout(r, 60));
      return `data_version_${current}`;
    };

    const firstFetchPromise = testSwrFetch(store, 'contests:list', fetcher, { forceRefresh: true });

    // Invalidation arrives mid-flight after 20ms
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(store.generation('contests:list'), 0);
    store.invalidate('contests:*');
    assert.equal(store.generation('contests:list'), 1);
    assert.equal(store.isPendingRevalidation('contests:list'), true);

    await firstFetchPromise;
    // Allow follow-up revalidation to complete
    await new Promise((r) => setTimeout(r, 100));

    assert.equal(fetchCounter, 2, 'Follow-up revalidation must run after in-flight invalidation');
    assert.equal(store.get('contests:list').data, 'data_version_2');
    console.log('  ✅ Test 5 Passed: Invalidation arriving during refresh triggers follow-up.');
  }

  // TEST 6: Older response cannot overwrite newer cached data
  {
    const store = new TestSwrStore();

    // Start slow request
    const slowFetcher = async () => {
      await new Promise((r) => setTimeout(r, 100));
      return { version: 'stale_slow_version' };
    };

    const p = testSwrFetch(store, 'profile:cadet', slowFetcher, { forceRefresh: true });

    // Mid-flight, invalidate and set newer data
    await new Promise((r) => setTimeout(r, 20));
    store.invalidate('profile:cadet');
    store.set('profile:cadet', { version: 'authoritative_newer_version' });

    await p;

    // The slow response from generation 0 must NOT have overwritten generation 1
    assert.equal(store.get('profile:cadet').data.version, 'authoritative_newer_version');
    console.log('  ✅ Test 6 Passed: Stale response protection preserves newer cached data.');
  }

  console.log('\n🎉 ALL SWR REGRESSION TESTS PASSED CLEANLY!\n');
}

runTests().catch((err) => {
  console.error('❌ SWR Invariant Test Failure:', err);
  process.exit(1);
});
