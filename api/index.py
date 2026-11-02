import hashlib
import io
import os
import sys

# garante que a pasta stego/ é encontrada no Vercel
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask, jsonify, request, send_file
from PIL import Image

from stego import analysis, crypto, lsb

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 4 * 1024 * 1024  # 4 MB


def seed_from(password: str) -> int:
    return int.from_bytes(hashlib.sha256(password.encode()).digest()[:8], "big")


def png_response(img: Image.Image, **headers):
    buf = io.BytesIO()
    img.save(buf, "PNG")
    buf.seek(0)
    resp = send_file(buf, mimetype="image/png", download_name="segredo.png")
    for k, v in headers.items():
        resp.headers[k] = v
    return resp


def open_image(field: str = "image") -> Image.Image:
    if field not in request.files:
        raise ValueError("Nenhuma imagem foi enviada.")
    try:
        return Image.open(request.files[field])
    except Exception:
        raise ValueError("Ficheiro de imagem inválido.")


@app.errorhandler(413)
def too_large(_):
    return jsonify(error="A imagem é grande demais."), 413


@app.post("/api/capacity")
def capacity():
    try:
        img = open_image()
        return jsonify(bytes=lsb.capacity_bytes(img))
    except ValueError as e:
        return jsonify(error=str(e)), 400


@app.post("/api/hide")
def hide():
    try:
        img = open_image().convert("RGB")
        pw = request.form.get("password", "")
        raw = request.form.get("message", "").encode("utf-8")
        if not raw:
            raise ValueError("Escreva uma mensagem.")

        payload = crypto.encrypt(raw, pw) if pw else raw
        out = lsb.embed(img, payload, seed_from(pw) if pw else None)

        valor = analysis.psnr(img, out)
        psnr_txt = "inf" if valor == float("inf") else f"{valor:.2f}"
        return png_response(out, **{"X-PSNR": psnr_txt})
    except ValueError as e:
        return jsonify(error=str(e)), 400


@app.post("/api/reveal")
def reveal():
    try:
        img = open_image()
        pw = request.form.get("password", "")
        data = lsb.extract(img, seed_from(pw) if pw else None)
        if pw:
            data = crypto.decrypt(data, pw)
        return jsonify(message=data.decode("utf-8"))
    except Exception:
        return jsonify(error="Nada encontrado ou chave incorrecta."), 400


@app.post("/api/forensic")
def forensic():
    try:
        return png_response(analysis.lsb_map(open_image()))
    except ValueError as e:
        return jsonify(error=str(e)), 400
