"""Corre a app localmente, sem o Vercel.
Uso:  python run_local.py   e abra  http://localhost:5000
"""
import os
import sys

RAIZ = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, RAIZ)
sys.path.insert(0, os.path.join(RAIZ, "api"))

from flask import send_from_directory
from index import app  # api/index.py

PUBLIC = os.path.join(RAIZ, "public")


@app.get("/")
def home():
    return send_from_directory(PUBLIC, "index.html")


@app.get("/<path:nome>")
def estaticos(nome):
    return send_from_directory(PUBLIC, nome)


if __name__ == "__main__":
    app.run(debug=True, port=5000)