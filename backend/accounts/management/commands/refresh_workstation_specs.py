"""Re-read the Workstation fields (RAM, GPU, ...) from the GeM specs already
saved on each scanned Workstation product, and update worksation.xlsx — so a
fix to the GeM label matching applies without scanning GeM again."""
from django.core.management.base import BaseCommand

from accounts.models import CatalogueProduct
from accounts.views.GemProductSpecs import _update_workstation_sheet, _workstation_directory_fields

# Keys the scan adds on top of GeM's own labels; they are rebuilt, not read.
DERIVED_KEYS = {
    "Computer Type", "Processor", "Motherboard", "RAM", "SSD", "HDD", "Storage",
    "Graphics Card", "Graphic Card Make and Model", "Operating System",
    "Factory Pre-loaded Operating System", "Monitor", "Screen Size", "Power Supply", "_gem_sections",
}


class Command(BaseCommand):
    help = "Rebuild scanned Workstation products' fields from their saved GeM specs."

    def handle(self, *args, **options):
        items = []
        products = CatalogueProduct.objects.filter(category__iexact="workstation").exclude(gem_product_id="")
        for product in products:
            saved = product.extra_specs if isinstance(product.extra_specs, dict) else {}
            pairs = [[label, value] for label, value in saved.items() if label not in DERIVED_KEYS]
            specs, summary = _workstation_directory_fields(pairs)
            if saved.get("_gem_sections"):
                specs["_gem_sections"] = saved["_gem_sections"]
            product.extra_specs = specs
            for field, value in summary.items():
                if value:
                    setattr(product, field, value)
            product.save()
            items.append({"model_no": product.model_no, "pairs": pairs})
        _update_workstation_sheet(items)
        self.stdout.write(self.style.SUCCESS(f"{len(items)} Workstation products refreshed."))
