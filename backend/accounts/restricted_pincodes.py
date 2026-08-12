"""
Delivery-restricted pincodes.

Sourced from a merged district-wise PIN code list covering Arunachal Pradesh,
Assam, Jammu & Kashmir, Kerala, Ladakh, Manipur, Meghalaya, Mizoram, Nagaland,
Sikkim and Tripura. Bids should not be created/saved with a Buyer Pincode or
Installation Location Pincode that falls in this list — supply is not
available to these locations.

Data file: restricted_pincodes_data.json (pincode -> {states, districts}),
generated from the source PDF. To add/remove locations, edit that JSON file.
"""
import json
from pathlib import Path
from functools import lru_cache

_DATA_PATH = Path(__file__).resolve().parent / "restricted_pincodes_data.json"


@lru_cache(maxsize=1)
def _load():
    try:
        return json.loads(_DATA_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def is_restricted_pincode(pincode):
    pincode = str(pincode or "").strip()
    if not pincode:
        return False
    return pincode in _load()


def restricted_pincode_info(pincode):
    """Returns {"states": [...], "districts": [...]} or None if not restricted."""
    return _load().get(str(pincode or "").strip())


def restriction_message(pincode):
    info = restricted_pincode_info(pincode)
    if not info:
        return ""
    states = ", ".join(info.get("states") or [])
    return (
        f"Supply is not available to pincode {pincode} ({states}). "
        f"This location is restricted."
    )
