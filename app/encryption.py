"""
Message encryption utilities using AES encryption
"""
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend
import base64
import os

# Generate a key from a password (in production, use a secure key management system)
SECRET_KEY = os.getenv("ENCRYPTION_KEY", "your-encryption-key-change-in-production").encode()
SALT = os.getenv("ENCRYPTION_SALT", "your-salt-change-in-production").encode()

def get_encryption_key() -> bytes:
    """Generate encryption key from secret"""
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=SALT,
        iterations=100000,
        backend=default_backend()
    )
    key = base64.urlsafe_b64encode(kdf.derive(SECRET_KEY))
    return key

# Initialize Fernet cipher
_fernet = Fernet(get_encryption_key())

def encrypt_message(message: str) -> str:
    """Encrypt a message"""
    if not message:
        return message
    try:
        encrypted = _fernet.encrypt(message.encode())
        return base64.urlsafe_b64encode(encrypted).decode()
    except Exception as e:
        print(f"Encryption error: {e}")
        return message

def decrypt_message(encrypted_message: str) -> str:
    """Decrypt a message"""
    if not encrypted_message:
        return encrypted_message
    try:
        decoded = base64.urlsafe_b64decode(encrypted_message.encode())
        decrypted = _fernet.decrypt(decoded)
        return decrypted.decode()
    except Exception as e:
        print(f"Decryption error: {e}")
        return encrypted_message

