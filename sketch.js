// Patch getContext so all 2D canvases get willReadFrequently,
// silencing the getImageData performance warning.
const _origGetContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function (type, attrs) {
  if (type === "2d") attrs = { willReadFrequently: true, ...attrs };
  return _origGetContext.call(this, type, attrs);
};

let animals = [];
let imgs = [];
let loadedCount = 0;

/* global Cropper */
let customImg = null;
let customGraphics = null;
let cropper = null;

const COLS = 4;
const CARD = 480;
const CARD_DISPLAY = 240;
const SCALE = CARD_DISPLAY / CARD;
const GAP = 12;

function preload() {
  animals = loadJSON("data/animals.json");
}

function setup() {
  animals = Object.values(animals);
  let rows = Math.ceil(animals.length / COLS);

  pixelDensity(2);
  noStroke();
  createCanvas(
    COLS * CARD_DISPLAY + (COLS + 1) * GAP,
    rows * CARD_DISPLAY + (rows + 1) * GAP,
  );
  textFont("Poppins");
  noLoop();
  background("#f0f0f0");

  setupCustomCard();

  imgs = new Array(animals.length).fill(null);
  loadedCount = 0;

  animals.forEach((a, i) => {
    loadImage(a.image, (loaded) => {
      imgs[i] = loaded;
      loadedCount++;
      if (loadedCount === animals.length) drawAll();
    });
  });
}

// ── Custom card ──────────────────────────────────────────────

function setupCustomCard() {
  // Re-render live on any input change
  ["pet-name", "pet-age", "pet-gender", "pet-weight"].forEach((id) => {
    document.getElementById(id).addEventListener("input", () => {
      if (customImg) renderCustomCard();
    });
  });

  document.getElementById("custom-dot-slider").addEventListener("input", () => {
    if (customImg) renderCustomCard();
  });

  // On upload → open crop modal instead of rendering directly
  document.getElementById("pet-image").addEventListener("change", (e) => {
    if (!e.target.files[0]) return;
    let reader = new FileReader();
    reader.onload = (ev) => showCropModal(ev.target.result);
    reader.readAsDataURL(e.target.files[0]);
  });

  // Crop modal buttons
  document
    .getElementById("crop-confirm")
    .addEventListener("click", confirmCrop);
  document.getElementById("crop-cancel").addEventListener("click", () => {
    document.getElementById("crop-modal").style.display = "none";
    document.getElementById("pet-image").value = "";
  });

  document.getElementById("download-btn").addEventListener("click", () => {
    let a = document.createElement("a");
    a.download = "my_sticker.png";
    a.href = document.getElementById("custom-canvas").toDataURL("image/png");
    a.click();
  });
}

function showCropModal(dataURL) {
  let img = document.getElementById("crop-image");
  document.getElementById("crop-modal").style.display = "flex";

  if (cropper) {
    cropper.destroy();
    cropper = null;
  }

  img.src = dataURL;
  img.onload = () => {
    cropper = new Cropper(img, {
      aspectRatio: 1,
      viewMode: 1,
      dragMode: "move",
      autoCropArea: 0.9,
      background: false,
    });
  };
}

function confirmCrop() {
  let croppedCanvas = cropper.getCroppedCanvas({ width: 796, height: 796 });
  document.getElementById("crop-modal").style.display = "none";

  // Show cropped photo immediately, scaled to fill the preview
  let displayCanvas = document.getElementById("custom-canvas");
  displayCanvas.width = 796;
  displayCanvas.height = 796;
  let ctx = displayCanvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(croppedCanvas, 0, 0, 796, 796);
  document.getElementById("download-btn").style.display = "inline-block";
  document.getElementById("canvas-placeholder").style.display = "none";

  // Then load into p5 and render the halftone sticker (replaces the photo)
  let dataURL = croppedCanvas.toDataURL("image/png");
  loadImage(dataURL, (loaded) => {
    customImg = loaded;
    renderCustomCard();
  });
}

function renderCustomCard() {
  let name = document.getElementById("pet-name").value || "Name";
  let age = document.getElementById("pet-age").value || "?";
  let gender = document.getElementById("pet-gender").value || "?";
  let weight = document.getElementById("pet-weight").value || "?";
  let step = int(document.getElementById("custom-dot-slider").value);

  if (!customGraphics) {
    customGraphics = createGraphics(CARD, CARD);
    customGraphics.textFont("Poppins");
    document.getElementById("download-btn").style.display = "inline-block";
  }

  let g = customGraphics;
  g.noStroke();
  g.fill("#0033cc");
  g.rect(0, 0, CARD, CARD);
  g.fill(255);
  g.rect(10, 10, 460, 460);

  // Halftone image
  let imgW = customImg.width * 0.51;
  let imgH = customImg.height * 0.51;
  g.fill(255);
  g.rect(36, 40, imgW, imgH);
  customImg.loadPixels();
  g.noStroke();
  for (let y = 0; y < customImg.height; y += step) {
    for (let x = 0; x < customImg.width; x += step) {
      let idx = (x + y * customImg.width) * 4;
      let r = customImg.pixels[idx];
      let gv = customImg.pixels[idx + 1];
      let b = customImg.pixels[idx + 2];
      let brightness = (r + gv + b) / 3;
      let diameter = map(brightness, 0, 255, step, 0);
      g.fill("#0033cc");
      g.ellipse(x * 0.49 + 46, y * 0.49 + 50, diameter * 0.6, diameter * 0.6);
    }
  }

  // Text
  g.drawingContext.letterSpacing = "-2px";
  g.textSize(70);
  g.textStyle(BOLDITALIC);
  g.fill(255);
  g.text(name, 51, 155);
  g.fill("#0033cc");
  g.text(name, 56, 150);

  g.fill("#FF6B00");
  g.textSize(50);
  g.drawingContext.letterSpacing = "1px";
  g.text(`${age}yrs`, 56, 259);
  g.text(`${gender}`, 56, 319);
  g.text(`${weight}lbs`, 56, 379);
  g.fill("#0033cc");
  g.text(`${age}yrs`, 61, 258);
  g.text(`${gender}`, 61, 318);
  g.text(`${weight}lbs`, 61, 378);

  // Copy offscreen buffer onto the visible canvas
  let displayCanvas = document.getElementById("custom-canvas");
  displayCanvas.width = CARD;
  displayCanvas.height = CARD;
  let ctx = displayCanvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(customGraphics.elt, 0, 0, CARD, CARD);
}

// ── Shelter grid ─────────────────────────────────────────────

function drawAll() {
  background("#f0f0f0");
  animals.forEach((_a, i) => {
    if (!imgs[i]) return;
    let col = i % COLS;
    let row = Math.floor(i / COLS);
    push();
    translate(
      col * CARD_DISPLAY + (col + 1) * GAP,
      row * CARD_DISPLAY + (row + 1) * GAP,
    );
    scale(SCALE);
    drawCard(i);
    pop();
  });
}

function drawCard(index) {
  noStroke();
  fill("#0033cc");
  rect(0, 0, CARD, CARD);
  fill(255);
  rect(10, 10, 460, 460);

  drawHalftoneImage(imgs[index]);

  drawingContext.letterSpacing = "-2px";
  textSize(70);
  textStyle(BOLDITALIC);
  fill(255);
  text(animals[index].name, 51, 155);
  fill("#0033cc");
  text(animals[index].name, 56, 150);

  fill("#FF6B00");
  textSize(50);
  drawingContext.letterSpacing = "1px";
  text(`${animals[index].age}yrs`, 56, 259);
  text(`${animals[index].gender}`, 56, 319);
  text(`${animals[index].weight}lbs`, 56, 379);
  fill("#0033cc");
  text(`${animals[index].age}yrs`, 61, 258);
  text(`${animals[index].gender}`, 61, 318);
  text(`${animals[index].weight}lbs`, 61, 378);
}

function drawHalftoneImage(img) {
  fill(255);
  rect(36, 40, img.width * 0.51, img.height * 0.51);
  img.loadPixels();
  let step = 10;
  noStroke();

  for (let y = 0; y < img.height; y += step) {
    for (let x = 0; x < img.width; x += step) {
      let idx = (x + y * img.width) * 4;
      let r = img.pixels[idx];
      let g = img.pixels[idx + 1];
      let b = img.pixels[idx + 2];
      let brightnessValue = (r + g + b) / 3;
      let diameter = map(brightnessValue, 0, 255, step, 0);
      fill("#0033cc");
      ellipse(x * 0.49 + 46, y * 0.49 + 50, diameter * 0.6, diameter * 0.6);
    }
  }
}

function keyPressed() {
  if (key === "s") saveCanvas("animal_cards", "png");
}
