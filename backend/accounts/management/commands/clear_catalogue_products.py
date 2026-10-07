"""Empty the product directory so it can be fetched again from GeM (the
extension's Product Scan).

Only Printer products are kept; everything else, models created from bids
included, is removed. Without --confirm only the counts are
shown. With --confirm the removed products are first saved to
catalogue_backups/catalogue_deleted_<time>.json (restore with
`python manage.py loaddata <file>`), Desktop_Product.xlsx is backed up and
rewritten with the kept Desktop products, then the rest are deleted.
"""
import os
import shutil
from collections import Counter
from datetime import datetime

import openpyxl
from django.conf import settings
from django.core import serializers
from django.core.management.base import BaseCommand
from django.db import transaction

from accounts import desktop_excel
from accounts.models import CatalogueProduct

BACKUP_DIR = "catalogue_backups"


def is_kept(product):
    return (product.category or "").strip().lower() == "printer"


class Command(BaseCommand):
    help = "Delete every directory product except Printer."

    def add_arguments(self, parser):
        parser.add_argument("--confirm", action="store_true", help="Actually delete (otherwise only counts are shown).")

    def handle(self, *args, **options):
        products = list(CatalogueProduct.objects.all())
        kept = [p for p in products if is_kept(p)]
        removed = [p for p in products if not is_kept(p)]
        by_category = Counter((p.category or "Desktop") for p in removed)
        self.stdout.write(f"Total {len(products)}: delete {len(removed)} {dict(by_category)}, keep {len(kept)} "
                          f"{dict(Counter((p.category or 'Desktop') for p in kept))}")
        if not options["confirm"]:
            self.stdout.write("Nothing deleted. Run again with --confirm to delete.")
            return

        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        backup_dir = os.path.join(settings.BASE_DIR, BACKUP_DIR)
        os.makedirs(backup_dir, exist_ok=True)
        json_path = os.path.join(backup_dir, f"catalogue_deleted_{stamp}.json")
        with open(json_path, "w", encoding="utf-8") as handle:
            serializers.serialize("json", removed, stream=handle)

        excel = desktop_excel.excel_path()
        with desktop_excel._file_lock(excel):
            if os.path.exists(excel):
                shutil.copy2(excel, os.path.join(backup_dir, f"Desktop_Product_{stamp}.xlsx"))
            with desktop_excel.paused(), transaction.atomic():
                CatalogueProduct.objects.filter(pk__in=[p.pk for p in removed]).delete()
            # Rewrite the sheet with the kept Desktop products only, or the
            # next directory load would import the deleted rows again.
            workbook = openpyxl.Workbook()
            sheet = workbook.active
            sheet.title = "Desktop Products"
            headers = desktop_excel._readable_headers()
            sheet.append(headers)
            for product in kept:
                if desktop_excel.is_desktop(product):
                    desktop_excel._write_row(sheet, headers, sheet.max_row + 1, desktop_excel._row_values(product))
            desktop_excel._save_workbook(workbook, excel)
            with open(desktop_excel._baseline_marker(), "w", encoding="utf-8") as marker:
                marker.write(datetime.now().isoformat())
            desktop_excel._remember_mtime(excel)

        self.stdout.write(self.style.SUCCESS(
            f"Deleted {len(removed)} products. Backup: {json_path} (restore: python manage.py loaddata <file>)."
        ))
