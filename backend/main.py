from fastapi import FastAPI, UploadFile, File
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from fastapi import Form

import os
import zipfile
import shutil
import json
from datetime import datetime

ALLOWED_EXT = [".jpg", ".jpeg", ".png"]

app = FastAPI()

# ================= STATIC =================
app.mount("/static", StaticFiles(directory="../frontend"), name="static")
app.mount("/datasets", StaticFiles(directory="datasets"), name="datasets")

BASE_DIR = "datasets"
os.makedirs(BASE_DIR, exist_ok=True)

# ================= ROOT =================
@app.get("/")
async def root():
    return FileResponse("../frontend/public/index.html")

# ================= CREATE PROJECT =================
@app.post("/create_project")
async def create_project(name: str):
    project_path = os.path.join(BASE_DIR, name)

    os.makedirs(os.path.join(project_path, "images"), exist_ok=True)
    os.makedirs(os.path.join(project_path, "labels"), exist_ok=True)

    return {"status": "created"}

# ================= UPLOAD =================
@app.post("/upload")
async def upload(project: str, batch: int = Form(0), files: list[UploadFile] = File(...)):
    project_path = os.path.join(BASE_DIR, project, f"batch_{batch}", "images")
    os.makedirs(project_path, exist_ok=True)

    for file in files:
        ext = os.path.splitext(file.filename)[1].lower()

        if ext not in ALLOWED_EXT:
            continue  # bỏ qua file không hợp lệ

        filename = os.path.basename(file.filename)
        file_path = os.path.join(project_path, filename)

        skip = False

        for root, _, files in os.walk(os.path.join(BASE_DIR, project)):
            if filename in files:
                print("Skip duplicate:", filename)
                skip = True
                break

        if skip:
            continue

        with open(file_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

    return {"status": "uploaded"}

# ================= LIST IMAGES =================
@app.get("/images")
async def list_images(project: str):
    project_path = os.path.join(BASE_DIR, project)

    result = []

    for root, _, files in os.walk(project_path):
        if "images" in root:
            for f in files:

                # 🔥 chỉ lấy file ảnh
                if not f.lower().endswith((".jpg", ".jpeg", ".png")):
                    continue

                full_path = os.path.join(root, f)

                # 👉 path dùng cho frontend
                rel_path = full_path.replace(BASE_DIR + os.sep, "").replace("\\", "/")

                # 👉 check label tồn tại
                label_name = os.path.splitext(f)[0] + ".txt"
                label_path = os.path.join(project_path, "labels", label_name)

                result.append({
                    "path": rel_path,
                    "labeled": os.path.exists(label_path)
                })

    return result

# ================= SAVE =================
class SaveRequest(BaseModel):
    project: str
    image: str
    objects: list
    classes: list
    width: int
    height: int

@app.post("/save")
async def save(data: SaveRequest):
    label_dir = os.path.join(BASE_DIR, data.project, "labels")
    os.makedirs(label_dir, exist_ok=True)

    # đổi .jpg → .txt
    label_name = data.image.rsplit(".", 1)[0] + ".txt"
    label_path = os.path.join(label_dir, label_name)

    lines = []

    for obj in data.objects:
        try:
            cls_id = data.classes.index(obj["class"])
            x1, y1, x2, y2 = obj["bbox"]

            x_min, x_max = min(x1, x2), max(x1, x2)
            y_min, y_max = min(y1, y2), max(y1, y2)

            xc = ((x_min + x_max) / 2) / data.width
            yc = ((y_min + y_max) / 2) / data.height
            w = (x_max - x_min) / data.width
            h = (y_max - y_min) / data.height

            if w <= 0 or h <= 0:
                continue

            lines.append(f"{cls_id} {xc:.6f} {yc:.6f} {w:.6f} {h:.6f}")

        except Exception as e:
            print("ERROR:", e)

    with open(label_path, "w") as f:
        f.write("\n".join(lines))

    # ================= SAVE CLASSES =================
    class_path = os.path.join(BASE_DIR, data.project, "classes.json")

    with open(class_path, "w") as f:
        json.dump(data.classes, f)

    print("Saved:", label_path)

    return {"status": "saved"}

@app.get("/projects")
async def list_projects():
    if not os.path.exists(BASE_DIR):
        return []

    return [d for d in os.listdir(BASE_DIR)
            if os.path.isdir(os.path.join(BASE_DIR, d))]

@app.get("/classes")
async def get_classes(project: str):
    path = os.path.join(BASE_DIR, project, "classes.json")

    if os.path.exists(path):
        with open(path, "r") as f:
            return json.load(f)

    return []

@app.get("/annotations")
async def get_annotations(project: str, image: str):
    # xử lý mọi loại extension
    name = os.path.splitext(image)[0]
    label_path = os.path.join(BASE_DIR, project, "labels", name + ".txt")
    print("ANNOTATION LOAD:", label_path)

    if not os.path.exists(label_path):
        return []

    objects = []

    # load class list
    class_path = os.path.join(BASE_DIR, project, "classes.json")
    if os.path.exists(class_path):
        with open(class_path, "r") as f:
            class_names = json.load(f)
    else:
        class_names = []

    with open(label_path, "r") as f:
        lines = f.readlines()

    for line in lines:
        parts = line.strip().split()
        if len(parts) != 5:
            continue

        cls_id, xc, yc, w, h = map(float, parts)

        objects.append({
            "class": class_names[int(cls_id)] if int(cls_id) < len(class_names) else str(int(cls_id)),
            "bbox": [xc, yc, w, h],  # ⚠ normalized
        })

    return objects

# ================= EXPORT =================
@app.get("/export")
async def export(project: str):
    project_path = os.path.join(BASE_DIR, project)

    now = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    export_dir = os.path.join(BASE_DIR, f"{project}_{now}")

    images_out = os.path.join(export_dir, "images")
    labels_out = os.path.join(export_dir, "labels")

    os.makedirs(images_out, exist_ok=True)
    os.makedirs(labels_out, exist_ok=True)

    used_names = set()

    # ===== LOAD CLASSES =====
    class_file = os.path.join(project_path, "classes.json")
    if os.path.exists(class_file):
        with open(class_file, "r") as f:
            class_names = json.load(f)
    else:
        class_names = []

    # ===== DUYỆT TẤT CẢ BATCH =====
    for root, _, files in os.walk(project_path):
        if "images" not in root:
            continue

        for f in files:
            if not f.lower().endswith((".jpg", ".jpeg", ".png")):
                continue

            img_path = os.path.join(root, f)

            label_name = os.path.splitext(f)[0] + ".txt"
            label_path = None

            for r, _, fs in os.walk(project_path):
                if "labels" in r and label_name in fs:
                    label_path = os.path.join(r, label_name)
                    break

            if not label_path:
                continue

            # 👉 chỉ export ảnh có label
            if not os.path.exists(label_path):
                continue

            if os.path.getsize(label_path) == 0:
                continue

            # ===== TRÁNH TRÙNG TÊN =====
            name, ext = os.path.splitext(f)
            new_name = f
            i = 1

            while new_name in used_names:
                new_name = f"{name}_{i}{ext}"
                i += 1

            used_names.add(new_name)

            # ===== COPY IMAGE =====
            shutil.copy(img_path, os.path.join(images_out, new_name))

            # ===== COPY LABEL =====
            new_label = new_name.rsplit(".", 1)[0] + ".txt"
            shutil.copy(label_path, os.path.join(labels_out, new_label))

    # ===== classes.txt =====
    with open(os.path.join(export_dir, "classes.txt"), "w") as f:
        f.write("\n".join(class_names))

    # ===== data.yaml =====
    with open(os.path.join(export_dir, "data.yaml"), "w") as f:
        f.write(f"path: .\n")
        f.write(f"train: images\n")
        f.write(f"val: images\n\n")
        f.write(f"nc: {len(class_names)}\n")
        f.write(f"names: {json.dumps(class_names)}\n")

    # ===== ZIP =====
    zip_path = export_dir + ".zip"

    with zipfile.ZipFile(zip_path, "w") as z:
        for root, _, files in os.walk(export_dir):
            for f in files:
                full = os.path.join(root, f)
                rel = os.path.relpath(full, export_dir)
                z.write(full, rel)

    return FileResponse(zip_path, filename=os.path.basename(zip_path))