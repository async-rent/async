/**
 * Groups items by a key, keeping the order they arrive in.
 *
 * `Map.groupBy` would do the same, but it needs an ES2024 lib and core is
 * consumed as source by apps that may compile against an older one. A reduce
 * keeps the same shape without raising that floor.
 */
export function groupBy<T, K>(items: readonly T[], keyOf: (item: T) => K): Map<K, T[]> {
  return items.reduce((groups, item) => {
    const key = keyOf(item);
    const group = groups.get(key);

    if (group) group.push(item);
    else groups.set(key, [item]);

    return groups;
  }, new Map<K, T[]>());
}
