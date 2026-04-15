import os
import cv2

# ================= CONFIG =================
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))

BASE_PATH = r"D:\anhpnh\#AI\edgeai-labeling\backend\test\car_vn_2026-04-15_17-00-48"

IMAGE_DIR = os.path.join(BASE_PATH, "images")
LABEL_DIR = os.path.join(BASE_PATH, "labels")
CLASS_PATH = os.path.join(BASE_PATH, "classes.txt")

print("BASE_PATH:", BASE_PATH)
print("IMAGE_DIR exists:", os.path.exists(IMAGE_DIR))
print("LABEL_DIR exists:", os.path.exists(LABEL_DIR))
print("CLASS_PATH exists:", os.path.exists(CLASS_PATH))

MAX_W = 1200
MAX_H = 800

LINE_THICKNESS = 2
SHOW_CLASS_NAME = True

# ================= LOAD CLASSES =================
def load_classes(path):
    if not os.path.exists(path):
        print("❌ classes.txt not found")
        return []

    with open(path, "r", encoding="utf-8") as f:
        classes = [line.strip() for line in f.readlines()]

    print("✅ Loaded classes:", classes)
    return classes

CLASS_NAMES = load_classes(CLASS_PATH)

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

# ================= YOLO → PIXEL =================
def yolo_to_pixel(cls_id, xc, yc, bw, bh, img_w, img_h):
    x_center = xc * img_w
    y_center = yc * img_h
    box_w = bw * img_w
    box_h = bh * img_h

    x1 = int(x_center - box_w / 2)
    y1 = int(y_center - box_h / 2)
    x2 = int(x_center + box_w / 2)
    y2 = int(y_center + box_h / 2)

    return x1, y1, x2, y2

# ================= DRAW =================
def draw_yolo(image_path, label_path):
    img = cv2.imread(image_path)

    if img is None:
        print("❌ Cannot read:", image_path)
        return None

    h, w = img.shape[:2]

    if not os.path.exists(label_path):
        return img

    with open(label_path, "r") as f:
        lines = f.readlines()

    for line in lines:
        parts = line.strip().split()

        if len(parts) < 5:
            continue

        cls_id, xc, yc, bw, bh = map(float, parts[:5])
        cls_id = int(cls_id)

        x1, y1, x2, y2 = yolo_to_pixel(cls_id, xc, yc, bw, bh, w, h)

        # clamp
        x1 = max(0, x1)
        y1 = max(0, y1)
        x2 = min(w, x2)
        y2 = min(h, y2)

        color = get_color(cls_id)

        # draw bbox
        cv2.rectangle(img, (x1, y1), (x2, y2), color, LINE_THICKNESS)

        # label
        if SHOW_CLASS_NAME and cls_id < len(CLASS_NAMES):
            label = CLASS_NAMES[cls_id]
        else:
            label = str(cls_id)

        text = f"{label}"

        # text position
        text_x = x1
        text_y = y1 - 10 if y1 > 20 else y2 + 20

        # viền đen
        cv2.putText(
            img,
            text,
            (text_x, text_y),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 0, 0),
            3
        )

        # chữ màu
        cv2.putText(
            img,
            text,
            (text_x, text_y),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            color,
            2
        )

        # debug log
        print(f"✔ class_id={cls_id}, label={label}, box=({x1},{y1},{x2},{y2})")

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
        label_path = os.path.join(
            LABEL_DIR,
            filename.rsplit(".", 1)[0] + ".txt"
        )

        print(f"\n🔍 Checking: {filename}")

        img = draw_yolo(image_path, label_path)

        if img is None:
            i += 1
            continue

        display = resize_for_display(img)

        cv2.imshow("YOLO Viewer", display)

        key = cv2.waitKey(0)

        if key == 27:  # ESC
            break
        elif key == ord('a'):  # back
            i = max(0, i - 1)
        elif key == ord('d'):  # next
            i += 1
        else:
            i += 1

    cv2.destroyAllWindows()

# ================= RUN =================
if __name__ == "__main__":
    main()