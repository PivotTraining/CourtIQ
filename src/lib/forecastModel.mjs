// Conservative beta-binomial outlook for the next matched attempts.
// This is an explanatory statistical model, NOT a trained ML model or validated
// prediction of player development. Inputs must be actual recorded outcomes.
function integer(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

export function forecastNextAttempts({ successes, attempts, sessions, next = 10, minAttempts = 60, minSessions = 3 } = {}) {
  if (!integer(successes) || !integer(attempts) || successes > attempts
    || !integer(sessions) || !Number.isInteger(next) || next < 1 || next > 30) {
    return { available: false, reason: 'Invalid recorded sample' };
  }

  if (sessions < minSessions || attempts < minAttempts) {
    return {
      available: false,
      reason: 'Not enough comparable recorded attempts',
      sessions, attempts, minSessions, minAttempts,
    };
  }

  // Weak, symmetric Beta(2,2) prior prevents absolute 0%/100% forecasts.
  const alpha = 2 + successes;
  const beta = 2 + attempts - successes;
  const expectedRate = alpha / (alpha + beta);
  // Beta-binomial predictive distribution, calculated without factorials.
  const distribution = Array(next + 1).fill(0);
  let p0 = 1;
  for (let i = 0; i < next; i++) p0 *= (beta + i) / (alpha + beta + i);
  distribution[0] = p0;
  for (let k = 0; k < next; k++) {
    distribution[k + 1] = distribution[k] * (next - k) / (k + 1)
      * (alpha + k) / (beta + next - k - 1);
  }
  const total = distribution.reduce((sum, probability) => sum + probability, 0);
  const probabilities = distribution.map(value => value / total);
  const percentile = threshold => {
    let cumulative = 0;
    for (let k = 0; k <= next; k++) {
      cumulative += probabilities[k];
      if (cumulative >= threshold - 1e-12) return k;
    }
    return next;
  };

  return {
    available: true,
    model: 'beta-binomial-v1',
    trainedModel: false,
    validatedForecast: false,
    successes, attempts, sessions, next,
    recordedRate: Math.round(successes / attempts * 100),
    estimatedRate: Math.round(expectedRate * 100),
    expectedMakes: Number((next * expectedRate).toFixed(1)),
    plausibleLow: percentile(0.1),
    plausibleHigh: percentile(0.9),
    intervalDescription: 'Central approximate 80% predictive interval, conditional on comparable attempts',
    evidenceLabel: 'Experimental statistical outlook from recorded outcomes; not a player rating or guarantee',
  };
}
