"""Loads aio_specs.xlsx into CatalogueProduct (category="aio") so the
Analyser's "Find Model" feature can match AIO bids against it, the same way
Desktop_Product.xlsx feeds Desktop's catalogue matching."""

import os
import re
import django
import pandas as pd


def safe_str(val):
    if pd.isna(val):
        return ""
    return str(val).strip()


def clean_processor(val):
    # The matching engine's text-cleaner deletes hyphens outright (it doesn't
    # turn them into spaces), so "i5-12400" would corrupt into "i512400" and
    # stop lining up with the bid-side catalogue's "i5 12400" style names.
    # Normalizing to spaces here keeps the two sides comparable.
    text = safe_str(val)
    return re.sub(r"(?<=[A-Za-z0-9])-(?=\d)", " ", text)


def clean_screen_size(val):
    # Same hyphen problem for numeric ranges like 22.87-24.8" — deleting the
    # hyphen fuses the two numbers into one. Spell the range out instead.
    text = safe_str(val)
    nums = re.findall(r"\d+(?:\.\d+)?", text)
    if len(nums) >= 2:
        return f"{nums[0]} to {nums[1]} inch"
    return text


os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from accounts.models import CatalogueProduct

file_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "aio_specs.xlsx")
df = pd.read_excel(file_path)
print("Total Rows:", len(df))

count = 0
for _, row in df.iterrows():
    model_no = safe_str(row.get("model_no"))
    if not model_no or model_no.lower() == "nan":
        continue

    CatalogueProduct.objects.update_or_create(
        model_no=model_no,
        defaults={
            "processor": clean_processor(row.get("processor")),
            "ram": safe_str(row.get("ram")),
            "storage": safe_str(row.get("ssd")),
            "os": safe_str(row.get("os")),
            "category": "aio",
            "description": "AIO PC",
            "extra_specs": {
                "Screen Size": clean_screen_size(row.get("monitor")),
                "Motherboard Ports": safe_str(row.get("motherboard")),
                "Keyboard Mouse": safe_str(row.get("keyboard_mouse")),
                "WiFi Bluetooth": safe_str(row.get("wifi_bluetooth")),
            },
        },
    )
    count += 1

print(f"AIO products imported successfully: {count}")
