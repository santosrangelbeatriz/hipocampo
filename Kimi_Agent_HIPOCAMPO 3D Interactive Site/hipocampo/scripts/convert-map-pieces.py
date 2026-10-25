import json
import os
import shutil
from pathlib import Path
from PIL import Image

PROJECT_ROOT = Path(__file__).resolve().parents[1]
MAP_DIR = PROJECT_ROOT / "public" / "images" / "map"
MAP_SRC_DIR = PROJECT_ROOT / "images-src" / "map"
MANIFEST_PATH = MAP_DIR / "manifest.json"

MAP_SRC_DIR.mkdir(parents=True, exist_ok=True)

png_total = 0
webp_total = 0

for i in range(1, 33):
    png_name = f"peca-{i:02d}.png"
    webp_name = f"peca-{i:02d}.webp"
    
    png_path = MAP_DIR / png_name
    backup_png_path = MAP_SRC_DIR / png_name
    webp_path = MAP_DIR / webp_name
    
    if not png_path.exists() and backup_png_path.exists():
        img = Image.open(backup_png_path)
    elif png_path.exists():
        img = Image.open(png_path)
        shutil.copy2(png_path, backup_png_path)
    else:
        raise FileNotFoundError(f"Peça {png_name} não encontrada!")
        
    png_size = backup_png_path.stat().st_size
    png_total += png_size
    
    # Salvar em WebP lossless (sem halo, preservação total de alpha e RGB)
    img.save(webp_path, format="WEBP", lossless=True, method=6)
    webp_size = webp_path.stat().st_size
    webp_total += webp_size
    print(f"{png_name} -> {webp_name}: {png_size} -> {webp_size} bytes ({webp_size/png_size*100:.1f}%)")
    
    # Remover o png de public/images/map se existir
    if png_path.exists():
        png_path.unlink()

print(f"\nTotal PNG: {png_total} bytes ({png_total/1024:.1f} KB)")
print(f"Total WebP: {webp_total} bytes ({webp_total/1024:.1f} KB) -> redução de {100 - (webp_total/png_total*100):.1f}%")

# Atualizar manifest.json
manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
for piece in manifest["pieces"]:
    piece["src"] = piece["src"].replace(".png", ".webp")

MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"manifest.json atualizado com referências .webp.")
