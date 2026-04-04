
type Resolver<Args extends unknown[]> = (...args: Args) => string;

/**
 * A generic memoize function with a custom key resolver.
 * If memoized function is recursively called with the same key, it will return null.
 */
function memoize<Args extends unknown[], Result>(
  fn: (...args: Args) => Result | null,
  resolver?: Resolver<Args>
): (...args: Args) => Result | null {
  const cache = new Map<string, Result | null>();

  return (...args: Args): Result | null => {
    // If a resolver is provided, use it; otherwise, default to JSON.stringify
    const key = resolver ? resolver(...args) : JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key) || null;
    }

    // TRICKY: eagerly set the value to null before computing the value so that
    // recursive calls resolve to null.
    cache.set(key, null);

    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}

export {memoize};
