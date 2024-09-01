const GIFEncoder = require('gifencoder');
const { createCanvas, loadImage } = require('canvas');
const fs = require('node:fs');
const path = require('node:path');

const d = async (avaHash, userUrl) => {
  const filepath = path.join(__dirname, 'plugs', avaHash + '.gif');
  if (fs.existsSync(filepath)) return filepath;

  const encoder = new GIFEncoder(512, 512);
  encoder.createReadStream().pipe(fs.createWriteStream(filepath));

  encoder.start();
  encoder.setRepeat(-1); // 0 for repeat, -1 for no-repeat
  encoder.setFrameRate(24);
  encoder.setQuality(10); // image quality. 10 is default.

  const CNV_SIZE = 512;
  const CNV_HALF = CNV_SIZE / 2;
  const CNV_QUARTER = CNV_SIZE / 4;
  const DEFAULT_DISTANCE = 260;

  const canvas = createCanvas(CNV_SIZE, CNV_SIZE);
  const ctx = canvas.getContext('2d');

  const clear = () => ctx.clearRect(0, 0, CNV_SIZE, CNV_SIZE);

  const plugImage = await loadImage('https://cdn.discordapp.com/emojis/881097865655631882.png');
  let userImage;
  try {
    userImage = await loadImage(userUrl.replace('.webp', '.png'));
  } catch (e) {
    console.log(userUrl, e);
    fs.unlinkSync(filepath);
    return false;
  }

  function easing(x) {
    return 0.5 + 0.5 * Math.sin((x - 0.5) * Math.PI);
  }

  function drawPlug(x, y, size) {
    const halfSize = size / 2;
    ctx.drawImage(plugImage, x - halfSize, y - halfSize, size, size);
  }

  function drawCircleImage(x, y, radius) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(userImage, x - radius, y - radius, radius * 2, radius * 2);
    ctx.restore();
  }

  const PLUG_SIZE = 150;
  const PLUG_DEPTH = PLUG_SIZE / 4 - 2;
  const PLUG_DEG = 40;

  function createFrame(distance = 0, avaSize = 0) {
    clear();
    const x = CNV_HALF;
    const y = CNV_HALF;
    const radius = CNV_QUARTER - avaSize;

    const rads = PLUG_DEG * (Math.PI / 180);
    const plugX = x + Math.cos(rads) * (radius - PLUG_DEPTH + distance / 2);
    const plugY = y + Math.sin(rads) * (radius - PLUG_DEPTH + distance / 2);
    drawPlug(plugX, plugY, PLUG_SIZE);

    drawCircleImage(x - distance / 2, y - distance / 2, radius);
  }

  function randColor() {
    return Math.floor(Math.random() * 256);
  }

  function checkColors() {
    createFrame(DEFAULT_DISTANCE);
    const arr = ctx.getImageData(0, 0, CNV_SIZE, CNV_SIZE).data;
    let rgbs = [];
    for (let i = 0; i < arr.length; i += 4) {
      const clr = `${arr[i]}-${arr[i + 1]}-${arr[i + 2]}`;
      if (rgbs.includes(clr)) continue;
      rgbs.push(clr);
    }
    let r = randColor(),
      g = randColor(),
      b = randColor();
    while (rgbs.includes(`${r}-${g}-${b}`)) {
      r = randColor();
      g = randColor();
      b = randColor();
    }
    return (r << 16) | (g << 8) | b;
  }

  function createGIF() {
    const clearRGB = checkColors() || 0xffaa00;
    encoder.setTransparent(clearRGB);

    console.log('Creating GIF...' + ` (${avaHash})`);
    for (let i = 0; i < 100; i += 0.1) {
      const FF = 16;
      const FF2 = 4;
      if (i <= FF) {
        const DST = DEFAULT_DISTANCE + PLUG_DEPTH;
        createFrame(PLUG_DEPTH + DST * Math.abs(easing(i / FF) - 0.5));
      } else if (i < FF + FF2) {
        const DST = DEFAULT_DISTANCE + PLUG_DEPTH;
        createFrame(
          PLUG_DEPTH * (1 - (i - FF) / FF2) + DST * Math.abs(easing((i - FF) / FF2 / 2) - 0.56)
        );
      } else if (i < FF + FF2 + 3) {
        const DST = DEFAULT_DISTANCE + PLUG_DEPTH + 6;
        createFrame(PLUG_DEPTH * (1 - (i - FF) / FF2) + DST * Math.abs(easing(0.5) - 0.56));
      } else {
        const DST = DEFAULT_DISTANCE + PLUG_DEPTH + 6;
        createFrame(DST * Math.abs(easing(0.5) - 0.5));
      }
      i += 0.2;
      encoder.setTransparent(clearRGB);
      encoder.addFrame(ctx);
    }
    encoder.finish();
  }

  createGIF();

  return filepath;
};

module.exports = d;
// d(Date.now(),"https://cdn.discordapp.com/avatars/706124306660458507/dea0aec7e9502596e4417f37713b208c.png");
