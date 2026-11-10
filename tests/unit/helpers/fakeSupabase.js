// A stand-in for the Supabase client, so tests can check which query a function builds without a network.
// Every query method (select, eq, or, order...) is recorded and returns the same query, and awaiting
// the query gives back fake.result. Example:
//   fake.result = { data: [...], error: null };
//   await listAdvisories({ category: 'Noise' });
//   fake.calls -> [['from','updates'], ['select', '...'], ['eq','state','Published'], ...]
export function makeFakeSb() {
  const fake = {
    calls: [],
    result: { data: [], error: null },
    user: null,
    authListener: null,
  };
  const query = new Proxy({}, {
    get(_, name) {
      if (name === 'then') return (res, rej) => Promise.resolve(fake.result).then(res, rej);
      return (...args) => { fake.calls.push([name, ...args]); return query; };
    },
  });
  fake.sb = {
    from: (table) => { fake.calls.push(['from', table]); return query; },
    rpc: (fn, args) => { fake.calls.push(['rpc', fn, args]); return query; },
    storage: {
      from: (bucket) => ({
        getPublicUrl: (path) => ({ data: { publicUrl: `https://storage.test/${bucket}/${path}` } }),
        upload: async (path) => { fake.calls.push(['upload', bucket, path]); return { error: null }; },
      }),
    },
    auth: {
      getUser: async () => ({ data: { user: fake.user } }),
      onAuthStateChange: (cb) => { fake.authListener = cb; return { data: { subscription: { unsubscribe() {} } } }; },
    },
  };
  // Only the query methods used after from()/rpc(), e.g. ['eq','state','Published'].
  fake.filters = () => fake.calls.filter(([n]) => !['from', 'rpc', 'select'].includes(n));
  fake.reset = () => { fake.calls.length = 0; fake.result = { data: [], error: null }; };
  return fake;
}

// One shared fake for a test file. Mock the real client with it like this:
//   vi.mock('../../src/shared/supabase.js', async (orig) =>
//     ({ ...(await orig()), sb: (await import('./helpers/fakeSupabase.js')).fake.sb }));
export const fake = makeFakeSb();
