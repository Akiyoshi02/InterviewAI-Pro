/**
 * Classification Metrics Utility
 *
 * Provides confusion-matrix construction, precision, recall, F1-score
 * and overall accuracy calculation for AI vs SME score classification.
 *
 * Score bands:
 *   Excellent  81-100
 *   Good       61-80
 *   Average    41-60
 *   Below Avg  21-40
 *   Poor        0-20
 */

const LABELS = ['Poor', 'Below Avg', 'Average', 'Good', 'Excellent'];

/**
 * Classify a 0-100 numeric score into a performance band.
 * @param {number} score
 * @returns {string} label
 */
export function classifyScore(score) {
  const s = Number(score);
  if (!Number.isFinite(s)) return 'Poor';
  if (s <= 20) return 'Poor';
  if (s <= 40) return 'Below Avg';
  if (s <= 60) return 'Average';
  if (s <= 80) return 'Good';
  return 'Excellent';
}

/**
 * Build an NxN confusion matrix from parallel arrays of predicted and actual labels.
 *
 * @param {string[]} predictions - predicted labels (AI classifications)
 * @param {string[]} actuals     - ground-truth labels (SME classifications)
 * @param {string[]} labels      - ordered list of class labels
 * @returns {{ matrix: number[][], labels: string[] }}
 */
export function buildConfusionMatrix(predictions, actuals, labels = LABELS) {
  const n = labels.length;
  const labelIndex = Object.fromEntries(labels.map((l, i) => [l, i]));
  const matrix = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let k = 0; k < predictions.length; k++) {
    const pi = labelIndex[predictions[k]];
    const ai = labelIndex[actuals[k]];
    if (pi !== undefined && ai !== undefined) {
      matrix[ai][pi] += 1;
    }
  }

  return { matrix, labels };
}

/**
 * Compute per-class precision, recall, F1 and macro averages from a confusion matrix.
 *
 * @param {number[][]} matrix - NxN confusion matrix (rows = actual, cols = predicted)
 * @param {string[]} labels
 * @returns {{ perClass: Object[], macroAvg: { precision: number, recall: number, f1: number } }}
 */
export function calculateMetrics(matrix, labels = LABELS) {
  const n = labels.length;
  const perClass = labels.map((label, i) => {
    const tp = matrix[i][i];
    const fp = matrix.reduce((sum, row, r) => (r !== i ? sum + row[i] : sum), 0);
    const fn = matrix[i].reduce((sum, val, c) => (c !== i ? sum + val : sum), 0);

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    return {
      label,
      tp,
      fp,
      fn,
      precision: Math.round(precision * 1000) / 1000,
      recall: Math.round(recall * 1000) / 1000,
      f1: Math.round(f1 * 1000) / 1000,
    };
  });

  const classesWithSamples = perClass.filter((c) => c.tp + c.fn > 0);
  const count = classesWithSamples.length || 1;

  const macroAvg = {
    precision: Math.round((classesWithSamples.reduce((s, c) => s + c.precision, 0) / count) * 1000) / 1000,
    recall: Math.round((classesWithSamples.reduce((s, c) => s + c.recall, 0) / count) * 1000) / 1000,
    f1: Math.round((classesWithSamples.reduce((s, c) => s + c.f1, 0) / count) * 1000) / 1000,
  };

  return { perClass, macroAvg };
}

/**
 * Calculate overall accuracy from a confusion matrix.
 *
 * @param {number[][]} matrix
 * @returns {number} accuracy percentage (0-100)
 */
export function calculateAccuracy(matrix) {
  let correct = 0;
  let total = 0;
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      total += matrix[r][c];
      if (r === c) correct += matrix[r][c];
    }
  }
  return total > 0 ? Math.round((correct / total) * 10000) / 100 : 0;
}

export { LABELS };
