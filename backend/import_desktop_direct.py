import os
import django
import pandas as pd
def safe_str(val):
    if pd.isna(val):
        return ""
    return str(val).strip()

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from accounts.models import CatalogueProduct

file_path = "/var/www/bid-login/backend/Desktop_Product.xlsx"
df = pd.read_excel(file_path)
print("Total Rows:", len(df))

count = 0
for _, row in df.iterrows():
    model_no = str(row.get("model_no", "")).strip()
    if not model_no or model_no.lower() == "nan":
        continue

    CatalogueProduct.objects.update_or_create(
        model_no=model_no,
        defaults={
    "processor": safe_str(row.get("processor")),
    "ram": safe_str(row.get("ram")),
    "storage": safe_str(row.get("storage")),
    "os": safe_str(row.get("os")),
    "category": safe_str(row.get("category")),
    "description": safe_str(row.get("description")),
    "extra_specs": safe_str(row.get("extra_specs")),
    "image": safe_str(row.get("image")),
}
    )
    count += 1

print(f"✅ {count} products imported successfully")
