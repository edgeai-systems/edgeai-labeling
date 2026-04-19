<p align="center">
  <img src="docs/logo_transparent_hd.png" alt="EdgeAI Systems" width="180"/>
</p>

<h1 align="center">EdgeAI Labeling</h1>

<p align="center">
  <b>AI-assisted image annotation tool — label thousands of images in minutes, not hours.</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.10-blue?style=flat-square&logo=python" />
  <img src="https://img.shields.io/badge/YOLOv8-Ultralytics-green?style=flat-square" />
  <img src="https://img.shields.io/badge/FastAPI-Backend-009688?style=flat-square&logo=fastapi" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" />
</p>

---

## 🎬 Demo

### ⚡ Auto Labeling — click once, done

![Auto Label](docs/auto_label.gif)

### ✏️ Manual Labeling

![Manual Label](docs/custom.gif)

---

## ✨ Features

| Feature | Details |
|---|---|
| 🧠 **AI Auto Labeling** | One-click detection via YOLOv8 — works on your own custom models |
| 🖱️ **Manual Annotation** | Draw, move, resize bounding boxes with full mouse + keyboard support |
| ⌨️ **Keyboard Shortcuts** | Tab between boxes, Esc to deselect, Space to reset view |
| ↩️ **Undo / Redo** | Full history stack — undo move, resize, delete, class change |
| 📦 **YOLO Export** | Export labels in YOLOv5/v8 format, ready for training |
| 🗂️ **Batch Management** | Organize images into batches, filter labeled/unlabeled |
| 💾 **Auto Save** | Debounced autosave — never lose your work |
| 🐳 **Docker Ready** | One command to spin up the entire stack |

---

## 🆚 Why not CVAT / Label Studio?

| | EdgeAI Labeling | CVAT | Label Studio |
|---|:---:|:---:|:---:|
| Setup time | **< 1 min** | ~30 min | ~15 min |
| Built-in YOLO auto label | ✅ | ✅ (complex) | ✅ (complex) |
| Lightweight | ✅ | ❌ | ❌ |
| Self-hosted | ✅ | ✅ | ✅ |
| YOLO format export | ✅ | ✅ | ✅ |

> ⚡ Best for: small–medium datasets, fast iteration, YOLO workflows.

---

## 🚀 Quick Start (30 seconds)

```bash
# 1. Clone
git clone https://github.com/edgeai-systems/edgeai-labeling.git
cd edgeai-labeling

# 2. Start backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Open **http://localhost:8000** → Upload images → Click **AUTO** → Done 🎯

---

## ⚙️ Installation

### Option 1: venv

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# Linux / Mac
source venv/bin/activate

pip install -r requirements.txt
```

### Option 2: Conda (recommended for GPU)

```bash
cd backend
conda create -n edgeai python=3.10 -y
conda activate edgeai
pip install -r requirements.txt
```

### Run

```bash
mkdir backend/datasets
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

- 👉 **UI:** http://localhost:8000/
- 👉 **API docs:** http://localhost:8000/docs

---

## ⚡ GPU Support (Optional)

```bash
# Example: CUDA 12.1
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
```

> ⚠️ If GPU is not configured → app falls back to CPU automatically.

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|---|---|
| `←` / `→` | Previous / Next image |
| `Tab` / `Shift+Tab` | Cycle through bboxes |
| `Del` | Delete selected bbox |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Ctrl+S` | Save |
| `Space` | Reset view |
| `Esc` | Deselect bbox |
| `?` | Show hotkey cheatsheet |

---

## 📦 YOLO Export Format

```
class_id x_center y_center width height
```

Compatible with **YOLOv5** and **YOLOv8 (Ultralytics)**.

> ⚠️ Split your dataset into **train / val / test** before training.

---

## 🏗️ Project Structure

```
edgeai-labeling/
├── backend/           # FastAPI + YOLO inference
│   ├── app/
│   ├── datasets/      # Your labeled data
│   └── models/        # YOLO model files (.pt)
├── frontend/          # Vanilla JS labeling UI
├── docs/              # Assets & demo GIFs
├── docker-compose.yml
└── README.md
```

---

## 💡 Roadmap

- [ ] Batch auto labeling (folder)
- [ ] Polygon segmentation
- [ ] Multi-user support
- [ ] Model selection UI
- [ ] Cloud sync

---

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first.

---

## ☕ Support

If this tool saves you hours of manual work, consider buying me a coffee!

- 🌍 **PayPal:** https://paypal.me/anhpnh
- 🇻🇳 **Vietnam (MoMo / Bank QR):**

![Donate](docs/donate.jpg)

---

## ⭐ Star this repo

If you find this project useful, please give it a ⭐ — it really helps!

---

## 📄 License

MIT License
