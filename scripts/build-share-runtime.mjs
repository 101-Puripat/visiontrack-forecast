import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { validateTrack } from '../counts.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const output=path.join(root,'.deploy/share-runtime');
const binaries=path.join(root,'.tools/media/imageio_ffmpeg/binaries');
const executable=fs.readdirSync(binaries).find(name=>name.startsWith('ffmpeg')&&name.endsWith('.exe'));
if(!executable)throw new Error('Install imageio-ffmpeg into .tools/media first.');
const ffmpeg=path.join(binaries,executable);
for(const directory of ['videos','data'])fs.mkdirSync(path.join(output,directory),{recursive:true});
for(const name of ['index.html','app.mjs','counts.mjs','styles.css','server.mjs'])fs.copyFileSync(path.join(root,name),path.join(output,name));
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
async function encode(number) {
  const source=path.join(root,`videos/zone${number}.mp4`);
  const destination=path.join(output,`videos/zone${number}.mp4`);
  const track=JSON.parse(fs.readFileSync(path.join(root,`data/zone${number}.counts.json`),'utf8'));
  assert.ok(validateTrack(track)); assert.equal(hash(source),track.videoSha256);
  await new Promise((resolve,reject)=>{
    const args=['-hide_banner','-loglevel','error','-y','-threads','2','-i',source,'-map','0:v:0','-an','-vf','scale=854:-2','-c:v','libx264','-preset','veryfast','-crf','28','-maxrate','350k','-bufsize','700k','-profile:v','main','-pix_fmt','yuv420p','-fps_mode','passthrough','-movflags','+faststart','-threads','2',destination];
    const process=spawn(ffmpeg,args,{stdio:['ignore','ignore','pipe']});let error='';
    process.stderr.on('data',chunk=>error+=chunk);process.on('error',reject);
    process.on('close',code=>code===0?resolve():reject(new Error(error)));
  });
  const bytes=fs.readFileSync(destination); const atoms=[];
  for(let offset=0;offset+8<=bytes.length;) {
    const size=bytes.readUInt32BE(offset);atoms.push(bytes.toString('ascii',offset+4,offset+8));
    if(size<8)break;offset+=size;
  }
  assert.ok(atoms.indexOf('moov')>=0&&atoms.indexOf('moov')<atoms.indexOf('mdat'),'Playback metadata must precede video data');
  track.sourceVideoSha256=track.videoSha256;track.videoSha256=hash(destination);
  fs.writeFileSync(path.join(output,`data/zone${number}.counts.json`),JSON.stringify(track,null,2)+'\n');
  const originalBytes=fs.statSync(source).size;
  console.log(`Zone ${number}: ${originalBytes} -> ${bytes.length} bytes; H.264 854px; fast-start metadata verified.`);
}
for(let number=1;number<=4;number+=2)await Promise.all([encode(number),encode(number+1)]);
console.log(`Share runtime ready: ${output}`);
