import os
import cv2
import json

# ================= CONFIG =================
BASE_PATH = "../datasets/plate_ocr"

IMAGE_DIR = os.path.join(BASE_PATH, "batch_0/images")
LABEL_DIR = os.path.join(BASE_PATH, "labels")

MAX_W = 1200
MAX_H = 800

SHOW_CLASS_NAME = True
LINE_THICKNESS = 2

SCALE_UP = 3  # 🔥 QUAN TRỌNG (2~4)

# ================= LOAD CLASS =================
def load_classes():
    json_path = os.path.join(BASE_PATH, "classes.json")
    txt_path = os.path.join(BASE_PATH, "classes.txt")

    if os.path.exists(json_path):
        with open(json_path, "r") as f:
            return json.load(f)

    elif os.path.exists(txt_path):
        with open(txt_path, "r") as f:
            return [line.strip() for line in f.readlines()]

    return []

CLASS_NAMES = load_classes()
print("Loaded classes:", CLASS_NAMES)

# ================= COLOR =================
def get_color(cls_id):
    colors = [
        (0,255,0),
        (0,0,255),
        (255,0,0),
        (0,255,255),
        (255,255,0),
        (255,0,255)
    ]
    return colors[cls_id % len(colors)]

# ================= DRAW =================
def draw_yolo(image_path, label_path):
    img = cv2.imread(image_path)

    if img is None:
        print("❌ Cannot read:", image_path)
        return None

    # 🔥 SCALE ẢNH TRƯỚC (QUAN TRỌNG NHẤT)
    img = cv2.resize(
        img,
        None,
        fx=SCALE_UP,
        fy=SCALE_UP,
        interpolation=cv2.INTER_NEAREST
    )

    h, w = img.shape[:2]

    if not os.path.exists(label_path):
        return img

    with open(label_path, "r") as f:
        lines = f.readlines()

    for line in lines:
        parts = line.strip().split()
        if len(parts) != 5:
            continue

        cls_id, xc, yc, bw, bh = map(float, parts)
        cls_id = int(cls_id)

        # YOLO → pixel (sau khi scale)
        x_center = xc * w
        y_center = yc * h
        box_w = bw * w
        box_h = bh * h

        x1 = int(x_center - box_w / 2)
        y1 = int(y_center - box_h / 2)
        x2 = int(x_center + box_w / 2)
        y2 = int(y_center + box_h / 2)

        x1 = max(0, x1)
        y1 = max(0, y1)
        x2 = min(w, x2)
        y2 = min(h, y2)

        color = get_color(cls_id)

        # bbox rõ hơn
        cv2.rectangle(img, (x1, y1), (x2, y2), color, LINE_THICKNESS)

        # label
        if SHOW_CLASS_NAME and cls_id < len(CLASS_NAMES):
            label = CLASS_NAMES[cls_id]
        else:
            label = str(cls_id)

        # 🔥 FONT SCALE SAU KHI SCALE ẢNH
        font_scale = 4

        text_x = x1
        text_y = y1 - 5 if y1 > 20 else y2 + 20

        # viền đen (rất quan trọng)
        cv2.putText(
            img,
            label,
            (text_x, text_y),
            cv2.FONT_HERSHEY_SIMPLEX,
            font_scale,
            (0,0,0),
            10
        )

        # chữ màu
        cv2.putText(
            img,
            label,
            (text_x, text_y),
            cv2.FONT_HERSHEY_SIMPLEX,
            font_scale,
            color,
            1
        )

    return img

# ================= RESIZE =================
def resize_for_display(img):
    h, w = img.shape[:2]
    scale = min(MAX_W / w, MAX_H / h)
    return cv2.resize(img, (int(w * scale), int(h * scale)))

# ================= MAIN =================
def main():
    files = sorted(os.listdir(IMAGE_DIR))
    i = 0

    while i < len(files):
        filename = files[i]

        if not filename.lower().endswith((".jpg", ".png", ".jpeg")):
            i += 1
            continue

        image_path = os.path.join(IMAGE_DIR, filename)
        label_path = os.path.join(LABEL_DIR, filename.rsplit(".", 1)[0] + ".txt")

        print(f"🔍 Checking: {filename}")

        img = draw_yolo(image_path, label_path)

        if img is None:
            i += 1
            continue

        display = resize_for_display(img)

        cv2.imshow("YOLO Viewer", display)

        key = cv2.waitKey(0)

        if key == 27:
            break
        elif key == ord('a'):
            i = max(0, i - 1)
        elif key == ord('d'):
            i += 1
        else:
            i += 1

    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()