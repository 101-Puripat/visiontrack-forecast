# VisionTrack Forecast

## Export for sharing or static hosting

Run `node scripts/build-static.mjs` to create the `dist/` folder. The export
includes all four videos and count files, verifies each video SHA-256 against
its count data, and uses a generated `zones.json` instead of the Node API.
Upload the contents of `dist/` to a static host, including a GitHub Pages project
URL. Re-export
after changing videos or count data. This shares the recorded-video demo;
it does not connect to live cameras. The original `node server.mjs` workflow
continues to work.

The `Deploy to GitHub Pages` workflow tests and exports the site on every push
to `main`. The repository owner must first select **Settings → Pages → Source →
GitHub Actions**. The workflow can also be run manually from the Actions tab.

For a smaller Windows sharing build, install the local media tool with
`python -m pip install --target .tools/media imageio-ffmpeg`, then run
`node scripts/build-share-runtime.mjs`. This creates `.deploy/share-runtime/`
with H.264 videos at 854 pixels wide, playback metadata at the start of each
file, and matching count-data hashes. To export that runtime for hosting, run
`node scripts/build-static.mjs dist .deploy/share-runtime`.

ตรวจจับโต๊ะว่าง King Mongkut's Food Center (KFC) — เว็บติดตามสถานะโต๊ะ 4 โซน ใช้งานได้โดยไม่ต้องล็อกอิน

## รันโปรเจ็กต์

ใช้ Node.js 18 ขึ้นไป ไม่ต้องติดตั้ง dependency สำหรับรันเว็บ

```sh
node server.mjs
```

เปิด http://localhost:3000 หรือกำหนดพอร์ตด้วย environment variable `PORT`

## การใช้งาน

- แสดงหน้าต่างแจ้งขอบเขตเฉพาะครั้งแรกในเบราว์เซอร์นั้น เมื่อรีเฟรชหรือกลับมาเข้าเว็บจะไม่แสดงซ้ำ และเปิดอ่านเองได้จากปุ่ม **ขอบเขตการใช้งาน**
- หน้าขอบเขตเลื่อนเฉพาะเนื้อหา โดยหัวข้อและปุ่มยืนยันยังมองเห็นได้บนจอเตี้ย รองรับการเลื่อนด้วยคีย์บอร์ด
- มีทั้งหมด 4 โซน เมื่อมองจากทางเข้า KFC โซน 1 อยู่ซ้ายมือ และโซน 2–4 เรียงไปทางขวาตามช่วงเสา ดูผังย่อได้ใน **ขอบเขตการใช้งาน** และเลือกโซนจากแถบมุมมองด้านบน
- ครอบคลุมพื้นที่มากกว่า 70% แต่ไม่ครอบคลุมทุกพื้นที่ทั่ว KFC
- **มุมมองทั้งหมด** เน้นจำนวนโต๊ะว่าง พร้อมระบุจำนวนโซนที่มีข้อมูลใกล้ตัวเลขทั้งบนคอมพิวเตอร์และมือถือ ทุกโซนใช้กรอบแสดงภาพขนาดเท่ากัน โซนที่ไม่มีภาพเว้นพื้นที่และระบุ **ไม่พบกล้อง** ที่ด้านล่าง
- เลือก **โซน 1–4** เพื่อดูวิดีโอเต็มความกว้างและ dashboard เฉพาะโซนนั้น โดยซ่อนตัวเลขซ้ำใต้วิดีโอ แถบเลือกโซนติดด้านบนเมื่อเลื่อนหน้า
- จอเล็กใช้คำว่า **ทั้งหมด** แทน **มุมมองทั้งหมด** ปุ่มมีพื้นที่กดอย่างน้อย 44×44 พิกเซลและจัดแถวใหม่เมื่อขยายตัวอักษร พร้อมลดช่องว่างแถบเลือกโซนเมื่อจอเตี้ย
- ลิงก์จำโซนที่เลือก เช่น `http://localhost:3000/#zone3` รองรับการรีเฟรช แชร์ลิงก์ และปุ่มย้อนกลับ/ไปข้างหน้าของเบราว์เซอร์
- ปุ่ม **เต็มจอ** แสดงเฉพาะวิดีโอในเบราว์เซอร์ที่รองรับ ไม่มีปุ่มไปโซนที่มีข้อมูล ปุ่มหยุด/เล่น หรือเวลาในคลิปบนหน้าเว็บ
- แสดงวันเวลาปัจจุบันในประเทศไทยและรองรับจอมือถือ วิดีโอเล่นอัตโนมัติแบบวนซ้ำ และจำนวนโต๊ะยังอ้างอิงตามเวลาในวิดีโอ

## วิดีโอและข้อมูลจำนวนโต๊ะ

ใช้ไฟล์ `videos/zone1.mp4` ถึง `videos/zone4.mp4` ตามหมายเลขโซน โดยแต่ละโซนเล่นแบบปิดเสียงและวนซ้ำแยกกัน ไม่ใช้วิดีโอของโซนหนึ่งแทนโซนอื่น ไฟล์ชื่ออื่น เช่นไฟล์สำรอง จะไม่ถูกนำมาแสดง

ปัจจุบันมีวิดีโอและข้อมูลจำนวนโต๊ะที่ตรงกับคลิปครบทั้ง 4 โซน แต่ละโซนแสดงจำนวนโต๊ะของตัวเอง และหน้ารวมรวมยอดจากทั้ง 4 โซน หากโซนใดไม่มีวิดีโอหรือเปิดภาพไม่ได้ จะเว้นพื้นที่แสดงภาพขนาดเท่ากันและระบุ **ไม่พบกล้อง** ที่ด้านล่าง

ตัวเลขมาจากข้อความ **Empty / Occupied** ที่ฝังอยู่มุมซ้ายบนของคลิป ไม่ได้สุ่มขึ้นมา และไม่ได้รันโมเดลตรวจจับหรือ OCR ขณะเปิดเว็บ ไฟล์ `data/zone1.counts.json` ถึง `data/zone4.counts.json` เป็นค่าที่อ่านและตรวจทานจากเฟรมทุก 1 วินาทีตลอดคลิปของแต่ละโซน โดยใช้เฟรมที่ 0.1 วินาทีเป็นค่าเริ่มต้น ความยาวคลิปโซน 1–4 อยู่ที่ประมาณ 15.88, 6.22, 30.29 และ 7.56 วินาทีตามลำดับ

`counts.mjs` กรองค่ามัธยฐานย้อนหลัง **8 วินาที** และเลือกคู่จำนวนว่าง/ไม่ว่างที่มีอยู่จริงใกล้ค่ามัธยฐานที่สุด โดยอัปเดตทุก **4 วินาทีของวิดีโอ** เพื่อลดการแกว่ง ตัวเลขจึงอาจต่างจากตัวเลขรายเฟรมในวิดีโอเล็กน้อย แต่ละโซนใช้เวลาเล่นของตัวเอง และเก็บตำแหน่งเวลาเดิมเมื่อสลับโซน

หน้าแสดงภาพรวมจะรวมเฉพาะกล้องที่มีวิดีโอและข้อมูลจำนวนโต๊ะ พร้อมบอกจำนวนโซนที่มีข้อมูลจากทั้งหมด 4 โซน หากไม่มีข้อมูลเลยจะแสดง `—` แทนศูนย์

เซิร์ฟเวอร์ตรวจ SHA-256 ของวิดีโอกับข้อมูลจำนวนโต๊ะรายโซน หากเปลี่ยนคลิป ต้องปรับไฟล์ `data/zoneN.counts.json` ให้ตรงกับคลิปใหม่ รวมถึง hash และความยาวคลิป มิฉะนั้นจำนวนโต๊ะของโซนนั้นจะแสดง `—`

## ตรวจสอบ

```sh
node --test
node --check server.mjs
node --check app.mjs
```

การทดสอบครอบคลุมข้อมูลและ SHA-256 ของวิดีโอครบทั้ง 4 โซน การกรองค่ากระพริบ การไม่อ่านข้อมูลอนาคต การอัปเดตตามเวลาวิดีโอ การวนซ้ำ และการรวมยอดตามตำแหน่งเวลาอิสระของแต่ละกล้อง
