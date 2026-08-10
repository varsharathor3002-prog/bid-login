import base64
import hashlib
import json
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured


def _key():
    secret = os.environ.get("GEM_ENCRYPTION_KEY", "").strip()
    if not secret and settings.DEBUG:
        secret = settings.SECRET_KEY
    if not secret:
        raise ImproperlyConfigured("GEM_ENCRYPTION_KEY must be configured.")
    return hashlib.sha256(secret.encode("utf-8")).digest()


def encrypt_text(value):
    if value in (None, ""):
        return ""
    nonce = os.urandom(12)
    encrypted = AESGCM(_key()).encrypt(nonce, str(value).encode("utf-8"), None)
    return base64.urlsafe_b64encode(nonce + encrypted).decode("ascii")


def decrypt_text(value):
    if not value:
        return ""
    raw = base64.urlsafe_b64decode(value.encode("ascii"))
    return AESGCM(_key()).decrypt(raw[:12], raw[12:], None).decode("utf-8")


def encrypt_json(value):
    return encrypt_text(json.dumps(value, separators=(",", ":")))


def decrypt_json(value):
    if not value:
        return {}
    return json.loads(decrypt_text(value))
