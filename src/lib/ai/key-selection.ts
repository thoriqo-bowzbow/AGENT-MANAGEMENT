export type KeyCandidate = {
  priority: number;
  lastUsedAt: Date | string | null;
  createdAt: Date | string;
};

function timeValue(value: Date | string | null) {
  if (!value) {
    return 0;
  }

  return new Date(value).getTime();
}

export function sortKeyCandidates<T extends KeyCandidate>(keys: T[]) {
  return [...keys].sort((left, right) => {
    if (left.priority !== right.priority) {
      return left.priority - right.priority;
    }

    const leftUsed = timeValue(left.lastUsedAt);
    const rightUsed = timeValue(right.lastUsedAt);

    if (leftUsed !== rightUsed) {
      return leftUsed - rightUsed;
    }

    return timeValue(left.createdAt) - timeValue(right.createdAt);
  });
}
