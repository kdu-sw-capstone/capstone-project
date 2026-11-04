// Local experimental policy, not a product activation or authority decision.
export function classifyBlurStages(stages, threshold = 0.75) {
  if (!Array.isArray(stages) || stages.length !== 2 || threshold !== 0.75) throw Error('INVALID_MODEL_OUTPUT');
  const labels = ['Drawing', 'Hentai', 'Neutral', 'Porn', 'Sexy'];
  for (const {scores} of stages) {
    if (!scores || labels.some(key => !Number.isFinite(scores[key]) || scores[key] < 0 || scores[key] > 1)
      || Math.abs(labels.reduce((sum, key) => sum + scores[key], 0) - 1) > 0.02) throw Error('INVALID_MODEL_OUTPUT');
  }
  // These are mutually exclusive classes of the same model. Summing them
  // is evaluated conservatively by BOTH models in this precision test candidate.
  return stages.every(({scores}) => scores.Porn + scores.Hentai + scores.Sexy >= threshold) ? 'SENSITIVE' : 'SAFE';
}
