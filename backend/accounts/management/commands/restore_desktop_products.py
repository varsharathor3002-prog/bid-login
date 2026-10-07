import glob
import os

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from accounts import desktop_excel


class Command(BaseCommand):
    help = (
        "Restore old Desktop products from a Desktop_Product.old-*.xlsx backup "
        "(made by the GeM Market scan). Without a file, lists the backups."
    )

    def add_arguments(self, parser):
        parser.add_argument("backup", nargs="?", help="Backup file name or path")
        parser.add_argument("--model", action="append", dest="models", help="Restore only this model (repeatable)")

    def handle(self, *args, backup=None, models=None, **options):
        folder = settings.BASE_DIR
        if not backup:
            files = sorted(glob.glob(os.path.join(folder, "Desktop_Product.old-*.xlsx")))
            if not files:
                self.stdout.write("No backups found.")
            for path in files:
                self.stdout.write(os.path.basename(path))
            return
        path = backup if os.path.isabs(backup) else os.path.join(folder, backup)
        if not os.path.exists(path):
            raise CommandError(f"{path} not found.")
        restored = desktop_excel.restore_from_backup(path, models)
        self.stdout.write(self.style.SUCCESS(
            f"{len(restored)} product(s) restored to the directory and Desktop_Product.xlsx."
        ))
