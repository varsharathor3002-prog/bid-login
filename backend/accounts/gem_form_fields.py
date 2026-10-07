"""GeM "Add New Offering" form values for AIO and Toner bids.

The extension fills the GeM form label by label, so every value here uses the
exact label and option wording of GeM's own form. Both come from acxxel's real
GeM listings that Product Scan saved into the product directory
(extra_specs["_gem_sections"]); nothing here is typed in by hand.

A bid knows only part of the form (processor, RAM, screen size ...). The rest
(panel, power supply, operating temperature ...) is taken from the acxxel GeM
listing that matches the bid best, so the offering repeats what acxxel already
declares on GeM. The extension never submits: the analyser reviews and clicks
GeM's Next / Submit.

Each field is [label, value, source]; source is "bid" or "listing <model>".
"""
import re

from .models import CatalogueProduct


def _listings(category):
    """[(model_no, {label: value}, [labels in GeM order])] of GeM-scanned products."""
    rows = []
    for product in CatalogueProduct.objects.filter(category=category).order_by("-updated_at"):
        specs = product.extra_specs if isinstance(product.extra_specs, dict) else {}
        values, order = {}, []
        for section in specs.get("_gem_sections") or []:
            for label, value in section[1]:
                if label not in values:
                    values[label] = value
                    order.append(label)
        if values:
            rows.append((product.model_no, values, order))
    return rows


def _build_fields(listings, bid_values):
    """Bid values first; everything else from the listing that matches most of them."""
    bid_values = {label: value for label, value in bid_values.items() if value}
    if not listings:
        return [[label, value, "bid"] for label, value in bid_values.items()]
    model, template, order = max(
        listings,
        key=lambda item: sum(item[1].get(label) == value for label, value in bid_values.items()),
    )
    fields = []
    for label in order:
        if label in bid_values:
            fields.append([label, bid_values[label], "bid"])
        else:
            fields.append([label, template[label], f"listing {model}"])
    fields += [[label, value, "bid"] for label, value in bid_values.items() if label not in template]
    return fields


def _gb(text):
    match = re.search(r"(\d+(?:\.\d+)?)\s*(tb|gb)", str(text or ""), re.IGNORECASE)
    if not match:
        return ""
    amount = float(match.group(1)) * (1024 if match.group(2).lower() == "tb" else 1)
    return str(int(amount))


def _connectivity(text):
    if re.search(r"\bwireless\b", str(text or ""), re.IGNORECASE):
        return "Wireless"
    if re.search(r"\bwired\b|\busb\b", str(text or ""), re.IGNORECASE):
        return "Wired"
    return ""


def _gem_processor(text):
    # GeM writes "Intel Core i5-12400" / "Intel Core Ultra 7-265".
    return re.sub(
        r"\b(i[3579]|Ultra\s+[3579])\s+(\d{3,5}[A-Z]*)\b",
        lambda m: f"{re.sub(r'\s+', ' ', m.group(1))}-{m.group(2)}",
        re.sub(r"\s+", " ", str(text or "")).strip(),
    )


def _display_size_option(screen_size, listings):
    """21 inch -> '53.1 - 58 (20.91" - 22.83")', using GeM's own size ranges."""
    match = re.search(r"\d+(?:\.\d+)?", str(screen_size or ""))
    if not match:
        return ""
    inches = float(match.group(0))
    options = {values.get("Display Size - Diagonal (in Inches)", "") for _m, values, _o in listings}
    for option in options:
        bounds = re.search(r'\(\s*([\d.]+)"?\s*-\s*([\d.]+)"?\s*\)', option)
        if bounds and float(bounds.group(1)) - 0.05 <= inches <= float(bounds.group(2)) + 0.05:
            return option
    return ""


def aio_gem_fields(bid):
    listings = _listings("aio")
    ram_text = str(bid.ram or "")
    ssd_text = str(bid.ssd or "")
    ram_type = re.search(r"DDR\d", ram_text, re.IGNORECASE)
    storage_type = (
        "NVMe SSD" if re.search(r"nvme", ssd_text, re.IGNORECASE)
        else "SATA SSD" if re.search(r"sata", ssd_text, re.IGNORECASE)
        else ""
    )
    connectivity = _connectivity(bid.keyboard)
    return _build_fields(listings, {
        "Processor Number": _gem_processor(bid.processor),
        "RAM Size (GB)": _gb(ram_text),
        "Type of RAM": ram_type.group(0).upper() if ram_type else "",
        "Type of Storage Installed with the System": storage_type,
        "Storage Capacity (in GB)": _gb(ssd_text),
        "Display Size - Diagonal (in Inches)": _display_size_option(bid.screen_size, listings),
        "Operating System (Factory Preloaded with Certification)": str(bid.os or "").strip(),
        "Type of In-built Wireless Connectivity": str(bid.wifi or "").strip(),
        "Mouse Connectivity": connectivity,
        "Keyboard Connectivity": connectivity,
    })


TONER_PRINTER_BRAND = "Printer/Multifunction Machines Brand for which offered Cartridge/Consumable is Suitable"
TONER_YIELD = "Minimum Yield of the Replacement Cartridge/Consumable offered (Number of Pages)"


def _yield_option(page_yield, listings):
    """'1,500' -> '1001 to 2000' when GeM's listings show that range."""
    match = re.search(r"\d[\d,]*", str(page_yield or ""))
    if not match:
        return ""
    pages = int(match.group(0).replace(",", ""))
    for option in {values.get(TONER_YIELD, "") for _m, values, _o in listings}:
        bounds = re.search(r"(\d+)\s*to\s*(\d+)", option)
        if bounds and int(bounds.group(1)) <= pages <= int(bounds.group(2)):
            return option
    return ""


def toner_gem_fields(bid, model_number):
    listings = _listings("toner")
    return _build_fields(listings, {
        "Product Class of Cartridge": str(bid.product_class or "").strip(),
        TONER_PRINTER_BRAND: str(bid.brand or "").strip(),
        # GeM has one type for every laser toner the bid form offers.
        "Type of Cartridge/Consumable": "Toner Cartridge" if bid.cartridge_type else "",
        "Color of the Ink/Toner": "" if str(bid.colour or "").lower() == "all colour" else str(bid.colour or "").strip(),
        "Model Number of OEM's Printer/OEM's Multi Function Machine": str(bid.compatibility or "").strip(),
        "Model Number of OEM's Printer Cartridge/Consumable": str(bid.toner_model or "").strip(),
        "Model Number of cartridges /Consumable offered by compatible manufacturer": model_number,
        TONER_YIELD: _yield_option(bid.page_yield, listings),
    })
