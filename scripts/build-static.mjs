import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { validateTrack } from '../counts.mjs';

// Export the current recorded-video dashboard for static hosting.
const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const root = path.resolve(projectRoot, process.argv[3] || '.');
const output = path.resolve(projectRoot, process.argv[2] || 'dist');
if (output === path.resolve(root)) throw new Error('Choose a separate output directory.');
const zones = [1, 2, 3, 4].map(number => {
  const fileName = `zone${number}.mp4`;
  const video = fs.readFileSync(path.join(root, 'videos', fileName));
  const track = JSON.parse(fs.readFileSync(path.join(root, `data/zone${number}.counts.json`), 'utf8'));
  const digest = createHash('sha256').update(video).digest('hex');
  if (!validateTrack(track) || digest !== track.videoSha256) {
    throw new Error(`Zone ${number}: video and count data do not match.`);
  }
  return {
    id: `zone${number}`, number, label: `Zone ${number}`, fileName,
    videoUrl: `videos/${fileName}`, countsUrl: `data/zone${number}.counts.json`,
  };
});

fs.mkdirSync(path.join(output, 'videos'), { recursive: true });
fs.mkdirSync(path.join(output, 'data'), { recursive: true });
for (const name of ['styles.css', 'counts.mjs']) {
  fs.copyFileSync(path.join(root, name), path.join(output, name));
}
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  .replace('href="/styles.css"', 'href="./styles.css"')
  .replace('src="/app.mjs"', 'src="./app.mjs"');
fs.writeFileSync(path.join(output, 'index.html'), html);
const app = fs.readFileSync(path.join(root, 'app.mjs'), 'utf8');
if (!app.includes("fetch('/api/zones')")) throw new Error('The zone loading code has changed; update the static exporter.');
fs.writeFileSync(path.join(output, 'app.mjs'), app.replace("fetch('/api/zones')", "fetch('./zones.json')"));
fs.writeFileSync(path.join(output, 'zones.json'), JSON.stringify({ zones }, null, 2) + '\n');
for (const zone of zones) {
  fs.copyFileSync(path.join(root, 'videos', zone.fileName), path.join(output, 'videos', zone.fileName));
  fs.copyFileSync(path.join(root, zone.countsUrl), path.join(output, zone.countsUrl));
}
console.log(`Static dashboard exported with all 4 verified video/count pairs: ${output}`);
