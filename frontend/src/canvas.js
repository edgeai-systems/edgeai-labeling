// ================= INIT =================
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// ===== FLOATING CLASS PICKER =====
const floatingClass = document.getElementById("floatingClass");

function showFloatingClass(x, y, onSelect) {
  floatingClass.innerHTML = "";

  classes.forEach(cls => {
    const opt = document.createElement("option");
    opt.value = cls;
    opt.textContent = cls;
    floatingClass.appendChild(opt);
  });

  floatingClass.style.left = x + "px";
  floatingClass.style.top = y + "px";
  floatingClass.style.display = "block";

  floatingClass.focus();

  floatingClass.onchange = () => {
    onSelect(floatingClass.value);
    floatingClass.style.display = "none";
  };
}

// ================= CONFIG =================
let displayScale = 1;

// ================= CLASS =================
let classes = [];
let classColors = {};
let resizeEdge = null;

function getRandomColor() {
  while (true) {
    const r = Math.floor(Math.random() * 200);
    const g = Math.floor(Math.random() * 200);
    const b = Math.floor(Math.random() * 200);

    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    const isTooLight = brightness > 180;
    const isGray = Math.abs(r - g) < 20 && Math.abs(r - b) < 20;

    if (!isTooLight && !isGray) {
      return `rgb(${r},${g},${b})`;
    }
  }
}

function getTextColor(bgColor) {
  const c = bgColor.substring(4).replace(")", "").split(",");
  const r = parseInt(c[0]);
  const g = parseInt(c[1]);
  const b = parseInt(c[2]);

  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128 ? "#000" : "#fff";
}

function renderClassSelect() {
  const select = document.getElementById("classSelect");
  select.innerHTML = "";

  classes.forEach((cls, i) => {
    const option = document.createElement("option");
    option.value = cls;
    option.textContent = cls;
    if (i === 0) option.selected = true;
    select.appendChild(option);

    if (!classColors[cls]) {
      classColors[cls] = getRandomColor();
    }
  });
}

window.addClass = function () {
  const input = document.getElementById("newClass");
  const value = input.value.trim();

  if (!value) return;

  if (!classes.includes(value)) {
    classes.push(value);
    classColors[value] = getRandomColor();
    renderClassSelect();
  }

  input.value = "";
};

// ================= STATE =================
let images = [];
let index = 0;
let annotations = {};

let img = new Image();

let scale = 1;
let offsetX = 0;
let offsetY = 0;

let drawing = false;
let startX, startY;
let previewBox = null;

let isPanning = false;
let lastX, lastY;

let selectedBoxIndex = -1;
let hoveredBoxIndex = -1;

let isDraggingBox = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

let isResizing = false;
let resizeCorner = null;

// ================= UTILS =================
function getKey() {
  return images[index];
}

function getCurrentObjects() {
  const key = getKey();
  if (!annotations[key]) annotations[key] = [];
  return annotations[key];
}

function isInsideBox(x, y, box) {
  const [x1, y1, x2, y2] = box;
  return x >= x1 && x <= x2 && y >= y1 && y <= y2;
}

function getCorner(x, y, box) {
  const [x1, y1, x2, y2] = box;
  const size = 10 / scale;

  if (Math.abs(x - x1) <= size && Math.abs(y - y1) <= size) return "tl";
  if (Math.abs(x - x2) <= size && Math.abs(y - y1) <= size) return "tr";
  if (Math.abs(x - x1) <= size && Math.abs(y - y2) <= size) return "bl";
  if (Math.abs(x - x2) <= size && Math.abs(y - y2) <= size) return "br";

  return null;
}

function getEdge(x, y, box) {
  const [x1, y1, x2, y2] = box;
  const size = 6;

  if (Math.abs(x - x1) < size) return "left";
  if (Math.abs(x - x2) < size) return "right";
  if (Math.abs(y - y1) < size) return "top";
  if (Math.abs(y - y2) < size) return "bottom";

  return null;
}

// ================= LOAD IMAGE =================
function loadImage() {
  if (!images.length) return;

  img.src = images[index];

  img.onload = () => {
    const maxW = window.innerWidth * 0.8;
    const maxH = window.innerHeight * 0.8;

    displayScale = Math.min(maxW / img.width, maxH / img.height);

    canvas.width = img.width * displayScale;
    canvas.height = img.height * displayScale;

    scale = 1;
    offsetX = 0;
    offsetY = 0;

    selectedBoxIndex = -1;

    drawAll();
    loadAnnotations();
  };
}

// ================= DRAW =================
function drawAll() {
  ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
  ctx.clearRect(-offsetX/scale, -offsetY/scale, canvas.width/scale, canvas.height/scale);

  ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, canvas.width, canvas.height);

  const objects = getCurrentObjects();

  objects.forEach((obj, i) => {
    const [x1, y1, x2, y2] = obj.bbox;
    const color = classColors[obj.class] || "#00ff00";

    const dx = x1 * displayScale;
    const dy = y1 * displayScale;
    const dw = (x2 - x1) * displayScale;
    const dh = (y2 - y1) * displayScale;

    // ===== PRO STYLE =====
    ctx.shadowBlur = (i === selectedBoxIndex) ? 15 : 0;
    ctx.shadowColor = color;

    // hover
    if (i === hoveredBoxIndex) {
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = color;
      ctx.fillRect(dx, dy, dw, dh);
      ctx.globalAlpha = 1;
    }

    // border
    ctx.strokeStyle = color;
    ctx.lineWidth = (i === selectedBoxIndex) ? 3 : 2;
    ctx.strokeRect(dx, dy, dw, dh);

    // resize handles
    if (i === selectedBoxIndex) {
      const size = 6;
      const points = [
        [dx, dy],
        [dx + dw, dy],
        [dx, dy + dh],
        [dx + dw, dy + dh]
      ];

      ctx.fillStyle = "#fff";
      points.forEach(([x, y]) => {
        ctx.fillRect(x - size/2, y - size/2, size, size);
      });
    }

    ctx.shadowBlur = 0;

    // ===== LABEL =====
    ctx.font = "12px Arial";
    const textWidth = ctx.measureText(obj.class).width;

    ctx.fillStyle = color;
    ctx.fillRect(dx, dy - 16, textWidth + 8, 14);

    ctx.fillStyle = getTextColor(color);
    ctx.fillText(obj.class, dx + 3, dy - 4);
  });

  // preview box
  if (previewBox) {
    const [x1, y1, x2, y2] = previewBox;
    const cls = document.getElementById("classSelect").value;
    const color = classColors[cls] || "#00ff00";

    ctx.setLineDash([5,5]);
    ctx.strokeStyle = color;
    ctx.strokeRect(
      x1 * displayScale,
      y1 * displayScale,
      (x2 - x1) * displayScale,
      (y2 - y1) * displayScale
    );
    ctx.setLineDash([]);
  }
}

