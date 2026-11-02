from __future__ import annotations

import numpy as np
from PIL import Image

MAGIC = b"STG1"


def _bits(data: bytes) -> np.ndarray:
    return np.unpackbits(np.frombuffer(data, dtype=np.uint8))


def capacity_bytes(img: Image.Image) -> int:
    w, h = img.size
    return (w * h * 3) // 8 - 8  # 3 canais RGB, menos o cabeçalho de 8 bytes


def embed(img: Image.Image, payload: bytes, seed: int | None = None) -> Image.Image:
    img = img.convert("RGB")
    if len(payload) > capacity_bytes(img):
        raise ValueError("Mensagem demasiado grande para esta imagem.")

    header = MAGIC + len(payload).to_bytes(4, "big")
    bits = _bits(header + payload)

    arr = np.array(img, dtype=np.uint8).flatten()
    if seed is None:
        idx = np.arange(len(bits))
    else:  # modo espalhado: a chave decide a ordem dos bytes usados
        rng = np.random.default_rng(seed)
        idx = rng.permutation(len(arr))[: len(bits)]

    arr[idx] = (arr[idx] & 0xFE) | bits
    return Image.fromarray(arr.reshape(img.size[1], img.size[0], 3))


def extract(img: Image.Image, seed: int | None = None) -> bytes:
    arr = np.array(img.convert("RGB"), dtype=np.uint8).flatten()
    if seed is None:
        order = np.arange(len(arr))
    else:
        order = np.random.default_rng(seed).permutation(len(arr))

    def read(n_bytes: int, start_bit: int = 0) -> bytes:
        sel = order[start_bit : start_bit + n_bytes * 8]
        return np.packbits(arr[sel] & 1).tobytes()

    header = read(8)
    if header[:4] != MAGIC:
        raise ValueError("Nenhuma mensagem encontrada (ou chave errada).")
    length = int.from_bytes(header[4:8], "big")
    if length > capacity_bytes(img):
        raise ValueError("Cabeçalho inválido.")
    return read(length, 64)
