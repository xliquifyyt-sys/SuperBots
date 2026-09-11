"""Shared helpers for the art intake tools: backdrop keying and frame trimming."""
import cv2, numpy as np


def to_bgra(img):
    if img.ndim == 2: img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGRA)
    if img.shape[2] == 3: img = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
    return img


def key_backdrop(img, tol=18):
    """Remove a flat backdrop by flood-filling inward from the border, so light
    highlights inside the artwork survive. Images that already carry alpha are
    returned untouched."""
    img = to_bgra(img)
    h, w = img.shape[:2]
    bgr, alpha = img[:, :, :3], img[:, :, 3]
    if alpha.min() <= 250: return img
    corners = np.array([bgr[0, 0], bgr[0, w - 1], bgr[h - 1, 0], bgr[h - 1, w - 1]], dtype=np.int16)
    backdrop = np.median(corners, axis=0).astype(np.uint8)
    mask = np.zeros((h + 2, w + 2), np.uint8)
    work = bgr.copy()
    lo = up = (tol,) * 3
    for sx, sy in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]:
        if np.abs(work[sy, sx].astype(np.int16) - backdrop.astype(np.int16)).max() <= tol:
            cv2.floodFill(work, mask, (sx, sy), (0, 0, 0), lo, up, 4 | cv2.FLOODFILL_MASK_ONLY | cv2.FLOODFILL_FIXED_RANGE | (255 << 8))
    outside = mask[1:-1, 1:-1] > 0
    a = np.where(outside, 0, 255).astype(np.uint8)
    a = cv2.GaussianBlur(a, (3, 3), 0)
    a = np.where(a > 200, 255, np.where(a < 60, 0, a)).astype(np.uint8)
    return np.dstack([bgr, a])


def alpha_bbox(img, thresh=8):
    ys, xs = np.where(img[:, :, 3] > thresh)
    if len(xs) == 0: return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def split_grid(img, cols, rows):
    """Cut a cols x rows contact sheet into frames, row-major, dropping empty trailing cells.
    A sheet without alpha is keyed first so empty cells can be told from painted ones."""
    img = key_backdrop(img)
    h, w = img.shape[:2]
    fw, fh = w // cols, h // rows
    frames = []
    for r in range(rows):
        for c in range(cols):
            frames.append(img[r * fh:(r + 1) * fh, c * fw:(c + 1) * fw])
    while frames and alpha_bbox(frames[-1]) is None: frames.pop()
    return frames
