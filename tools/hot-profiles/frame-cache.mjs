/** Share concurrent captures and retain only the most recent frame briefly. */
export function frameCache(interval = 250, now = Date.now) {
  let value,
    expires = 0,
    pending,
    pendingGeneration,
    generation = 0;
  const cache = {
    get(capture) {
      if (value && now() < expires) return Promise.resolve(value);
      if (pending)
        return pendingGeneration === generation
          ? pending
          : pending.catch(() => {}).then(() => cache.get(capture));
      const current = generation;
      const work = Promise.resolve()
        .then(capture)
        .then((frame) => {
          if (current === generation) {
            value = frame;
            expires = now() + interval;
          }
          return frame;
        })
        .finally(() => {
          if (pending === work) pending = undefined;
        });
      pendingGeneration = current;
      pending = work;
      return work;
    },
    clear() {
      generation++;
      value = undefined;
      expires = 0;
    },
  };
  return cache;
}
