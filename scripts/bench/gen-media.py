# Gera 100 fotos (60×12 MP, 30×1080p, 10 PNG, algumas com orientação EXIF) e 50 vídeos H.264
# (3–15 s, paisagem/retrato, metade com áudio, alguns .mov/rotacionados) para benchmarks.
# Uso: python scripts/bench/gen-media.py <pasta-de-saída>   (requer Pillow e ffmpeg no PATH)
import os, subprocess, sys, random
from concurrent.futures import ThreadPoolExecutor
from PIL import Image, ImageDraw, ImageFont
out = sys.argv[1]
os.makedirs(out, exist_ok=True)
random.seed(7)
try:
    font = ImageFont.truetype("arialbd.ttf", 220)
except Exception:
    font = ImageFont.load_default()

def photo(i):
    if i < 60: w, h, ext = 4000, 3000, "jpg"
    elif i < 90: w, h, ext = 1920, 1080, "jpg"
    else: w, h, ext = 1200, 1200, "png"
    hue = (i * 37) % 360
    base = Image.new("HSV", (8, 8), (int(hue * 255 / 360), 160, 220)).convert("RGB").resize((w, h))
    img = Image.linear_gradient("L").resize((w, h))
    img = Image.merge("RGB", (img, base.split()[1], base.split()[2]))
    d = ImageDraw.Draw(img)
    d.text((w // 2, h // 2), f"#{i+1:03d}", fill="white", font=font, anchor="mm")
    d.text((60, 60), "TOP", fill="white", font=font)
    path = os.path.join(out, f"foto_{i+1:03d}.{ext}")
    if ext == "jpg":
        exif = Image.Exif()
        exif[0x0112] = [1, 6, 8, 3][i % 4] if i % 5 == 0 else 1
        exif.get_ifd(0x8769)[0x9003] = f"2024:{(i % 12) + 1:02d}:{(i % 27) + 1:02d} 1{i % 10}:00:00"
        img.save(path, quality=88, exif=exif)
    else:
        img.save(path)

def video(i):
    dur = random.choice([3, 4, 6, 8, 12, 15])
    size = random.choice(["1280x720", "1920x1080", "720x1280"])
    audio = i % 2 == 0
    ext = "mov" if i % 7 == 0 else "mp4"
    path = os.path.join(out, f"video_{i+1:03d}.{ext}")
    cmd = ["ffmpeg", "-y", "-loglevel", "error"]
    if i % 10 == 3:
        cmd += ["-display_rotation", "90"]
    cmd += ["-f", "lavfi", "-i", f"testsrc2=size={size}:rate=30:duration={dur}"]
    if audio:
        cmd += ["-f", "lavfi", "-i", f"sine=frequency={220 + i * 10}:duration={dur}"]
    cmd += ["-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-g", "30"]
    if audio:
        cmd += ["-c:a", "aac", "-b:a", "96k", "-shortest"]
    cmd += ["-metadata", f"creation_time=2024-{(i % 12) + 1:02d}-15T10:00:00Z", path]
    subprocess.run(cmd, check=True)

with ThreadPoolExecutor(8) as ex:
    list(ex.map(photo, range(100)))
    list(ex.map(video, range(50)))
print("ok", len(os.listdir(out)))
