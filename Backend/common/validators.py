"""
EasyCart Input Validation Module.
Provides robust validation for customer checkout data, quantities, phone numbers,
postal codes, and file uploads.
"""
import re
import os
from typing import Tuple, Optional

EMAIL_REGEX = re.compile(r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$')
PINCODE_REGEX = re.compile(r'^[0-9]{6}$')  # Indian 6-digit postal PIN

ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp', 'gif'}
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB

def validate_email_format(email: str) -> bool:
    """Check if the given string is a valid email address."""
    if not email or not isinstance(email, str):
        return False
    email = email.strip()
    return len(email) <= 254 and bool(EMAIL_REGEX.match(email))

def normalize_phone_number(phone: str) -> Optional[str]:
    """Normalize and validate an Indian mobile number to a clean 10-digit string."""
    if not phone or not isinstance(phone, str):
        return None
    # Strip spaces, dashes, dots, parentheses, and plus sign
    cleaned = re.sub(r'[\s\-().+]', '', phone.strip())
    # Handle +91 / 91 country code prefix for 12-digit input
    if cleaned.startswith('91') and len(cleaned) == 12:
        cleaned = cleaned[2:]
    # Handle leading 0 trunk prefix for 11-digit input
    elif cleaned.startswith('0') and len(cleaned) == 11:
        cleaned = cleaned[1:]

    # Must be exactly 10 digits starting with 6, 7, 8, or 9
    if len(cleaned) == 10 and cleaned[0] in '6789' and cleaned.isdigit():
        return cleaned
    return None

def validate_phone_format(phone: str) -> bool:
    """Check if the phone number is a valid 10-digit Indian mobile number."""
    return normalize_phone_number(phone) is not None

def validate_postal_code(pin: str) -> bool:
    """Validate 6-digit Indian PIN or alphanumeric postal code."""
    if not pin or not isinstance(pin, str):
        return False
    cleaned = pin.strip()
    return bool(PINCODE_REGEX.match(cleaned))

def validate_delivery_info(info: dict) -> Tuple[bool, Optional[str]]:
    """Validate required delivery contact details for checkout."""
    if not isinstance(info, dict):
        return False, "Delivery details must be a valid object."

    if not info.get('postal_code') and info.get('pincode'):
        info['postal_code'] = info['pincode']

    # Auto-infer Indian state if city is known or provide graceful fallback
    if not info.get('state'):
        city = str(info.get('city') or '').strip().lower()
        city_state_map = {
            'bengaluru': 'Karnataka',
            'bangalore': 'Karnataka',
            'mumbai': 'Maharashtra',
            'delhi': 'Delhi',
            'new delhi': 'Delhi',
            'kolkata': 'West Bengal',
            'chennai': 'Tamil Nadu',
            'hyderabad': 'Telangana',
            'pune': 'Maharashtra',
            'ahmedabad': 'Gujarat',
            'jaipur': 'Rajasthan',
            'surat': 'Gujarat',
            'lucknow': 'Uttar Pradesh',
            'chandigarh': 'Chandigarh',
            'noida': 'Uttar Pradesh',
            'gurugram': 'Haryana',
            'gurgaon': 'Haryana',
            'kochi': 'Kerala'
        }
        if city in city_state_map:
            info['state'] = city_state_map[city]
        elif city:
            info['state'] = 'India'

    fields = ['name', 'email', 'phone', 'address', 'city', 'state', 'postal_code']
    for f in fields:
        val = info.get(f)
        if not val or not str(val).strip():
            return False, f"Please provide your {f.replace('_', ' ').capitalize()}."

    if not validate_email_format(info['email']):
        return False, "Please enter a valid email address."

    normalized_phone = normalize_phone_number(info['phone'])
    if not normalized_phone:
        return False, "Please enter a valid 10-digit mobile number."
    info['phone'] = normalized_phone

    if not validate_postal_code(info['postal_code']):
        return False, "Please enter a valid 6-digit postal PIN code."

    return True, None

def validate_cart_quantity(qty) -> Tuple[bool, int, Optional[str]]:
    """Validate quantity: must be an integer between 1 and 100."""
    try:
        qty_int = int(qty)
    except (TypeError, ValueError):
        return False, 0, "Item quantity must be a valid number."

    if qty_int <= 0:
        return False, 0, "Item quantity must be greater than zero."

    if qty_int > 100:
        return False, 0, "Maximum allowable quantity per item is 100 units."

    return True, qty_int, None

def validate_image_file(file_storage) -> Tuple[bool, Optional[str], Optional[str]]:
    """Validate file extension and genuine binary image header magic bytes.
    
    Returns (is_valid, extension, error_message).
    """
    if not file_storage or not file_storage.filename:
        return False, None, "No file provided."

    filename = file_storage.filename
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        return False, None, f"Unsupported file type '.{ext}'. Allowed: PNG, JPG, JPEG, WebP, GIF."

    # Size check
    file_storage.seek(0, os.SEEK_END)
    size = file_storage.tell()
    file_storage.seek(0)
    if size > MAX_IMAGE_SIZE:
        return False, None, f"File size exceeds maximum limit of 5MB ({size // (1024*1024)}MB)."

    # Binary Header Signature Verification (Magic Bytes)
    header = file_storage.read(32)
    file_storage.seek(0)

    is_valid = False
    if ext == 'png' and header.startswith(b'\x89PNG\r\n\x1a\n'):
        is_valid = True
    elif ext in ('jpg', 'jpeg') and header.startswith(b'\xff\xd8\xff'):
        is_valid = True
    elif ext == 'gif' and (header.startswith(b'GIF87a') or header.startswith(b'GIF89a')):
        is_valid = True
    elif ext == 'webp' and header[:4] == b'RIFF' and header[8:12] == b'WEBP':
        is_valid = True

    if not is_valid:
        return False, None, f"File header does not match declared .{ext} image format."

    return True, ext, None
