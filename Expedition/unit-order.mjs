const weaponRank = weapon => weapon.type === 'ranged' ? 0 : weapon.type === 'melee' ? 1 : 2;

export function orderedUnitEntries(collection, entries = []) {
  return collection === 'weapons'
    ? [...entries].sort((left, right) => weaponRank(left) - weaponRank(right))
    : entries;
}

export function unitMoveTarget(collection, entries, index, direction) {
  const target = index + direction;
  if (index < 0 || target < 0 || target >= entries.length) return -1;
  if (collection === 'weapons' && weaponRank(entries[index]) !== weaponRank(entries[target])) return -1;
  return target;
}
