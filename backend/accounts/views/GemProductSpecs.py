import json
import os
import re
import urllib.request

import openpyxl
from django.conf import settings
from django.core.files.base import ContentFile
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .. import desktop_excel
from ..models import CatalogueProduct
from .Desktop import ALL_FIELDS, FIELD_ALIASES, _catalogue_extra_specs, _normalize_extra_specs
from .Gem import _require_role

# The extension reads every label/value pair it can see on a GeM product page
# (spec tables, definition lists, form labels). Only labels that match the
# product directory's own spec fields (ALL_FIELDS) are kept, so the directory
# gets exactly the fields the software already shows - nothing more.

MAX_PAIRS = 5000
MODEL_LABEL_KEYS = {"model", "modelnumber", "modelno", "modelname", "modelnumbermodelname"}
INVALID_MODEL_NOS = {"MEITY", "DESKTOP", "COMPUTER"}
# GeM spells a few labels differently from the GeM spec PDF the directory
# was first built from.
EXTRA_ALIASES = {
    "Description of Stores": ["Item Description", "Description of Store"],
    "Factory Pre-loaded Operating System by DesktopOEM": ["Factory Preloaded Operating System by Desktop OEM", "Operating System", "Factory Pre-loaded Operating System"],
    "Number of DIMM Slots Populated with MemoryCard/Module": ["Number of DIMM Slots populated with Memory Card"],
    "Number of USB Type A Port (Version 2 Point 0)": ["Number of USB Type A Ports (Version 2 Point 0)"],
    "Number of USB Type A Port (Version 3 point 2 Gen 1)": ["Number of USB Type A Ports (Version 3 point 2 Gen 1)"],
    "Maximum Operating Temperature (in DegreeCelsius)": ["Maximum Operating Temperature (in Degree Celsius)"],
    "On Site OEM Warranty (in Year)": ["On Site OEM Warranty (in Years)", "OEM Warranty (in Year)"],
}


def _label_key(label):
    return re.sub(r"[^a-z0-9]", "", str(label or "").lower())


def _build_label_lookup():
    lookup = {}
    for field in ALL_FIELDS:
        for alias in [field, *FIELD_ALIASES.get(field, []), *EXTRA_ALIASES.get(field, [])]:
            lookup.setdefault(_label_key(alias), field)
    return lookup


LABEL_LOOKUP = _build_label_lookup()


def _clean_text(value):
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    return "" if text in {"-", "--", "NA", "N/A", "Select", "Select an option"} else text


def _high_end_specs(raw, specs):
    """High End Desktop pages split fields the directory keeps as one."""
    if "baseprocessornumber" in raw or "higherprocessornumber" in raw:
        processors = [raw.get("baseprocessornumber", ""), raw.get("higherprocessornumber", "")]
        # Base says "NA for Higher Processor" when only the higher one applies.
        chosen = next((p for p in processors if p and not p.upper().startswith("NA")), "")
        if chosen:
            specs["Processor Number"] = chosen
        specs.setdefault("Computer Type", "High End")
    if "primarystoragecapacityingb" in raw:
        primary = raw["primarystoragecapacityingb"]
        secondary = raw.get("secondarystoragecapacityingb", "")
        has_secondary = not raw.get("availabilityofsecondarystorage", "").lower().startswith("no")
        if "ssd" in specs.get("Type of Storage Installed with the System", "").lower():
            specs["SSD - Storage Capacity (in GB)"] = primary
            specs["HDD - Storage Capacity (in GB)"] = secondary if has_secondary and secondary else "0"
        else:
            specs["HDD - Storage Capacity (in GB)"] = primary


def _map_pairs(pairs):
    specs = {}
    raw = {}
    model_no = ""
    for pair in pairs[:MAX_PAIRS]:
        if not isinstance(pair, (list, tuple)) or len(pair) < 2:
            continue
        key = _label_key(pair[0])
        value = _clean_text(pair[1])
        if not key or not value or _label_key(value) == key:
            continue
        raw.setdefault(key, value)
        if key in MODEL_LABEL_KEYS and not model_no:
            model_no = value
            continue
        field = LABEL_LOOKUP.get(key)
        # First value wins: GeM repeats some labels in summary blocks that
        # are shorter than the full specification table.
        if field and field not in specs:
            specs[field] = value[:1000]
    _high_end_specs(raw, specs)
    return specs, model_no


def _summary_fields(specs):
    ram_size = specs.get("RAM Size (Memory Card/Module) (in GB) (Capacity tobe installed in the System)", "")
    storage_type = specs.get("Type of Storage Installed with the System", "")
    return {
        "processor": specs.get("Processor Number", ""),
        "ram": " ".join(x for x in [ram_size, specs.get("Type of RAM", "")] if x).strip(),
        "storage": " ".join(x for x in [specs.get("SSD - Storage Capacity (in GB)", ""), storage_type] if x).strip(),
        "os": specs.get("Factory Pre-loaded Operating System by DesktopOEM", ""),
        "description": specs.get("Description of Stores", ""),
    }


@csrf_exempt
@require_http_methods(["POST"])
def import_gem_product_specs(request):
    try:
        data = json.loads(request.body or "{}")
    except (TypeError, ValueError):
        return JsonResponse({"error": "Invalid JSON body."}, status=400)
    _user, error = _require_role(request, {"admin", "analyser", "management"}, data)
    if error:
        return error

    pairs = data.get("pairs") if isinstance(data.get("pairs"), list) else []
    specs, page_model_no = _map_pairs(pairs)
    model_no = _clean_text(data.get("model_no") or page_model_no or data.get("detected_model_no")).upper()
    if not model_no or model_no in INVALID_MODEL_NOS:
        return JsonResponse({"error": "Model number not found on this GeM page. Enter it in the extension and try again."}, status=400)
    if not specs:
        return JsonResponse({"error": "No product directory spec fields were found on this page. Open the GeM product's specification page and try again."}, status=400)

    product = CatalogueProduct.objects.filter(model_no__iexact=model_no).first()
    if product and (product.category or "desktop").lower() != "desktop":
        # AIO/Workstation products keep a different spec layout; rebuilding
        # them against the Desktop fields would drop their existing specs.
        return JsonResponse({"error": f"{product.model_no} is a {product.category} product. Only Desktop specs can be imported from GeM."}, status=400)
    old_specs = _normalize_extra_specs(_catalogue_extra_specs(product)) if product else _normalize_extra_specs({})
    new_specs = dict(old_specs)
    new_specs.update(specs)
    new_specs = _normalize_extra_specs(new_specs)
    changed = [
        {"field": field, "old": old_specs.get(field, ""), "new": new_specs.get(field, "")}
        for field in ALL_FIELDS
        if old_specs.get(field, "") != new_specs.get(field, "")
    ]
    response = {
        "model_no": product.model_no if product else model_no,
        "exists": bool(product),
        "found": len(specs),
        "total_fields": len(ALL_FIELDS),
        "missing": [field for field in ALL_FIELDS if field not in specs],
        "changed": changed,
        "saved": False,
    }
    if data.get("dry_run"):
        return JsonResponse(response, status=200)

    summary = {key: value for key, value in _summary_fields(new_specs).items() if value}
    # Write the Excel row here (not via the save signal) to report its result.
    with desktop_excel.paused():
        if product:
            for key, value in summary.items():
                setattr(product, key, value)
            product.extra_specs = new_specs
            product.category = product.category or "Desktop"
            product.save()
        else:
            product = CatalogueProduct.objects.create(
                model_no=model_no, category="Desktop", extra_specs=new_specs, **summary,
            )
    excel_error = desktop_excel.save_product(product)
    response.update({
        "saved": True, "id": product.id, "created": not response["exists"],
        "excel_saved": not excel_error, "excel_error": excel_error,
    })
    return JsonResponse(response, status=200)


MARKET_BRAND = "acxxel"
GEM_IMAGE_PREFIX = "https://assets-mkpbg.gem.gov.in/img/"
MAX_IMAGE_BYTES = 5 * 1024 * 1024


def attach_gem_image(product, url):
    """Save the GeM listing's picture as the product image, replacing any
    earlier one. Only GeM's own image host is downloaded from."""
    url = str(url or "")
    if not url.startswith(GEM_IMAGE_PREFIX):
        return False
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(request, timeout=15) as response:
            if not response.headers.get_content_type().startswith("image/"):
                return False
            data = response.read(MAX_IMAGE_BYTES + 1)
    except Exception:
        return False
    if not data or len(data) > MAX_IMAGE_BYTES:
        return False
    name = re.sub(r"[^A-Za-z0-9-]+", "_", f"{product.model_no}_{product.gem_product_id}").strip("_")
    filename = f"gem_{name[:80]}.jpg"
    # A previous GeM picture of this product is replaced, not kept as a copy.
    # Any other old image file stays on disk: another product may use it.
    if product.image and os.path.basename(product.image.name).startswith(f"gem_{name[:80]}"):
        product.image.delete(save=False)
    product.image.save(filename, ContentFile(data), save=False)
    product.save(update_fields=["image", "updated_at"])
    return True


def gem_sections(item):
    """The product page's own spec groups [[title, [[label, value], ...]], ...]
    in GeM's order, without Certification. View Details shows these, so each
    product shows exactly its own GeM specs."""
    sections = []
    for section in item.get("sections") or []:
        if not isinstance(section, (list, tuple)) or len(section) < 2:
            continue
        title = _clean_text(section[0])
        if not title or "certification" in title.lower():
            continue
        rows = [
            [_clean_text(row[0]), _clean_text(row[1])]
            for row in section[1] or []
            if isinstance(row, (list, tuple)) and len(row) >= 2 and _clean_text(row[0])
        ]
        if rows:
            sections.append([title, rows])
    return sections


def gem_product_id(url):
    """GeM listing id from a product URL (".../p-5116877-40739025530-cat.html")."""
    match = re.search(r"/p-(\d+-\d+)-cat", str(url or ""))
    return match.group(1) if match else ""


@csrf_exempt
@require_http_methods(["POST"])
def replace_from_gem_market(request):
    """The extension's GeM Market scan. mode "update": GeM specs are applied to
    matching products and new models are added, nothing is removed. mode
    "replace" (full scans only): the GeM products become the Desktop directory
    and a fresh Desktop_Product.xlsx; old products go to a dated backup sheet
    (see restore_desktop_products)."""
    try:
        data = json.loads(request.body or "{}")
    except (TypeError, ValueError):
        return JsonResponse({"error": "Invalid JSON body."}, status=400)
    _user, error = _require_role(request, {"admin", "analyser", "management"}, data)
    if error:
        return error

    scanned = data.get("products") if isinstance(data.get("products"), list) else []
    mode = "update" if data.get("mode") == "update" else "replace"
    try:
        total = int(data.get("total") or 0)
    except (TypeError, ValueError):
        total = 0
    if not scanned:
        return JsonResponse({"error": "No GeM products were read. Run Fetch from GeM again."}, status=400)
    # A partial scan would wipe real products from the directory.
    if mode == "replace" and (total <= 0 or len(scanned) != total):
        return JsonResponse({"error": f"GeM scan is incomplete ({len(scanned)} of {total or '?'} products read). Run the scan again."}, status=400)

    entries, models, problems = {}, {}, []
    for item in scanned:
        if not isinstance(item, dict):
            continue
        url = str(item.get("url") or "")
        if _clean_text(item.get("brand")).lower() != MARKET_BRAND:
            problems.append(f"{url}: brand is not {MARKET_BRAND}")
            continue
        pairs = item.get("pairs") if isinstance(item.get("pairs"), list) else []
        specs, page_model = _map_pairs(pairs)
        model_no = _clean_text(item.get("model_no") or page_model).upper()
        if not model_no or model_no in INVALID_MODEL_NOS or not specs:
            problems.append(f"{url}: model number or specifications missing")
            continue
        # GeM lists several configurations under one model number; each
        # listing (GeM product id) is its own directory product.
        gem_id = gem_product_id(url)
        models[model_no] = models.get(model_no, 0) + 1
        entries[(model_no, gem_id)] = {
            "model_no": model_no, "gem_product_id": gem_id, "sections": gem_sections(item),
            "image": item.get("image") or "",
            "specs": specs, "summary": _summary_fields(_normalize_extra_specs(specs)),
        }
    if problems:
        return JsonResponse({"error": "Some GeM products could not be read: " + "; ".join(problems[:5])}, status=400)

    apply = desktop_excel.update_directory if mode == "update" else desktop_excel.replace_directory
    result = apply(list(entries.values()), dry_run=bool(data.get("dry_run")))
    if not data.get("dry_run"):
        # The Excel row needs no image; skip rewriting it once per picture.
        with desktop_excel.paused():
            for entry in entries.values():
                product = CatalogueProduct.objects.filter(
                    model_no=entry["model_no"], gem_product_id=entry["gem_product_id"],
                ).first()
                if product:
                    attach_gem_image(product, entry["image"])
    result.update({
        "scanned": len(scanned),
        # Model numbers with more than one GeM configuration (all are kept).
        "duplicates": sorted(m for m, n in models.items() if n > 1),
        "saved": not data.get("dry_run"),
        "mode": mode,
    })
    return JsonResponse(result, status=200)


CATEGORY_EXCEL_DIR = "gem_products"
CATEGORY_BASE_COLUMNS = ["model_no", "brand", "product_name", "url", "updated_at"]


def category_excel_path(category):
    name = re.sub(r"[^A-Za-z0-9]+", "_", category or "").strip("_") or "GeM_Search"
    return os.path.join(settings.BASE_DIR, CATEGORY_EXCEL_DIR, f"{name[:80]}.xlsx")


def _product_key(item):
    # One row per GeM listing: a model number can have several configurations.
    return gem_product_id(item.get("url")) or _clean_text(item.get("model_no")).upper()


AIO_CATEGORY = re.compile(r"^all in one pc", re.IGNORECASE)
# GeM's Certification section is not kept in the directory.
AIO_CERTIFICATION_FIELDS = {
    "BIS CRS Compliance",
    "BIS Registration Number",
    "ROHS Compliance",
    "Certification for Environmental Management System with Manufacturer",
    "Compliance of Information Security, Cybersecurity and Privacy Protection-Information Security Management Systems Requirements",
    "EPR Registration in respect of the manufacturer as per E waste rules as amended up to date",
    "Agreed to Provide a copy of EPR Registration Certificate to Buyer on Demand",
}


def _aio_screen_size(value):
    # "58.1 - 63 (22.87" - 24.8")" -> "22.87 to 24.8 inch", the format the AIO
    # matcher already uses for aio_specs.xlsx (inches, range spelled out).
    inches = re.search(r"\(([^)]*)\)", value or "")
    nums = re.findall(r"\d+(?:\.\d+)?", inches.group(1) if inches else value or "")
    if len(nums) >= 2:
        return f"{nums[0]} to {nums[1]} inch"
    return f"{nums[0]} inch" if nums else _clean_text(value)


def _gem_specs(pairs, skip=()):
    """GeM [label, value] pairs -> ({label: value}, get(*labels))."""
    raw = {}
    for pair in pairs or []:
        label = _clean_text(pair[0]) if isinstance(pair, (list, tuple)) and len(pair) >= 2 else ""
        if label and label not in skip:
            raw.setdefault(label, _clean_text(pair[1]))
    by_key = {_label_key(k): v for k, v in raw.items()}

    def get(*labels):
        return next((by_key[_label_key(l)] for l in labels if by_key.get(_label_key(l))), "")
    return raw, get


def _aio_directory_fields(pairs):
    """GeM "All in One PC" specs -> the AIO directory's own fields."""
    raw, get = _gem_specs(pairs, skip=AIO_CERTIFICATION_FIELDS)
    # The matcher deletes hyphens, so "i5-12400" must become "i5 12400".
    processor = re.sub(r"(?<=[A-Za-z0-9])-(?=\d)", " ", get("Processor Number"))
    ram_size, ram_type = get("RAM Size (GB)"), get("Type of RAM")
    ram = " ".join(x for x in [f"{ram_size}GB" if ram_size else "", ram_type] if x)
    capacity, storage_type = get("Storage Capacity (in GB)"), get("Type of Storage Installed with the System")
    storage = " ".join(x for x in [f"{capacity} GB" if capacity else "", storage_type] if x)
    os_value = get("Operating System (Factory Preloaded with Certification)", "Operating System")
    specs = {
        **raw,
        "Computer Type": "All in One PC",
        "Processor Number": processor, "RAM": ram, "Storage": storage,
        "Operating System": os_value,
        "Screen Size": _aio_screen_size(get("Display Size - Diagonal (in Inches)")),
        "WiFi Bluetooth": get("Type of In-built Wireless Connectivity"),
        "Keyboard Mouse": get("Keyboard Connectivity", "Mouse Connectivity"),
        "Motherboard Ports": get("Number of Ports"),
    }
    summary = {"processor": processor, "ram": ram, "storage": storage, "os": os_value}
    return specs, summary


TONER_CATEGORY = re.compile(r"^toner cartridges", re.IGNORECASE)


def _toner_directory_fields(pairs):
    """GeM "Toner Cartridges / Ink Cartridges" specs -> the Toner tab's fields
    (the same keys a toner bid's catalogue entry uses)."""
    raw, get = _gem_specs(pairs)
    cartridge_type = get("Type of Cartridge/Consumable")
    colour = get("Color of the Ink/Toner", "Colour of the Ink/Toner")
    method = get(
        "Method for the Determination of Toner Cartridge Yield for Colour Printers and Multi-Function Devices that Contain Printer Components"
        if colour and colour.lower() != "black" else
        "Method for the Determination of Toner Cartridge Yield for Monochromatic Electrophotographic Printers and Multi-Function Devices that Contain Printer Components"
    )
    standard = re.search(r"ISO/IEC\s*\d+", method or "")
    specs = {
        **raw,
        "Product Type": cartridge_type or "Toner Cartridge",
        "Brand": get("Printer/Multifunction Machines Brand for which offered Cartridge/Consumable is Suitable"),
        "Cartridge Type": cartridge_type,
        "Product Class": get("Product Class of Cartridge"),
        "Colour": colour,
        "Technology": "Laser" if "toner" in cartridge_type.lower() else "",
        "Compatibility": get("Model Number of OEM's Printer/OEM's Multi Function Machine"),
        "Page Yield": get("Minimum Yield of the Replacement Cartridge/Consumable offered (Number of Pages)"),
        "Yield Standard": re.sub(r"\s+", " ", standard.group(0)) if standard else method,
    }
    return specs, {}


def _save_aio_directory(items):
    return _save_category_directory(items, "aio", _aio_directory_fields, "All in One PC")


def _save_toner_directory(items):
    return _save_category_directory(items, "toner", _toner_directory_fields, "Toner Cartridge")


WORKSTATION_CATEGORY = re.compile(r"^fixed computer workstation", re.IGNORECASE)


def _workstation_directory_fields(pairs):
    """GeM "Fixed Computer Workstation" specs -> the keys the Workstation tab
    and its Find Model read (the same ones worksation.xlsx rows get). GeM's
    exact labels are matched by keyword, so small wording changes still map."""
    raw, _get = _gem_specs(pairs)

    def find(pattern, exclude=None):
        for label, value in raw.items():
            if value and re.search(pattern, label, re.IGNORECASE) and not (exclude and re.search(exclude, label, re.IGNORECASE)):
                return value
        return ""

    processor = find(r"processor\s*(number|model|name)") or find(r"^processor", r"generation|core|thread|cache|speed|clock|description")
    ram_size = find(r"(ram|memory).*(size|capacity)", r"expand|graphic|cache")
    ram_type = find(r"(type of ram|ram type|memory type)")
    ram = " ".join(x for x in [f"{ram_size}GB" if ram_size.isdigit() else ram_size, ram_type] if x)
    ssd = find(r"ssd.*capacity|capacity.*ssd")
    hdd = find(r"hdd.*capacity|capacity.*hdd")
    storage_type = find(r"type of storage")
    graphics = find(r"graphic.*(make|model|card)", r"memory|type of") or find(r"graphic", r"memory|type of")
    os_value = find(r"operating system", r"recovery")
    monitor = find(r"(screen|display|monitor).*size")
    power = find(r"power supply", r"monitor")
    chipset = find(r"chipset|motherboard")
    specs = {
        **raw,
        "Computer Type": "Workstation",
        "Processor": processor, "Processor Number": processor,
        "Motherboard": chipset, "RAM": ram,
        "SSD": ssd, "HDD": hdd, "Storage": " + ".join(x for x in [ssd and f"{ssd} GB SSD", hdd and f"{hdd} GB HDD"] if x) or storage_type,
        "Graphics Card": graphics, "Graphic Card Make and Model": graphics,
        "Operating System": os_value, "Factory Pre-loaded Operating System": os_value,
        "Monitor": monitor, "Screen Size": monitor,
        "Power Supply": power,
    }
    summary = {"processor": processor, "ram": ram, "storage": specs["Storage"], "os": os_value}
    return specs, summary


def _save_workstation_directory(items):
    return _save_category_directory(items, "workstation", _workstation_directory_fields, "Workstation")


def _save_category_directory(items, category, fields, default_description):
    """acxxel GeM products -> the directory tab of `category`, one product
    per GeM listing (a model number can have several configurations)."""
    added = updated = 0
    keys = [desktop_excel.product_key(_clean_text(i.get("model_no")), gem_product_id(i.get("url"))) for i in items]
    products = {
        desktop_excel.product_key(p.model_no, p.gem_product_id): p
        for p in CatalogueProduct.objects.filter(model_no__in={k[0] for k in keys})
    }
    matched = desktop_excel._match_products(keys, products)
    for key, item in zip(keys, items):
        if not key[0]:
            continue
        specs, summary = fields(item.get("pairs"))
        sections = gem_sections(item)
        if sections:
            specs["_gem_sections"] = sections
        product = matched.get(key)
        if product and (product.category or "").lower() != category:
            continue  # another category's model with the same number
        if product is None:
            product = CatalogueProduct(model_no=key[0], category=category)
            added += 1
        else:
            updated += 1
        product.gem_product_id = key[1]
        # Found on GeM, so no longer a bid-created model waiting for upload.
        product.extra_specs = specs
        product.description = _clean_text(item.get("title")) or default_description
        for field, value in summary.items():
            if value:
                setattr(product, field, value)
        product.save()
        attach_gem_image(product, item.get("image"))
    return added, updated


@csrf_exempt
@require_http_methods(["POST"])
def save_gem_category_excel(request):
    """GeM search read by the extension -> one Excel per GeM category with
    every acxxel product and all of its GeM specification columns. All in One
    PC and Toner products also go to the directory's AIO / Toner tab. Saving
    again updates rows by GeM listing and adds new spec columns. Only acxxel
    products are kept: other brands are ignored and removed from the file."""
    try:
        data = json.loads(request.body or "{}")
    except (TypeError, ValueError):
        return JsonResponse({"error": "Invalid JSON body."}, status=400)
    _user, error = _require_role(request, {"admin", "analyser", "management"}, data)
    if error:
        return error
    category = _clean_text(data.get("category"))
    items = [
        i for i in (data.get("products") or [])
        if isinstance(i, dict) and _product_key(i) and _clean_text(i.get("brand")).lower() == MARKET_BRAND
    ]
    if not category or not items:
        return JsonResponse({"error": f"Category and {MARKET_BRAND} products are required."}, status=400)

    path = category_excel_path(category)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    now = timezone.now().strftime("%Y-%m-%d %H:%M")
    added = updated = 0
    try:
        with desktop_excel._file_lock(path):
            if os.path.exists(path):
                workbook = openpyxl.load_workbook(path)
                sheet = workbook.active
                headers = [_clean_text(c.value) for c in sheet[1]]
            else:
                workbook = openpyxl.Workbook()
                sheet = workbook.active
                # Excel sheet names: max 31 characters, none of \ / ? * [ ] :
                title = re.sub(r"\s+", " ", re.sub(r"[\\/?*\[\]:]", " ", category)).strip()
                sheet.title = title[:31].strip() or "GeM Products"
                headers = list(CATEGORY_BASE_COLUMNS)
                sheet.append(headers)
            brand_col = headers.index("brand") + 1
            other_brand_rows = [
                row for row in range(2, sheet.max_row + 1)
                if _clean_text(sheet.cell(row, brand_col).value).lower() != MARKET_BRAND
            ]
            for row in reversed(other_brand_rows):
                sheet.delete_rows(row)
            key_col = headers.index("model_no") + 1
            url_col = headers.index("url") + 1
            rows = {}
            for row in range(2, sheet.max_row + 1):
                key = _product_key({
                    "url": sheet.cell(row, url_col).value,
                    "model_no": sheet.cell(row, key_col).value,
                })
                if key:
                    rows.setdefault(key, row)
            for item in items:
                values = {
                    "model_no": _clean_text(item.get("model_no")),
                    "brand": _clean_text(item.get("brand")),
                    "product_name": _clean_text(item.get("title")),
                    "url": re.sub(r"#.*$", "", str(item.get("url") or "")),
                    "updated_at": now,
                }
                for pair in item.get("pairs") or []:
                    if isinstance(pair, (list, tuple)) and len(pair) >= 2:
                        label = _clean_text(pair[0])
                        if label and label not in values:
                            values[label] = _clean_text(pair[1])
                for label in values:
                    if label not in headers:
                        headers.append(label)
                        sheet.cell(1, len(headers)).value = label
                key = _product_key(item)
                row = rows.get(key)
                if row:
                    updated += 1
                else:
                    row = sheet.max_row + 1
                    rows[key] = row
                    added += 1
                for col, header in enumerate(headers, start=1):
                    if header in values:
                        sheet.cell(row, col).value = values[header]
            desktop_excel._save_workbook(workbook, path)
    except PermissionError:
        return JsonResponse({"error": f"{os.path.basename(path)} is open in another program. Close it and save again."}, status=409)
    except Exception as e:
        return JsonResponse({"error": f"{os.path.basename(path)} could not be saved: {e}"}, status=500)
    directory_added = directory_updated = 0
    if AIO_CATEGORY.match(category):
        directory_added, directory_updated = _save_aio_directory(items)
    elif TONER_CATEGORY.match(category):
        directory_added, directory_updated = _save_toner_directory(items)
    elif WORKSTATION_CATEGORY.match(category):
        directory_added, directory_updated = _save_workstation_directory(items)
    return JsonResponse({
        "directory_added": directory_added, "directory_updated": directory_updated,
        "file": os.path.join(CATEGORY_EXCEL_DIR, os.path.basename(path)),
        "added": added, "updated": updated, "total_rows": len(rows),
        "removed_other_brands": len(other_brand_rows),
    }, status=200)
