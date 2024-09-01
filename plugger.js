const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const UPNG = require('upng-js');
const ffmpeg = require('fluent-ffmpeg');

const CNV_SIZE = 512;
const CNV_HALF = CNV_SIZE/2;
const CNV_QUARTER = CNV_SIZE/4;
const DEFAULT_DISTANCE = 260;

let PLUG_IMAGE;
const PLUG_SIZE = 150;
const PLUG_DEPTH = PLUG_SIZE/4 - 2;
const PLUG_DEG = 40;

const drawPlug = (ctx, x, y, size) => {
  ctx.drawImage(PLUG_IMAGE, x - (size / 2), y - (size / 2), size, size);
}

const easing = (x) => 0.5 + 0.5 * Math.sin((x - 0.5) * Math.PI);
const clear = (ctx) => ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

function drawCircleImage(ctx, image, x, y, radius) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(image, x-radius, y-radius, radius*2, radius*2);
  ctx.restore();
}

function createFrame(ctx, userImage, distance=0, avaSize=0){
  const x = CNV_HALF;
  const y = CNV_HALF;
  const radius = CNV_QUARTER - avaSize;

  const rads = PLUG_DEG * (Math.PI / 180);
  const plugX = x + Math.cos(rads) * (radius - PLUG_DEPTH + (distance/2));
  const plugY = y + Math.sin(rads) * (radius - PLUG_DEPTH + (distance/2));
  drawPlug(ctx, plugX, plugY, PLUG_SIZE);
  drawCircleImage(ctx, userImage, x-(distance/2), y-(distance/2), radius);
}

function generateFrames(userImage) {
  const frames = [];
  const delays = [];

  const canvas = createCanvas(CNV_SIZE, CNV_SIZE);
  const ctx = canvas.getContext('2d');

  for (let i = 0; i < 100; i += 0.1) {
    clear(ctx);
    const FF = 16;
    const FF2 = 4;
    if (i <= FF) {
      const DST = DEFAULT_DISTANCE + PLUG_DEPTH;
      createFrame(ctx, userImage, PLUG_DEPTH + (DST*Math.abs(easing(i/FF)-0.5)));
    } else if (i < FF+FF2) {
      const DST = DEFAULT_DISTANCE + PLUG_DEPTH;
      createFrame(ctx, userImage, PLUG_DEPTH*(1-((i-FF)/FF2)) + DST*Math.abs(easing(((i-FF)/FF2)/2)-0.56));
    } else if (i < FF+FF2 + 3){
      const DST = DEFAULT_DISTANCE + PLUG_DEPTH + 6;
      createFrame(ctx, userImage, PLUG_DEPTH*(1-((i-FF)/FF2)) + DST*Math.abs(easing(0.5)-0.56));
    } else {
      const DST = DEFAULT_DISTANCE + PLUG_DEPTH + 6;
      createFrame(ctx, userImage, DST*Math.abs(easing(0.5)-0.5));
    }
    i += 0.2;
    frames.push(ctx.getImageData(0, 0, CNV_SIZE, CNV_SIZE).data);
    delays.push(i !== 100 ? 40 : 40);
  }
  return [frames, delays];
}

async function createAPNG(filepath, userImage, avaHash) {
  let timer;

  console.log("> Generating..." + ` (${avaHash})`)
  timer = new Date().getTime();
  const [frames, delays] = await generateFrames(userImage);
  console.log("> Finised in", Math.round((new Date().getTime() - timer) / 10)/100, "seconds" + ` (${avaHash})`)

  console.log("> Encoding..." + ` (${avaHash})`)
  timer = new Date().getTime();
  const array_buffer = new UPNG.encode(frames.map(f => f.buffer), CNV_SIZE, CNV_SIZE, 70, delays);
  console.log("> Finised in", Math.round((new Date().getTime() - timer) / 10)/100, "seconds" + ` (${avaHash})`)
  
  console.log("> Saving..." + ` (${avaHash})`)
  timer = new Date().getTime();
  fs.writeFileSync(filepath, Buffer.from(array_buffer));
  console.log("> Finised in", Math.round((new Date().getTime() - timer) / 10)/100, "seconds" + ` (${avaHash})`)
}

const generate = async (avaHash, userUrl) => {
  const plugsDir = path.join(__dirname, "plugs");
  const pngPath = path.join(plugsDir, avaHash+'.apng');
  const palettePath = path.join(plugsDir, avaHash+'_palette.png');
  const gifPath = path.join(plugsDir, avaHash+'.gif');
  if (!fs.existsSync(plugsDir)) fs.mkdirSync(plugsDir);
  if (fs.existsSync(gifPath)) return gifPath;

  let timer;

  if (!fs.existsSync(pngPath)) {
    if (!PLUG_IMAGE)
      PLUG_IMAGE = await loadImage("https://cdn.discordapp.com/emojis/881097865655631882.png");

    let userImage;
    try {
      userImage = await loadImage(userUrl.replace(".webp", ".png"));
    } catch (e) {
      console.log(userUrl, e);
      return false;
    }

    console.log("Creating APNG..." + ` (${avaHash})`);
    timer = new Date().getTime();
    await createAPNG(pngPath, userImage, avaHash);
    console.log("Finised in", Math.round((new Date().getTime() - timer) / 10)/100, "seconds" + ` (${avaHash})`)
  }

  console.log("Creating palette..." + ` (${avaHash})`);
  timer = new Date().getTime();

  return new Promise(async (resolve, reject) => {
    ffmpeg()
    .addInput(pngPath)
    .addOption("-vf palettegen=reserve_transparent=1")
    .addOutput(palettePath)
    .on("end", () => {
      console.log("Finised in", Math.round((new Date().getTime() - timer) / 10)/100, "seconds" + ` (${avaHash})`)

      console.log("Converting APNG to GIF..." + ` (${avaHash})`);
      timer = new Date().getTime();
      ffmpeg()
        .addInput(pngPath)
        .addInput(palettePath)
        .addOutput(gifPath)
        .addOption("-gifflags -offsetting")
        .addOption("-lavfi paletteuse=alpha_threshold=128")
        .addOption("-loop -1")
        .on("end", () => {
          console.log("Finised in", Math.round((new Date().getTime() - timer) / 10)/100, "seconds" + ` (${avaHash})`);
          console.log("Cleaning up..." + ` (${avaHash})`);
          fs.unlinkSync(pngPath);
          fs.unlinkSync(palettePath);

          return resolve(gifPath);
        })
        .run();
    })
    .run();
  })
}

module.exports = generate;
