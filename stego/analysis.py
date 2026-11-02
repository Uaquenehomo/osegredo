import numpy as np
from PIL import Image


def _rgb(img: Image.Image) -> np.ndarray:
    return np.array(img.convert("RGB"), dtype=np.float64)


def mse(original: Image.Image, modificada: Image.Image) -> float:
    """Erro quadrático médio entre duas imagens do mesmo tamanho."""
    a, b = _rgb(original), _rgb(modificada)
    if a.shape != b.shape:
        raise ValueError("As imagens têm tamanhos diferentes.")
    return float(np.mean((a - b) ** 2))


def psnr(original: Image.Image, modificada: Image.Image) -> float:
    """Relação sinal-ruído de pico, em dB. Acima de ~50 dB a diferença é invisível.
    Devolve infinito se as imagens forem idênticas."""
    erro = mse(original, modificada)
    if erro == 0:
        return float("inf")
    return float(10 * np.log10(255.0 ** 2 / erro))


def lsb_map(img: Image.Image) -> Image.Image:
    """Mostra só o bit menos significativo de cada canal, amplificado a preto e branco.
    Numa foto normal vê-se ruído; numa imagem com mensagem, o início fica regular."""
    arr = np.array(img.convert("RGB"), dtype=np.uint8)
    return Image.fromarray((arr & 1) * 255)


def lsb_ones_ratio(img: Image.Image, n_bits: int = 4096) -> float:
    """Proporção de bits a 1 nos primeiros n_bits. Perto de 0,5 em dados cifrados;
    pode ser muito diferente disso numa imagem limpa e muito lisa."""
    arr = np.array(img.convert("RGB"), dtype=np.uint8).flatten()[:n_bits]
    return float((arr & 1).mean())