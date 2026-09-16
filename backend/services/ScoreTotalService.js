function toScore(value) {
  if (value === null || value === undefined || value === "") return 0;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function calculateFinalPoints(secretaryPoints, voteConvertedPoints) {
  return toScore(secretaryPoints) + toScore(voteConvertedPoints);
}

module.exports = {
  calculateFinalPoints,
  toScore,
};
