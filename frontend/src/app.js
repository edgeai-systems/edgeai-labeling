const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// ===== FLOATING CLASS PICKER =====
const floatingClass = document.getElementById("floatingClass");
let isChoosingClass = false;
let viewMode = "single"; // single | grid
let currentPage = 1;
const PAGE_SIZE = 9;

function showFloatingClass(x, y, onSelect) {
  floatingClass.innerHTML = "";

  if (!classes || classes.length === 0) {
    console.warn("NO CLASSES");
    return;
  }

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

  isChoosingClass = true;

  if (lastSelectedClass && classes.includes(lastSelectedClass)) {
  floatingClass.value = lastSelectedClass;
} else {
  floatingClass.selectedIndex = -1;
}

floatingClass.onchange = (e) => {
  e.stopPropagation();

  const value = floatingClass.value;

  if (!value) return;

  lastSelectedClass = value;

  onSelect(value);

  floatingClass.blur(); // 🔥 QUAN TRỌNG
};


floatingClass.onclick = (e) => {
  e.stopPropagation(); // 🔥 tránh bị document click đóng
};

setTimeout(() => {
  floatingClass.onblur = () => {
    const value = floatingClass.value;

    // 🔥 nếu chưa chọn gì nhưng có lastSelectedClass → dùng nó
    if (!value && lastSelectedClass) {
      onSelect(lastSelectedClass);
    }

    // 🔥 nếu có value → cũng confirm luôn
    if (value) {
      onSelect(value);
    }

    floatingClass.style.display = "none";
  };
}, 0);
}

// ================= CONFIG =================
let displayScale = 1;

// ================= CLASS =================
let classes = [];
let lastSelectedClass = null;
let classColors = {};
let resizeEdge = null;

function getRandomColor() {
  while (true) {
    const r = Math.floor(Math.random() * 200);
    const g = Math.floor(Math.random() * 200);
    const b = Math.floor(Math.random() * 200);

    // độ sáng
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;

    // loại bỏ màu quá sáng hoặc quá xám
    const isTooLight = brightness > 180;
    const isGray = Math.abs(r - g) < 20 && Math.abs(r - b) < 20;

    if (!isTooLight && !isGray) {
      return `rgb(${r},${g},${b})`;
    }
  }
}

function getTextColor(bgColor) {
  const c = bgColor.substring(1);
  const rgb = parseInt(c, 16);

  const r = (rgb >> 16) & 255;
  const g = (rgb >> 8) & 255;
  const b = rgb & 255;

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

let filterMode = "all"; // all | labeled | unlabeled

function getFilteredImages() {
  return imageMeta
    .filter(item => {
      if (filterMode === "labeled") return item.labeled;
      if (filterMode === "unlabeled") return !item.labeled;
      return true;
    })
    .map(item => `/datasets/${item.path}`);
}

window.setFilter = function(mode, el) {
  filterMode = mode;

  // active button
  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.classList.remove("active");
  });
  if (el) el.classList.add("active");

  const canvas = document.getElementById("canvas");
  const grid = document.getElementById("gridView");
  const pagination = document.getElementById("pagination");
  const sidebar = document.getElementById("bboxSidebar");

  // 🔥 switch mode
  if (mode === "all") {
    viewMode = "single";
    index = 0;

    loadImage();
    updateImageCounter();

    canvas.style.display = "block";
    grid.style.display = "none";
    pagination.style.display = "none";

    // ✅ SHOW SIDEBAR
    if (sidebar) sidebar.style.display = "block";

  } else {
    viewMode = "grid";
    currentPage = 1;

    renderGrid();

    canvas.style.display = "none";
    grid.style.display = "grid";
    pagination.style.display = "flex";

    // ✅ HIDE SIDEBAR
    if (sidebar) sidebar.style.display = "none";
  }
  updateImageCounter();
};
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

  // 🔥 scale theo zoom cho dễ click
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
    renderBBoxList();
  };
}

// ================= DRAW =================
function drawAll() {
  ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
  ctx.clearRect(-offsetX/scale, -offsetY/scale, canvas.width/scale, canvas.height/scale);

  ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, canvas.width, canvas.height);

  const objects = getCurrentObjects();

// ===== DIM BACKGROUND (SOFT) =====
if (selectedBoxIndex !== -1) {
  ctx.save();

  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const obj = objects[selectedBoxIndex];
  if (obj) {
    const [x1, y1, x2, y2] = obj.bbox;

    const dx = x1 * displayScale;
    const dy = y1 * displayScale;
    const dw = (x2 - x1) * displayScale;
    const dh = (y2 - y1) * displayScale;

    // làm sáng lại vùng chọn (nhẹ thôi)
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillRect(dx, dy, dw, dh);

    ctx.globalCompositeOperation = "source-over";
  }

  ctx.restore();
}

  objects.forEach((obj, i) => {
    const [x1, y1, x2, y2] = obj.bbox;
    const color = classColors[obj.class] || "#00ff00";

    const dx = x1 * displayScale;
    const dy = y1 * displayScale;
    const dw = (x2 - x1) * displayScale;
    const dh = (y2 - y1) * displayScale;

    // ===== HOVER + SELECT EFFECT =====
if (i === hoveredBoxIndex) {
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = color;
  ctx.fillRect(dx, dy, dw, dh);
  ctx.globalAlpha = 1;

  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
}
else if (i === selectedBoxIndex) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
}
else {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
}

ctx.strokeRect(dx, dy, dw, dh);

    // ===== LABEL BACKGROUND (nhẹ hơn) =====
ctx.globalAlpha = 0.8;
ctx.fillStyle = color;
const text = obj.class;
const textWidth = ctx.measureText(text).width;

ctx.globalAlpha = 0.85;
ctx.fillStyle = color;
ctx.fillRect(dx, dy - 14, textWidth + 8, 14);
ctx.globalAlpha = 1;
ctx.globalAlpha = 1;

// ===== TEXT =====
ctx.font = "12px Arial";

// viền mỏng hơn
ctx.strokeStyle = "rgba(0,0,0,0.5)";
ctx.lineWidth = 1;
ctx.strokeText(obj.class, dx + 3, dy - 3);

// chữ chính
ctx.fillStyle = getTextColor(color);
ctx.fillText(obj.class, dx + 3, dy - 3);
  });

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
  };
  //renderBBoxList();
}

// ================= MOUSE =================
function getMousePos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / displayScale - offsetX / displayScale) / scale,
    y: ((e.clientY - rect.top) / displayScale - offsetY / displayScale) / scale
  };
}

// ================= MOUSE =================
canvas.onmousedown = (e) => {
//  if (isChoosingClass) return; // 🔥 QUAN TRỌNG
  if (!classes.length) {
  alert("Chưa load class!");
  return;
}
  if (e.ctrlKey) {
    isPanning = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.style.cursor = "grab";
    return;
  }

  const pos = getMousePos(e);
  const objects = getCurrentObjects();

  // ===== CHECK CLICK VÀO BOX =====
  let clickedIndex = -1;

  for (let i = objects.length - 1; i >= 0; i--) {
    if (isInsideBox(pos.x, pos.y, objects[i].bbox)) {
      clickedIndex = i;
      break;
    }
  }

  // ===== CLICK NGOÀI → CHỈ UNSELECT =====
 if (clickedIndex === -1 && selectedBoxIndex !== -1) {
  selectedBoxIndex = -1;
  hoveredBoxIndex = -1;
  drawAll();

}

  // ===== CLICK VÀO BOX =====
  if (clickedIndex !== -1) {
  selectedBoxIndex = clickedIndex;

  const box = objects[selectedBoxIndex].bbox;

  const corner = getCorner(pos.x, pos.y, box);

  if (corner) {
    isResizing = true;
    resizeCorner = corner;
    resizeEdge = null;
  } else {
    const edge = getEdge(pos.x, pos.y, box);

    if (edge) {
      isResizing = true;
      resizeEdge = edge;
      resizeCorner = null;
    } else {
      isDraggingBox = true;
      dragOffsetX = pos.x - box[0];
      dragOffsetY = pos.y - box[1];
    }
  }

  drawAll();
  return;
}

  // ===== VẼ MỚI =====
  startX = pos.x;
  startY = pos.y;
  drawing = true;
  previewBox = [startX, startY, startX, startY];
};


canvas.onmousemove = (e) => {
  if (isPanning) {
    offsetX += (e.clientX - lastX);
    offsetY += (e.clientY - lastY);
    lastX = e.clientX;
    lastY = e.clientY;
    drawAll();
    return;
  }

  // ===== MOVE =====
  if (isDraggingBox && selectedBoxIndex !== -1) {
    const pos = getMousePos(e);
    const box = getCurrentObjects()[selectedBoxIndex].bbox;

    const w = box[2] - box[0];
    const h = box[3] - box[1];

    box[0] = pos.x - dragOffsetX;
    box[1] = pos.y - dragOffsetY;
    box[2] = box[0] + w;
    box[3] = box[1] + h;

    drawAll();
    return;
  }


// ===== RESIZE (FIX CHUẨN) =====
if (isResizing && selectedBoxIndex !== -1) {
  const pos = getMousePos(e);
  const box = getCurrentObjects()[selectedBoxIndex].bbox;

  let [x1, y1, x2, y2] = box;

  // ===== CORNER =====
  if (resizeCorner === "tl") {
    x1 = pos.x; y1 = pos.y;
  }
  else if (resizeCorner === "tr") {
    x2 = pos.x; y1 = pos.y;
  }
  else if (resizeCorner === "bl") {
    x1 = pos.x; y2 = pos.y;
  }
  else if (resizeCorner === "br") {
    x2 = pos.x; y2 = pos.y;
  }

  // ===== EDGE =====
  if (resizeEdge === "left") x1 = pos.x;
  if (resizeEdge === "right") x2 = pos.x;
  if (resizeEdge === "top") y1 = pos.y;
  if (resizeEdge === "bottom") y2 = pos.y;

  // normalize
  if (x1 > x2) [x1, x2] = [x2, x1];
  if (y1 > y2) [y1, y2] = [y2, y1];

  box[0] = x1;
  box[1] = y1;
  box[2] = x2;
  box[3] = y2;

  drawAll();
  return;
}

  if (drawing) {
    const pos = getMousePos(e);
    previewBox = [startX, startY, pos.x, pos.y];
    drawAll();
    return;
  }

  // ===== HOVER =====
  const pos = getMousePos(e);
const objects = getCurrentObjects();

hoveredBoxIndex = -1;
let cursor = "crosshair";

for (let i = objects.length - 1; i >= 0; i--) {
  const box = objects[i].bbox;

  if (isInsideBox(pos.x, pos.y, box)) {
    hoveredBoxIndex = i;

    const corner = getCorner(pos.x, pos.y, box);
    const edge = getEdge(pos.x, pos.y, box);

    if (corner === "tl" || corner === "br") cursor = "nwse-resize";
    else if (corner === "tr" || corner === "bl") cursor = "nesw-resize";
    else if (edge === "left" || edge === "right") cursor = "ew-resize";
    else if (edge === "top" || edge === "bottom") cursor = "ns-resize";
    else cursor = "move";

    break;
  }
}

canvas.style.cursor = cursor;

  drawAll();
};

canvas.onmouseup = (e) => {
  isDraggingBox = false;
  isResizing = false;
  resizeEdge = null;
  resizeCorner = null;

  if (isPanning) {
    isPanning = false;
    canvas.style.cursor = "crosshair";
    return;
  }

  // ❌ KHÔNG DÙNG drawing nữa
  if (!previewBox) return;

  const pos = getMousePos(e);

  // tránh click nhầm
  const dx = Math.abs(pos.x - startX);
  const dy = Math.abs(pos.y - startY);
  if (dx < 2 && dy < 2) {
    previewBox = null;
    return;
  }

  // ===== TẠO BOX =====
 const newBox = {
  class: lastSelectedClass || "", // 🔥 FIX CHÍNH
  bbox: [startX, startY, pos.x, pos.y]
};

  const objects = getCurrentObjects();
  objects.push(newBox);

  drawing = false;
  previewBox = null;

// 🔥 luôn update trước
if (window.markDirty) window.markDirty();
drawAll();
renderBBoxList();

showFloatingClass(
  e.clientX,
  e.clientY,
  (selectedClass) => {
    newBox.class = selectedClass;

    lastSelectedClass = selectedClass;

    if (window.markDirty) window.markDirty();

    drawAll();
    renderBBoxList();
  }
);

  drawAll();
  renderBBoxList();


};

// ================= EDIT =================
window.deleteSelected = function () {
  if (selectedBoxIndex === -1) return;

  const objects = getCurrentObjects();

  if (objects[selectedBoxIndex]) {
    objects.splice(selectedBoxIndex, 1);

    if (window.markDirty) window.markDirty();

    selectedBoxIndex = -1;
    hoveredBoxIndex = -1;

    drawAll();
    renderBBoxList();
  }
};

window.changeClassSelected = function () {
  if (selectedBoxIndex === -1) return;

  const cls = document.getElementById("classSelect").value;
  const objects = getCurrentObjects();

  if (objects[selectedBoxIndex]) {
    objects[selectedBoxIndex].class = cls;

    if (window.markDirty) window.markDirty();

    selectedBoxIndex = -1;
    hoveredBoxIndex = -1;

    drawAll();
    renderBBoxList();
  }
};

window.markDirty = function () {
  window.isDirty = true;

  const btn = document.querySelector('button[onclick="save()"]');
  if (btn) {
    btn.disabled = false;
    btn.style.opacity = 1;
  };

  console.log("DIRTY TRUE");
};

// ================= ZOOM =================
canvas.addEventListener("wheel", (e) => {
  if (e.ctrlKey) {
    e.preventDefault();
    scale *= e.deltaY < 0 ? 1.1 : 0.9;
    drawAll();
  }
}, { passive: false });

// ================= SAVE =================
window.save = async function () {
  const objects = getCurrentObjects();
  if (!objects.length) return;

  await fetch(`/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project: currentProject,
      image: images[index].split("/").pop(),
      objects,
      classes,
      width: img.width,
      height: img.height
    })
  });
};

// ================= PROJECT =================
let currentProject = "";

window.createProject = async function () {
  const nameInput = document.getElementById("projectName");
  const name = nameInput.value.trim();

  if (!name) {
    alert("Nhập tên project");
    return;
  }

  try {
    // ===== CREATE PROJECT =====
    await fetch(`/create_project?name=${name}`, {
      method: "POST"
    });

    // ===== RESET STATE =====
    currentProject = name;
    classes = [];
    annotations = {};
    images = [];
    index = 0;

    renderClassSelect();

    // ===== RELOAD DROPDOWN =====
    await loadProjects();

    // ===== AUTO SELECT PROJECT MỚI =====
    const select = document.getElementById("projectSelect");
    select.value = name;

    // ===== LOAD DATA =====
    await loadImagesFromProject();

    // ===== CLEAR INPUT =====
    nameInput.value = "";

    console.log("Created project:", name);

  } catch (err) {
    console.error("Create project error:", err);
    alert("Lỗi tạo project!");
  }
};

async function loadProjects() {
  try {
    const res = await fetch("/projects");
    const projects = await res.json();

    const select = document.getElementById("projectSelect");

    // clear cũ
    select.innerHTML = "";

    projects.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p;
      opt.textContent = p;
      select.appendChild(opt);
    });

  } catch (err) {
    console.error("Load projects error:", err);
  }
}

window.uploadFolder = async function () {
  if (!currentProject) return alert("Tạo project trước!");

  const files = document.getElementById("folderInput").files;

  if (!files.length) return alert("Chưa chọn file!");

  const BATCH_SIZE = 50;

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = Array.from(files).slice(i, i + BATCH_SIZE);

    const formData = new FormData();

    batch.forEach(f => formData.append("files", f));

    const res = await fetch(`/upload?project=${currentProject}`, {
      method: "POST",
      body: formData
    });

    const data = await res.json();
    console.log("Uploaded batch:", data);
  }

  await loadImagesFromProject();
};

async function loadImagesFromProject() {
  const res = await fetch(`/images?project=${currentProject}`);
  const data = await res.json();

  imageMeta = data;
  updateFilterCount();
  images = data
  .filter(x => x.path) // 🔥 bỏ undefined
  .map(x => `/datasets/${x.path}`);

  // 🔥 QUAN TRỌNG
  if (viewMode === "grid") {
    renderGrid();
  } else {
    index = 0;
    loadImage();
    updateImageCounter();
  }
}

// ================= PROJECT LIST =================
async function loadProjectList() {
  const res = await fetch("/projects");
  const data = await res.json();

  const select = document.getElementById("projectSelect");
  if (!select) return;

  select.innerHTML = "";

  data.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = p;
    select.appendChild(opt);
  });
}

async function loadAnnotations() {
  if (!currentProject || !images.length) return;

  const imageName = images[index].split("/").pop();

  const res = await fetch(`/annotations?project=${currentProject}&image=${imageName}`);
  const data = await res.json();

  const objects = [];

  data.forEach(obj => {
    const [xc, yc, w, h] = obj.bbox;

    // convert YOLO → pixel
    const x1 = (xc - w/2) * img.width;
    const y1 = (yc - h/2) * img.height;
    const x2 = (xc + w/2) * img.width;
    const y2 = (yc + h/2) * img.height;

    objects.push({
      class: obj.class,
      bbox: [x1, y1, x2, y2]
    });
  });

  annotations[getKey()] = objects;

  drawAll();
  renderBBoxList();
}

// ================= LOAD PROJECT =================
window.loadProject = async function () {
  const select = document.getElementById("projectSelect");
  const project = select.value;

  if (!project) return;

  currentProject = project;

  // 🔥 load classes từ backend
  const resClass = await fetch(`/classes?project=${project}`);
  const classData = await resClass.json();

  classes = classData || [];
  renderClassSelect();

  // load images
  await loadImagesFromProject();

  //alert("Project loaded!");
};

// ================= NAVIGATION =================
window.nextImage = function () {
  const list = getFilteredImages();
  const current = images[index];
  let i = list.indexOf(current);

  if (i < list.length - 1) {
    save();
    const next = list[i + 1];
    index = images.indexOf(next);
    loadImage();
    updateImageCounter();
  }
};

window.prevImage = function () {
  const list = getFilteredImages();
  const current = images[index];
  let i = list.indexOf(current);

  if (i > 0) {
    save();
    const prev = list[i - 1];
    index = images.indexOf(prev);
    loadImage();
    updateImageCounter();
  }
};

window.resetView = function () {
  scale = 1;
  offsetX = 0;
  offsetY = 0;
  drawAll();
};

window.clearLast = function () {
  const objects = getCurrentObjects();
  if (!objects.length) return;

  objects.pop();
  drawAll();
};

window.exportDataset = async function () {
  if (!currentProject) {
    alert("Chưa chọn project!");
    return;
  }

  window.location.href = `/export?project=${currentProject}`;
};

//canvas.ondblclick = async (e) => {
//  if (selectedBoxIndex === -1) return;
//
//  const action = prompt("e = edit class, d = delete");
//
//  if (action === "d") {
//    const objects = getCurrentObjects();
//
//    if (objects[selectedBoxIndex]) {
//      objects.splice(selectedBoxIndex, 1);
//      selectedBoxIndex = -1;
//
//      window.markDirty();   // 🔥 chắc chắn chạy
//      await save();
//    }
//  }
//
//  if (action === "e") {
//    const cls = prompt("New class:");
//
//    if (cls) {
//      const objects = getCurrentObjects();
//
//      if (objects[selectedBoxIndex]) {
//        objects[selectedBoxIndex].class = cls;
//
//        window.markDirty();  // 🔥 chắc chắn chạy
//        await save();
//      }
//    }
//  }
//
//  drawAll();
//};

// ================= UI STATE PRO =================

// track thay đổi
let isDirty = false;

// override add object để detect change
window.markDirty();

// override splice (delete)
const originalSplice = Array.prototype.splice;
Array.prototype.splice = function (...args) {
  isDirty = true;
  updateSaveButton();
  return originalSplice.apply(this, args);
};

// ================= BUTTON STATE =================
function updateSaveButton() {
  const btn = document.querySelector('button[onclick="save()"]');
  if (!btn) return;

  if (isDirty) {
    btn.disabled = false;
    btn.style.opacity = 1;
  } else {
    btn.disabled = true;
    btn.style.opacity = 0.5;
  }
}

// ================= AUTO SAVE =================
async function autoSaveIfNeeded() {
  if (!isDirty) return;

  console.log("Auto saving...");
  await save();
  isDirty = false;
  updateSaveButton();
}

// patch next / prev để auto save
const _nextImage = window.nextImage;
window.nextImage = async function () {
  await autoSaveIfNeeded();
  _nextImage();

};

const _prevImage = window.prevImage;
window.prevImage = async function () {
  await autoSaveIfNeeded();
  _prevImage();
};

// ================= SAVE PATCH =================
const _save = window.save;
window.save = async function () {
  const btn = document.querySelector('button[onclick="save()"]');

  btn.innerText = "Saving...";
  btn.disabled = true;

  await _save();

  btn.innerText = "Saved ✔";
  isDirty = false;
  updateSaveButton();

  setTimeout(() => {
    btn.innerText = "Save";
  }, 1000);
};

// ================= CLASS HIGHLIGHT =================
const classSelect = document.getElementById("classSelect");
classSelect.addEventListener("change", () => {
  lastSelectedClass = classSelect.value;
});

if (classSelect) {
  classSelect.addEventListener("change", () => {
    classSelect.style.borderColor = "#2563eb";
  });
}

// ================= KEYBOARD SHORTCUT =================
window.addEventListener("keydown", (e) => {
  if (e.key === "Delete") {
    deleteSelected();
  }

  if (e.ctrlKey && e.key === "z") {
    clearLast();
  }

  if (e.ctrlKey && e.key === "s") {
    e.preventDefault();
    save();
  }
});

// ================= INIT =================
setTimeout(() => {
  updateSaveButton();
}, 500);

// ================= HOTKEY NAVIGATION =================
window.addEventListener("keydown", (e) => {

  // tránh bị trigger khi đang gõ input
  const tag = document.activeElement.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea") return;

  // ===== NEXT (→) =====
  if (e.key === "ArrowRight") {
    e.preventDefault();
    nextImage();
    updateImageCounter();
  }

  // ===== PREV (←) =====
  if (e.key === "ArrowLeft") {
    e.preventDefault();
    prevImage();
    updateImageCounter();
  }

});

document.addEventListener("click", (e) => {
  // 🔥 nếu click từ canvas → KHÔNG tắt
  if (e.target === canvas) return;

  if (floatingClass.style.display === "block" && !floatingClass.contains(e.target)) {
    floatingClass.style.display = "none";
  }
});
function updateImageMeta() {
  const currentPath = getKey().replace("/datasets/", "");
  const meta = imageMeta.find(m => m.path === currentPath);

  if (meta) {
    const objects = getCurrentObjects();
    meta.count = objects.length;
    meta.labeled = objects.length > 0;
  }
  updateFilterCount();
}

function updateImageCounter() {
  const list = getFilteredImages();

  const current = images[index];
  const i = list.indexOf(current);

  const currentIndex = i >= 0 ? i + 1 : 0;

  document.getElementById("imageCounter").innerText =
    `${currentIndex} / ${list.length}`;
}

function renderBBoxList() {
  const list = document.getElementById("bboxList");
  if (!list) return;

  const objects = getCurrentObjects();
  list.innerHTML = "";

  objects.forEach((obj, i) => {
    const item = document.createElement("div");
    item.className = "bbox-item";

    const isSelected = i === selectedBoxIndex;
    if (isSelected) item.classList.add("active");

    const color = classColors[obj.class] || "#00ff00";

    // ===== HOVER SIDEBAR → CANVAS =====
    item.onmouseenter = () => {
      hoveredBoxIndex = i;
      drawAll();
    };

    item.onmouseleave = () => {
      hoveredBoxIndex = -1;
      drawAll();
    };

    // ===== LABEL =====
    const label = document.createElement("span");
    label.className = "bbox-label";
    label.textContent = obj.class;

    label.style.background = color;
    label.style.color = getTextColor(color);

    // ===== EDIT CLASS =====
    label.onclick = (e) => {
      e.stopPropagation();

      const select = document.createElement("select");

      classes.forEach(cls => {
        const opt = document.createElement("option");
        opt.value = cls;
        opt.textContent = cls;
        if (cls === obj.class) opt.selected = true;
        select.appendChild(opt);
      });

      select.style.background = "#111827";
      select.style.color = "white";
      select.style.border = "1px solid #374151";
      select.style.borderRadius = "4px";

      select.onchange = () => {
        obj.class = select.value;

        updateImageMeta(); // 🔥 FIX

        if (window.markDirty) window.markDirty();

        drawAll();
        renderBBoxList();

        if (viewMode === "grid") renderGrid(); // 🔥 refresh grid
      };

      select.onblur = () => {
        renderBBoxList();
      };

      item.replaceChild(select, label);
      select.focus();
    };

    // ===== DELETE =====
    const del = document.createElement("span");
    del.className = "bbox-del";
    del.textContent = "✕";

    del.onclick = (e) => {
      e.stopPropagation();

      objects.splice(i, 1);

      updateImageMeta(); // 🔥 FIX QUAN TRỌNG

      if (window.markDirty) window.markDirty();

      selectedBoxIndex = -1;
      hoveredBoxIndex = -1;

      drawAll();
      renderBBoxList();

      if (viewMode === "grid") renderGrid(); // 🔥 refresh grid
    };

    // ===== CLICK → SELECT =====
    item.onclick = () => {
      selectedBoxIndex = i;
      hoveredBoxIndex = i;

      drawAll();
      renderBBoxList();
    };

    item.appendChild(label);
    item.appendChild(del);

    list.appendChild(item);

    // ===== AUTO SCROLL =====
    if (isSelected) {
      setTimeout(() => {
        item.scrollIntoView({ block: "nearest" });
      }, 0);
    }
  });

  // 🔥 đảm bảo sync cuối cùng
  updateImageMeta();
}

function updateFilterCount() {
  const total = imageMeta.length;
  const labeled = imageMeta.filter(x => x.labeled).length;
  const unlabeled = total - labeled;

  document.getElementById("btnAll").innerText = `All (${total})`;
  document.getElementById("btnLabeled").innerText = `Labeled (${labeled})`;
  document.getElementById("btnUnlabeled").innerText = `Unlabeled (${unlabeled})`;
}

function renderGrid() {
  const grid = document.getElementById("gridView");
  const pagination = document.getElementById("pagination");

  const list = getFilteredImages();

  const start = (currentPage - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;

  const pageItems = list.slice(start, end);

  grid.innerHTML = "";

  pageItems.forEach(imgPath => {
    const div = document.createElement("div");
    div.className = "grid-item";

    // ✅ FIX LABELED
    const meta = imageMeta.find(m => `/datasets/${m.path}` === imgPath);

    if (meta && meta.labeled) {
      div.classList.add("labeled");
    } else {
      div.classList.add("unlabeled");
    }

    const imgEl = document.createElement("img");
    imgEl.src = imgPath;

    div.appendChild(imgEl);

    // click → quay về annotate
    div.onclick = () => {
      viewMode = "single";

      document.getElementById("canvas").style.display = "block";
      grid.style.display = "none";
      pagination.style.display = "none";

      document.getElementById("bboxSidebar").style.display = "block";

      index = images.indexOf(imgPath);
      loadImage();
      updateImageCounter();
    };

    grid.appendChild(div);
  });

  renderPagination(list.length);
  pagination.style.display = "flex";
}

function renderPagination(total) {
  const pagination = document.getElementById("pagination");

  const totalPages = Math.ceil(total / PAGE_SIZE);

  pagination.innerHTML = "";

  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement("button");
    btn.className = "page-btn";
    btn.innerText = i;

    if (i === currentPage) btn.classList.add("active");

    btn.onclick = () => {
      currentPage = i;
      renderGrid();
    };

    pagination.appendChild(btn);
  }
}


// ================= INIT =================
renderClassSelect();
loadProjectList();
loadAnnotations();