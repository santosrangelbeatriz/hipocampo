"""Fatia o mapa de memória original em peças transparentes e gera o manifest.

O script usa apenas a imagem versionada em ``pagina2/image copy.png``. A
segmentação é determinística para que os sprites e a imagem de conferência
possam ser regenerados sem redesenhar nenhum fragmento.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
from scipy.spatial import ConvexHull

try:
    import cv2
except ImportError:  # O fatiamento continua funcional sem a restauração opcional.
    cv2 = None


PROJECT_ROOT = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
SOURCE_PATH = REPOSITORY_ROOT / "pagina2" / "image copy.png"
OUTPUT_DIR = PROJECT_ROOT / "public" / "images" / "map"
VERIFICATION_DIR = PROJECT_ROOT / "artifacts" / "memory-map"

CORNER_SAMPLE = 40
FOREGROUND_THRESHOLD = 18.0
OPENING_SIZE = 6
MIN_COMPONENT_AREA = 150
PIECE_GROW_PX = 4
ANCHOR_SEARCH_PX = 36
ALPHA_FEATHER_SIGMA = 0.65

# Ordem visual das 32 peças, de cima para baixo e da esquerda para a direita.
# A lista só classifica os recortes; nenhum conteúdo visual é redesenhado.
PIECE_TYPES = [
    "mao", "mao", "mao", "pessoa", "pessoa", "mao", "mao", "mao",
    "pessoa", "mao", "objeto", "pessoa", "objeto", "objeto", "pessoa",
    "casa", "pessoa", "mao", "mao", "pessoa", "pessoa", "objeto", "mao",
    "pessoa", "pessoa", "objeto", "pessoa", "mao", "mao", "mao", "mao",
    "objeto",
]


@dataclass
class Piece:
    seed: np.ndarray
    mask: np.ndarray
    kind: str = "objeto"
    identifier: str = ""
    anchor_piece: tuple[float, float] = (0.0, 0.0)
    anchor_house: tuple[float, float] = (0.0, 0.0)
    crop: tuple[int, int, int, int] = (0, 0, 0, 0)

    @property
    def center(self) -> tuple[float, float]:
        ys, xs = np.where(self.mask)
        return float(xs.mean()), float(ys.mean())


def sample_background(rgb: np.ndarray) -> np.ndarray:
    size = CORNER_SAMPLE
    corners = np.concatenate(
        (
            rgb[:size, :size].reshape(-1, 3),
            rgb[:size, -size:].reshape(-1, 3),
            rgb[-size:, :size].reshape(-1, 3),
            rgb[-size:, -size:].reshape(-1, 3),
        )
    )
    return np.median(corners, axis=0)


def component_seeds(foreground: np.ndarray) -> list[np.ndarray]:
    structure = np.ones((OPENING_SIZE, OPENING_SIZE), dtype=bool)
    opened = ndi.binary_opening(foreground, structure=structure)
    labels, _ = ndi.label(opened, structure=np.ones((3, 3), dtype=np.uint8))
    areas = np.bincount(labels.ravel())
    label_ids = [index for index in range(1, len(areas)) if areas[index] > MIN_COMPONENT_AREA]

    seeds = [labels == label_id for label_id in label_ids]
    seeds.sort(key=lambda mask: (int(np.where(mask)[0].min()), int(np.where(mask)[1].min())))

    if len(seeds) != len(PIECE_TYPES):
        raise RuntimeError(
            f"A segmentação encontrou {len(seeds)} peças; eram esperadas {len(PIECE_TYPES)}. "
            "Revise o limiar antes de publicar os assets."
        )

    return seeds


def grow_piece_mask(seed: np.ndarray, foreground: np.ndarray) -> np.ndarray:
    expanded = ndi.binary_dilation(seed, structure=np.ones((3, 3), dtype=bool), iterations=PIECE_GROW_PX)
    candidate = expanded & foreground
    cleaned = ndi.binary_opening(candidate, structure=np.ones((3, 3), dtype=bool)) | seed
    return ndi.binary_fill_holes(cleaned)


def build_house_mask(seed: np.ndarray) -> np.ndarray:
    """Fecha o volume arquitetônico sem incorporar os conectores externos."""
    core = ndi.binary_opening(seed, structure=np.ones((9, 9), dtype=bool))
    row_counts = core.sum(axis=1)
    body_start = next(
        (row for row in range(len(row_counts) - 5) if np.all(row_counts[row : row + 5] > 25)),
        int(np.where(seed)[0].min()),
    )

    grid_y = np.indices(core.shape)[0]
    ys, xs = np.where(core & (grid_y >= body_start))
    points = np.column_stack((xs, ys))
    hull = ConvexHull(points)
    polygon = np.round(points[hull.vertices]).astype(np.int32)

    mask_image = Image.new("L", (seed.shape[1], seed.shape[0]), 0)
    ImageDraw.Draw(mask_image).polygon([tuple(point) for point in polygon], fill=255)
    body = np.asarray(mask_image) > 0

    # Reincorpora chaminés e ornamentos próximos, mas não os fios finos.
    nearby = ndi.distance_transform_edt(~body) <= 14
    protrusions = ndi.binary_dilation(core, structure=np.ones((3, 3), dtype=bool), iterations=2) & nearby
    return ndi.binary_closing(body | protrusions, structure=np.ones((5, 5), dtype=bool))


def nearest_mask_point(mask: np.ndarray, target_x: float, target_y: float) -> tuple[float, float]:
    ys, xs = np.where(mask)
    index = int(np.argmin((xs - target_x) ** 2 + (ys - target_y) ** 2))
    return float(xs[index]), float(ys[index])


def find_piece_anchor(
    piece: Piece,
    line_pixels: np.ndarray,
    house_center: tuple[float, float],
) -> tuple[float, float]:
    center_x, center_y = piece.center
    to_house_x = house_center[0] - center_x
    to_house_y = house_center[1] - center_y
    to_house_length = max(1.0, math.hypot(to_house_x, to_house_y))

    distance = ndi.distance_transform_edt(~piece.mask)
    ring = (distance >= 3) & (distance <= ANCHOR_SEARCH_PX)
    ys, xs = np.where(line_pixels & ring)
    if len(xs):
        vector_x = xs - center_x
        vector_y = ys - center_y
        forward = vector_x * to_house_x + vector_y * to_house_y > 0
        perpendicular = np.abs(vector_x * to_house_y - vector_y * to_house_x) / to_house_length
        aligned = forward & (perpendicular <= 5.0)
        if np.any(aligned):
            xs = xs[aligned]
            ys = ys[aligned]
        elif np.any(forward):
            xs = xs[forward]
            ys = ys[forward]

        touch_x = float(np.median(xs))
        touch_y = float(np.median(ys))
        return nearest_mask_point(piece.mask, touch_x, touch_y)

    return nearest_mask_point(piece.mask, house_center[0], house_center[1])


def make_alpha(mask: np.ndarray) -> np.ndarray:
    eroded = ndi.binary_erosion(mask, structure=np.ones((3, 3), dtype=bool), iterations=1)
    feathered = ndi.gaussian_filter(eroded.astype(np.float32), sigma=ALPHA_FEATHER_SIGMA)
    return np.clip(np.round(feathered * 255), 0, 255).astype(np.uint8)


def inpaint_house_lines(
    rgb: np.ndarray,
    house: Piece,
) -> np.ndarray:
    if cv2 is None:
        return rgb

    grayscale = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    edges = cv2.Canny(grayscale, 35, 100)
    detected = cv2.HoughLinesP(
        edges,
        1,
        np.pi / 720,
        threshold=35,
        minLineLength=140,
        maxLineGap=14,
    )
    if detected is None:
        return rgb

    strokes = np.zeros(house.mask.shape, dtype=np.uint8)
    for x0, y0, x1, y1 in np.asarray(detected).reshape(-1, 4):
        segment = np.zeros(house.mask.shape, dtype=np.uint8)
        cv2.line(segment, (int(x0), int(y0)), (int(x1), int(y1)), 1, 1)
        inside = int(np.count_nonzero((segment > 0) & house.mask))
        outside = int(np.count_nonzero((segment > 0) & ~house.mask))
        if inside >= 3 and outside >= 60:
            cv2.line(strokes, (int(x0), int(y0)), (int(x1), int(y1)), 255, 1)

    removal = (strokes > 0) & house.mask & (grayscale < 145)
    removal = cv2.dilate(removal.astype(np.uint8), np.ones((2, 2), dtype=np.uint8), iterations=1)
    removal = (removal > 0) & house.mask
    if not np.any(removal):
        return rgb

    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    restored = cv2.inpaint(bgr, (removal.astype(np.uint8) * 255), 3, cv2.INPAINT_TELEA)
    return cv2.cvtColor(restored, cv2.COLOR_BGR2RGB)


def color_hex(color: np.ndarray) -> str:
    values = [int(round(value)) for value in color]
    return "#" + "".join(f"{value:02x}" for value in values)


def percent(value: float, total: int) -> float:
    return round(value / total * 100, 5)


def main() -> None:
    if not SOURCE_PATH.exists():
        raise FileNotFoundError(f"Imagem de origem não encontrada: {SOURCE_PATH}")

    source_image = Image.open(SOURCE_PATH).convert("RGB")
    rgb = np.asarray(source_image)
    height, width = rgb.shape[:2]
    background = sample_background(rgb)
    foreground = np.linalg.norm(rgb.astype(np.float32) - background, axis=2) > FOREGROUND_THRESHOLD

    seeds = component_seeds(foreground)
    pieces = [
        Piece(
            seed=seed,
            mask=build_house_mask(seed) if kind == "casa" else grow_piece_mask(seed, foreground),
            kind=kind,
            identifier=f"peca-{index:02d}",
        )
        for index, (seed, kind) in enumerate(zip(seeds, PIECE_TYPES), start=1)
    ]
    house = next(piece for piece in pieces if piece.kind == "casa")

    piece_union = np.logical_or.reduce([piece.mask for piece in pieces])
    away_from_pieces = ~ndi.binary_dilation(piece_union, structure=np.ones((3, 3), dtype=bool), iterations=3)
    grayscale = np.asarray(source_image.convert("L"))
    line_pixels = foreground & away_from_pieces & (grayscale < 165)

    line_sample = rgb[line_pixels]
    if not len(line_sample):
        raise RuntimeError("Não foi possível amostrar a cor das linhas.")
    line_color = np.median(line_sample, axis=0)
    line_distance = ndi.distance_transform_edt(line_pixels)
    widths = line_distance[line_pixels] * 2
    line_width = int(np.clip(round(float(np.median(widths))), 1, 3))

    for piece in pieces:
        if piece is house:
            piece.anchor_piece = house.center
            piece.anchor_house = house.center
            continue
        piece.anchor_piece = find_piece_anchor(piece, line_pixels, house.center)
        piece.anchor_house = nearest_mask_point(house.mask, *piece.anchor_piece)

    house_rgb = inpaint_house_lines(rgb, house)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for stale in OUTPUT_DIR.glob("peca-*.png"):
        stale.unlink()

    manifest_pieces = []
    rendered = []
    for piece in pieces:
        alpha = make_alpha(piece.mask)
        ys, xs = np.where(alpha > 1)
        padding = 2
        x0 = max(0, int(xs.min()) - padding)
        y0 = max(0, int(ys.min()) - padding)
        x1 = min(width, int(xs.max()) + padding + 1)
        y1 = min(height, int(ys.max()) + padding + 1)
        piece.crop = (x0, y0, x1, y1)

        pixels = house_rgb if piece is house else rgb
        rgba = np.dstack((pixels[y0:y1, x0:x1], alpha[y0:y1, x0:x1]))
        output_path = OUTPUT_DIR / f"{piece.identifier}.png"
        Image.fromarray(rgba, mode="RGBA").save(output_path, optimize=True)
        rendered.append((piece, Image.open(output_path).convert("RGBA")))

        center_x, center_y = piece.center
        manifest_pieces.append(
            {
                "id": piece.identifier,
                "tipo": piece.kind,
                "src": f"/images/map/{piece.identifier}.png",
                "x": x0,
                "y": y0,
                "w": x1 - x0,
                "h": y1 - y0,
                "center": {"xPct": percent(center_x, width), "yPct": percent(center_y, height)},
                "anchorPiece": {
                    "xPct": percent(piece.anchor_piece[0], width),
                    "yPct": percent(piece.anchor_piece[1], height),
                },
                "anchorHouse": {
                    "xPct": percent(piece.anchor_house[0], width),
                    "yPct": percent(piece.anchor_house[1], height),
                },
            }
        )

    manifest = {
        "source": "pagina2/image copy.png",
        "width": width,
        "height": height,
        "aspectRatio": round(width / height, 8),
        "backgroundColor": color_hex(background),
        "lineColor": color_hex(line_color),
        "lineWidthPct": round(line_width / width * 100, 5),
        "pieces": manifest_pieces,
    }
    (OUTPUT_DIR / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    verification = Image.new("RGBA", (width, height), (*[int(round(v)) for v in background], 255))
    verification_draw = ImageDraw.Draw(verification)
    for piece in pieces:
        if piece is house:
            continue
        verification_draw.line(
            (piece.anchor_house[0], piece.anchor_house[1], piece.anchor_piece[0], piece.anchor_piece[1]),
            fill=(*[int(round(v)) for v in line_color], 255),
            width=line_width,
        )
    for piece, sprite in rendered:
        verification.alpha_composite(sprite, dest=(piece.crop[0], piece.crop[1]))
    VERIFICATION_DIR.mkdir(parents=True, exist_ok=True)
    verification_path = VERIFICATION_DIR / "recomposicao.png"
    verification.convert("RGB").save(verification_path, optimize=True)

    print(f"Mapa fatiado: {len(pieces)} peças em {OUTPUT_DIR}")
    print(f"Casa: {house.identifier}; linha: {color_hex(line_color)} / {manifest['lineWidthPct']}%")
    print(f"Conferência: {verification_path}")


if __name__ == "__main__":
    main()
