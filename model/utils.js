// utils.js
export function l2Normalize(arr) {
  const sumSq = arr.reduce((s, v) => s + v * v, 0);
  const norm = Math.sqrt(sumSq) || 1e-12;
  return arr.map(v => v / norm);
}

export function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export function cosineSimilarity(a, b) {
  // expects normalized vectors -> dot product equals cosine
  return dot(a, b);
}

export function majorityVote(items) {
  const counts = {};
  for (const it of items) counts[it] = (counts[it] || 0) + 1;
  let maxK = null, maxV = -1;
  for (const k of Object.keys(counts)) {
    if (counts[k] > maxV) { maxV = counts[k]; maxK = k; }
  }
  return { label: maxK, count: maxV, counts };
}
