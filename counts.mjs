// Counts are observations of the burned-in video overlay, not a live camera feed.
export const SMOOTHING = Object.freeze({ windowSeconds: 8, updateSeconds: 4 });

export function validateTrack(track) {
  if (!track || !Number.isFinite(track.durationSeconds) || track.durationSeconds <= 0 || !Array.isArray(track.samples) || !track.samples.length) return false;
  let previous = -1;
  return track.samples.every(sample => {
    const valid = Number.isFinite(sample.time) && sample.time >= 0 && sample.time < track.durationSeconds && sample.time > previous &&
      Number.isInteger(sample.free) && sample.free >= 0 && Number.isInteger(sample.occupied) && sample.occupied >= 0;
    previous = sample.time;
    return valid;
  }) && track.samples[0].time === 0;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

export function countsAtTime(track, time, settings = SMOOTHING) {
  if (!track || !Number.isFinite(time) || time < 0) return null;
  // Quantize on video time, so pausing/seeking/looping and tab changes stay consistent.
  const position = time % track.durationSeconds;
  const bucket = Math.floor(position / settings.updateSeconds) * settings.updateSeconds;
  const observations = track.samples.filter(s => s.time <= bucket && s.time >= Math.max(0, bucket - settings.windowSeconds));
  if (!observations.length) return null;
  const medianFree = median(observations.map(s => s.free));
  const medianOccupied = median(observations.map(s => s.occupied));
  // Choose an actual observed pair closest to the medians. This avoids inventing
  // a free/occupied combination when two neighboring frames disagree.
  const distance = sample => Math.abs(sample.free - medianFree) + Math.abs(sample.occupied - medianOccupied);
  const representative = observations.reduce((best, sample) => distance(sample) <= distance(best) ? sample : best);
  const { free, occupied } = representative;
  return { total: free + occupied, free, occupied, sampledAt: bucket };
}

export function sumCounts(counts) {
  if (!counts.length || counts.some(count => !count)) return null;
  return counts.reduce((sum, count) => ({ total: sum.total + count.total, free: sum.free + count.free, occupied: sum.occupied + count.occupied }), { total: 0, free: 0, occupied: 0 });
}
