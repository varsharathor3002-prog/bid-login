import pandas as pd

import os
import django


os.environ.setdefault(
    "DJANGO_SETTINGS_MODULE",
    "config.settings"
)

django.setup()

from accounts.models import CatalogueProduct


file_path = "/var/www/bid-login/backend/Desktop_Product.xlsx"

df = pd.read_excel(file_path)

print("Total Rows:", len(df))

for _, row in df.iterrows():

    model_no = str(
        row.get("Model No", "")
    ).strip()

    if not model_no:
        continue

    CatalogueProduct.objects.update_or_create(

        model_no=model_no,

        defaults={

            "processor": str(
                row.get("Processor", "")
            ).strip(),

            "ram": str(
                row.get("RAM", "")
            ).strip(),

            "storage": str(
                row.get("Storage", "")
            ).strip(),

            "os": str(
                row.get("OS", "")
            ).strip(),

            "category": str(
                row.get("Category", "")
            ).strip(),

            "description": "",

        }

    )

print("✅ Excel data imported successfully")
