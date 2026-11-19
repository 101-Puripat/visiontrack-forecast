import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { countsAtTime, sumCounts, validateTrack } from '../counts.mjs';

const track = JSON.parse(fs.readFileSync(new URL('../data/zone3.counts.json', import.meta.url)));
const zoneTracks = [1, 2, 3, 4].map(number => JSON.parse(fs.readFileSync(new URL(`../data/zone${number}.counts.json`, import.meta.url))));

test('all four count tracks match their own video and contain valid complete observations', () => {
  zoneTracks.forEach((source, index) => {
    assert.ok(validateTrack(source), `invalid zone ${index + 1}`);
    assert.equal(source.sourceVideo, `videos/zone${index + 1}.mp4`);
    const video = fs.readFileSync(new URL(`../${source.sourceVideo}`, import.meta.url));
    assert.equal(source.videoSha256, createHash('sha256').update(video).digest('hex'), `zone ${index + 1} video changed`);
    assert.equal(source.samples.length, Math.ceil(source.durationSeconds));
    for (let time = 0; time < source.durationSeconds; time += .25) {
      const value = countsAtTime(source, time);
      assert.equal(value.total, value.free + value.occupied);
      assert.ok(source.samples.some(sample => sample.free === value.free && sample.occupied === value.occupied));
    }
    assert.deepEqual(countsAtTime(source, source.durationSeconds + 1), countsAtTime(source, 1));
  });
});

test('overview includes all four verified camera counts using independent playback times', () => {
  assert.deepEqual(zoneTracks.map(source => {
    const { free, occupied } = countsAtTime(source, 0);
    return [free, occupied];
  }), [[23, 4], [11, 6], [18, 18], [9, 22]]);
  assert.deepEqual(sumCounts(zoneTracks.map(source => countsAtTime(source, 0))), { total: 111, free: 61, occupied: 50 });
  const positions = [12.2, 4.2, 20.2, 4.2];
  assert.deepEqual(sumCounts(zoneTracks.map((source, index) => countsAtTime(source, positions[index]))), { total: 110, free: 62, occupied: 48 });
});

test('camera observations are ordered and valid', () => {
  assert.ok(validateTrack(track));
  assert.equal(track.sourceVideo, 'videos/zone3.mp4');
  assert.equal(validateTrack({ ...track, samples: [{ time: 0, free: -1, occupied: 2 }] }), false);
  assert.equal(validateTrack({ ...track, samples: [track.samples[1], track.samples[0]] }), false);
});

test('smoothing rejects a brief spike and never reads future observations', () => {
  const samples = [10, 10, 40, 10, 10, 8, 8, 8, 8].map((free, time) => ({ time, free, occupied: 2 }));
  const source = { durationSeconds: 10, samples };
  assert.equal(countsAtTime(source, 3.9).free, 10);
  assert.equal(countsAtTime(source, 4).free, 10);
  assert.deepEqual(countsAtTime(source, 4), countsAtTime(source, 7.9));
  const futureChanged = { ...source, samples: samples.map(s => s.time > 4 ? { ...s, free: 90 } : s) };
  assert.deepEqual(countsAtTime(source, 4), countsAtTime(futureChanged, 4));
});

test('real clip counts change on the video timeline, reset on loop and keep valid totals', () => {
  assert.equal(countsAtTime(track, 0).free, 18);
  assert.deepEqual(countsAtTime(track, track.durationSeconds + 1), countsAtTime(track, 1));
  for (let t = 0; t < track.durationSeconds; t += .1) {
    const count = countsAtTime(track, t);
    assert.equal(count.total, count.free + count.occupied);
    assert.ok(track.samples.some(s => s.free === count.free && s.occupied === count.occupied));
  }
});

test('overview totals sum available cameras without multiplying a single video', () => {
  const zone = countsAtTime(track, 0);
  assert.deepEqual(sumCounts([zone]), { total: 36, free: 18, occupied: 18 });
  assert.deepEqual(sumCounts([zone, { total: 12, free: 8, occupied: 4 }]), { total: 48, free: 26, occupied: 22 });
  assert.equal(sumCounts([zone, null]), null);
  assert.equal(sumCounts([]), null);
  assert.equal(countsAtTime(null, 0), null);
});
