import os
import shutil
import subprocess
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
FONTS_DIR = PROJECT_ROOT / "public" / "fonts"
FONTS_SRC_DIR = PROJECT_ROOT / "fonts-src"

FONTS_SRC_DIR.mkdir(parents=True, exist_ok=True)

# Lista de fontes requeridas
FONTS = [
    "SquidBoy-Thin.otf",
    "aquiline-two-regular.ttf",
    "estrella-early.otf",
    "drowner-regular.otf",
]

UNICODES = (
    "U+0020-007E,U+00A0-00FF,U+0100-017F,U+0192,U+02C6,U+02DC,"
    "U+2000-206F,U+20A0-20CF,U+2122,U+2219,U+E000-E011,U+F000-F01A"
)

for font_name in FONTS:
    # Origem pode estar em public/fonts ou já em fonts-src
    src_in_public = FONTS_DIR / font_name
    src_in_fonts_src = FONTS_SRC_DIR / font_name

    if src_in_public.exists() and not src_in_fonts_src.exists():
        shutil.copy2(src_in_public, src_in_fonts_src)

    source_font = src_in_fonts_src if src_in_fonts_src.exists() else src_in_public
    if not source_font.exists():
        raise FileNotFoundError(f"Fonte não encontrada: {font_name}")

    stem = source_font.stem
    output_woff2 = FONTS_DIR / f"{stem}.woff2"

    cmd = [
        "pyftsubset",
        str(source_font),
        f"--output-file={output_woff2}",
        "--flavor=woff2",
        f"--unicodes={UNICODES}",
        "--layout-features=*",
    ]
    print(f"Convertendo {font_name} -> {output_woff2.name}...")
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"Erro ao converter {font_name}: {res.stderr}")

    orig_size = source_font.stat().st_size
    woff2_size = output_woff2.stat().st_size
    print(f"  OK: {orig_size} bytes -> {woff2_size} bytes ({woff2_size/orig_size*100:.1f}%)")

    # Mover original para fora de public se ainda estiver lá
    if src_in_public.exists():
        if not src_in_fonts_src.exists():
            shutil.move(src_in_public, src_in_fonts_src)
        else:
            src_in_public.unlink()

print("Todas as fontes convertidas para .woff2 e originais movidos para fonts-src/.")
