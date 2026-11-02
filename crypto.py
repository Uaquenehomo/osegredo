import base64
import os

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC


def _key(password: str, salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=200_000)
    return base64.urlsafe_b64encode(kdf.derive(password.encode()))


def encrypt(data: bytes, password: str) -> bytes:
    salt = os.urandom(16)
    return salt + Fernet(_key(password, salt)).encrypt(data)


def decrypt(blob: bytes, password: str) -> bytes:
    salt, token = blob[:16], blob[16:]
    return Fernet(_key(password, salt)).decrypt(token)