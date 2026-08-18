import json
import os
import re
import zipfile
from datetime import datetime
from xml.etree import ElementTree as ET
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from ..models import User, PrinterBid, CatalogueProduct
from . import Desktop as desktop_views
from .Desktop import (
    safe_float,
    _file_url,
    _parse_json_list,
    fitz,
    _get_model_number_from_data,
    _body_json,
    _value_from_body_or_bid,
    _CATALOGUE_FIELD_MAP,
    MIN_STRONG_MATCH_FIELDS,
    _match_is_blank,
    _values_overlap_score,
    _best_catalogue_match,
    _best_bid_match,
)


def _printer_catalogue_path():
    return os.path.join(settings.BASE_DIR, "printer.xlsx")


def _pr_clean(value):
    if value is None:
        return ""
    text = str(value).strip()
    return "" if text.lower() in {"nan", "none", "null"} else text


def _pr_first(row, *keys):
    for key in keys:
        value = _pr_clean(row.get(key))
        if value:
            return value
    return ""


def _pr_is_yes(value):
    return _pr_clean(value).lower() in {"yes", "y", "true", "1"}


def _pr_printing_type(row):
    mono = _pr_is_yes(_pr_first(row, "Mono"))
    colour = _pr_is_yes(_pr_first(row, "Colour"))
    if colour:
        return "Colour"
    if mono:
        return "Monochrome"
    return _pr_first(row, "Type of Printing")


def _pr_printer_type(row):
    function = _pr_first(row, "Printer Type", "Function")
    normalized = re.sub(r"[^a-z]+", " ", function.lower()).strip()
    if any(word in normalized.split() for word in ("copy", "scan", "fax")):
        return "Multifunction Printer"
    if "print" in normalized.split():
        return "Computer Printer"
    return function


def _pr_connectivity(row):
    explicit = _pr_first(row, "Connectivity")
    if explicit:
        return explicit
    available = []
    if _pr_is_yes(_pr_first(row, "USB")):
        available.append("USB Port")
    if _pr_is_yes(_pr_first(row, "Network", "Ethernet")):
        available.append("Ethernet")
    if _pr_is_yes(_pr_first(row, "Wi-Fi", "Wi‑Fi")):
        available.append("Wi-Fi")
    return ", ".join(available)


def _xlsx_rows(path):
    namespace = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

    with zipfile.ZipFile(path) as archive:
        shared_strings = []
        if "xl/sharedStrings.xml" in archive.namelist():
            shared_root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in shared_root.findall("main:si", namespace):
                text_parts = [node.text or "" for node in item.findall(".//main:t", namespace)]
                shared_strings.append("".join(text_parts))

        sheet_name = "xl/worksheets/sheet1.xml"
        if sheet_name not in archive.namelist():
            return []

        sheet_root = ET.fromstring(archive.read(sheet_name))
        rows = []

        for row in sheet_root.findall(".//main:sheetData/main:row", namespace):
            values = []
            for cell in row.findall("main:c", namespace):
                cell_type = cell.get("t")
                value_node = cell.find("main:v", namespace)
                inline_node = cell.find("main:is/main:t", namespace)

                if cell_type == "s" and value_node is not None:
                    try:
                        values.append(shared_strings[int(value_node.text or 0)])
                    except Exception:
                        values.append(value_node.text or "")
                elif cell_type == "inlineStr" and inline_node is not None:
                    values.append(inline_node.text or "")
                elif value_node is not None:
                    values.append(value_node.text or "")
                else:
                    values.append("")
            rows.append(values)

    if not rows:
        return []

    headers = [str(value).strip() for value in rows[0]]
    data_rows = []
    for row in rows[1:]:
        padded = row + [""] * max(0, len(headers) - len(row))
        data_rows.append({headers[index]: padded[index] for index in range(len(headers))})
    return data_rows


def _load_printer_catalogue():
    path = _printer_catalogue_path()
    if not os.path.exists(path):
        return []

    products = []
    try:
        rows = _xlsx_rows(path)
    except Exception:
        rows = []

    for index, row in enumerate(rows):
        model_no = _pr_first(row, "Model Number", "Acxxel")
        if not model_no:
            continue
        product = {
            "id": f"printer-{index + 1}",
            "model_no": model_no,
            "category": "Printer",
            "printing_technology": _pr_first(row, "Printing Technology", "Printer\nTechnology"),
            "cartridge_technology": _pr_first(row, "Cartridge Technology", "Composite/\nSeparate Toner"),
            "type_of_printing": _pr_printing_type(row),
            "fax_availability": _pr_first(row, "Availability of Fax", "Fax\nAvailable"),
            "operating_system_compatibility": _pr_first(row, "Operating System Compatibility", "OS"),
            "mono_print_speed_ppm": _pr_first(row, "Mono Print Speed PPM", "Print Speed\nppm (A4)"),
            "mono_print_speed_ipm": _pr_first(row, "Mono Print Speed IPM"),
            "colour_print_speed_ppm": _pr_first(row, "Colour Print Speed PPM"),
            "colour_print_speed_ipm": _pr_first(row, "Colour Print Speed IPM"),
            "auto_duplexing": _pr_first(row, "Auto Duplexing", "Duplex\nPrinting", "Auto\nDuplex"),
            "reduction_enlarge_features": _pr_first(row, "Reduction and Enlarge Features", "Reduction Env.\nFeature"),
            "printer_type": _pr_printer_type(row),
            "max_scan_area": _pr_first(row, "Maximum Scan Area", "Scan\nArea", "Page\nSize"),
            "a4_scan_speed_colour": _pr_first(row, "A4 Scan Speed Colour", "A4 Scan Speed\nColour (IPM)"),
            "scan_to_functions": _pr_first(row, "Scan To Functions", "Function"),
            "document_feeder_type": _pr_first(row, "Original Document Feeder Type", "Auto\nDuplex"),
            "feeder_capacity": _pr_first(row, "Feeder Capacity", "Feeder\nCapacity"),
            "main_paper_tray_count": _pr_first(row, "Number of Main Paper Tray", "No. Of\nPaper Tray"),
            "total_paper_tray_capacity": _pr_first(row, "Total Main Paper Tray Combined Capacity", "Paper Tray"),
            "bypass_tray_facility": _pr_first(row, "Bypass Tray Facility", "Bypass Tray\nFacility"),
            "bypass_tray_capacity": _pr_first(row, "Bypass Tray Capacity", "Bypass Tray\nCapacity"),
            "connectivity": _pr_connectivity(row),
            "duty_cycle": _pr_first(row, "Duty Cycle", "Duty Cycle"),
            "onsite_warranty": _pr_first(row, "On Site Warranty", "Warranty"),
            "extended_warranty": _pr_first(row, "Extended Warranty"),
        }
        product["description"] = " | ".join(
            value for value in [
                product["printing_technology"],
                product["type_of_printing"],
                product["mono_print_speed_ppm"],
                product["colour_print_speed_ppm"],
                product["max_scan_area"],
                product["connectivity"],
            ] if value
        )
        product["extra_specs"] = {
            "Printing Technology": product["printing_technology"],
            "Cartridge Technology": product["cartridge_technology"],
            "Type of Printing": product["type_of_printing"],
            "Availability of Fax": product["fax_availability"],
            "Operating System Compatibility": product["operating_system_compatibility"],
            "Mono Print Speed (PPM)": product["mono_print_speed_ppm"],
            "Mono Print Speed (IPM)": product["mono_print_speed_ipm"],
            "Colour Print Speed (PPM)": product["colour_print_speed_ppm"],
            "Colour Print Speed (IPM)": product["colour_print_speed_ipm"],
            "Auto Duplexing": product["auto_duplexing"],
            "Reduction and Enlarge Features": product["reduction_enlarge_features"],
            "Printer Type": product["printer_type"],
            "Maximum Scan Area": product["max_scan_area"],
            "A4 Scan Speed Colour": product["a4_scan_speed_colour"],
            "Scan To Functions": product["scan_to_functions"],
            "Document Feeder Type": product["document_feeder_type"],
            "Feeder Capacity": product["feeder_capacity"],
            "Main Paper Tray Count": product["main_paper_tray_count"],
            "Total Paper Tray Capacity": product["total_paper_tray_capacity"],
            "Bypass Tray Facility": product["bypass_tray_facility"],
            "Bypass Tray Capacity": product["bypass_tray_capacity"],
            "Connectivity": product["connectivity"],
            "Duty Cycle": product["duty_cycle"],
            "On Site Warranty": product["onsite_warranty"],
            "Extended Warranty": product["extended_warranty"],
        }
        products.append(product)
    return products


def _printer_semantic_value(field, value):
    text = re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()
    if text in {"na", "n a", "not applicable"}:
        text = "na"
    if field == "printing_technology":
        if "laser" in text or "electrophotography" in text or "xerography" in text or "led" in text:
            return "laser led"
        if "inkjet" in text:
            return "inkjet"
    if field == "cartridge_technology":
        if "separate" in text and ("toner" in text or "drum" in text):
            return "separate drum toner"
        if "composite" in text:
            return "composite cartridge"
    if field in {
        "fax_availability",
        "auto_duplexing",
        "reduction_enlarge_features",
        "bypass_tray_facility",
    }:
        if text in {"na", "no"}:
            return "no"
        if text == "yes":
            return "yes"
    if field == "document_feeder_type":
        if "dadf" in text or "radf" in text or "reverse duplex" in text:
            return "dadf radf"
        if text in {"sdf", "spdf"} or "single pass" in text:
            return "single pass feeder"
        if text == "adf" or "automatic document feeder" in text:
            return "adf"
        if text == "platen":
            return "platen"
    if field == "connectivity" and text == "select all":
        return "usb port ethernet wi fi"
    if field == "operating_system_compatibility":
        text = text.replace("microsoft ", "").replace("mac os", "mac").replace("mac ios", "mac")
    return text


def _printer_bid_is_unspecified(value):
    return str(value or "").strip().lower() in {"", "select", "null", "undefined"}


def _printer_catalogue_match_value(bid_value, catalogue_value, field=""):
    bid_semantic = _printer_semantic_value(field, bid_value)
    catalogue_semantic = _printer_semantic_value(field, catalogue_value)
    if bid_semantic and bid_semantic == catalogue_semantic:
        return True, 100
    if _printer_bid_is_unspecified(bid_value) or not str(catalogue_value or "").strip():
        return False, 0
    range_matched, range_score = _printer_range_match_value(bid_value, catalogue_value)
    if range_matched:
        return True, range_score
    if field in {"connectivity", "operating_system_compatibility"}:
        bid_parts = set(bid_semantic.split())
        catalogue_parts = set(catalogue_semantic.split())
        if bid_parts and bid_parts.issubset(catalogue_parts):
            return True, 100
    score = _values_overlap_score(bid_value, catalogue_value)
    return score >= 100, score


def _printer_normalize_numeric_text(value):
    return (
        str(value or "")
        .replace(",", "")
        .replace("Pages", "")
        .replace("pages", "")
        .replace("Page", "")
        .replace("page", "")
        .replace("Year", "")
        .replace("year", "")
        .replace("Years", "")
        .replace("years", "")
        .strip()
    )


def _printer_extract_numbers(value):
    text = _printer_normalize_numeric_text(value)
    return [int(match) for match in re.findall(r"\d+", text)]


def _printer_parse_range(value):
    text = _printer_normalize_numeric_text(value).lower()
    numbers = _printer_extract_numbers(text)

    if not numbers:
        return None

    if "to" in text and len(numbers) >= 2:
        return (numbers[0], numbers[1])

    if "or higher" in text or "and above" in text:
        return (numbers[0], float("inf"))

    if "or lower" in text or "or less" in text:
        return (0, numbers[0])

    if len(numbers) == 1:
        return (numbers[0], numbers[0])

    return None


def _printer_range_match_value(bid_value, catalogue_value):
    bid_range = _printer_parse_range(bid_value)
    catalogue_range = _printer_parse_range(catalogue_value)

    if not bid_range or not catalogue_range:
        return False, 0

    bid_min, bid_max = bid_range
    cat_min, cat_max = catalogue_range
    overlaps = bid_min <= cat_max and cat_min <= bid_max

    if not overlaps:
        return False, 0


    if cat_min == cat_max and bid_min <= cat_min <= bid_max:
        return True, 100

    if bid_min == bid_max and cat_min <= bid_min <= cat_max:
        return True, 100

    return True, 100


def _replace_phrase_in_pdf(page, old_text, new_text, fontsize=10.5):
    areas = page.search_for(old_text)
    if not areas:
        return
    for area in areas:
        page.add_redact_annot(area, fill=(1, 1, 1))
    page.apply_redactions()
    for area in areas:
        insert_rect = fitz.Rect(area.x0, area.y0 - 1, min(page.rect.width - 36, area.x1 + 120), area.y1 + 8)
        page.insert_textbox(
            insert_rect,
            new_text,
            fontsize=fontsize,
            fontname="hebo",
            color=(0, 0, 0),
            align=0,
        )


def _replace_sentence_line(page, old_text, new_text, fontsize=10.5, extra_width=220):
    areas = page.search_for(old_text)
    if not areas:
        return False

    for area in areas:
        line_rect = fitz.Rect(area.x0 - 2, area.y0 - 3, min(page.rect.width - 36, area.x1 + extra_width), area.y1 + 4)
        page.add_redact_annot(line_rect, fill=(1, 1, 1))
    page.apply_redactions()

    for area in areas:
        insert_rect = fitz.Rect(area.x0, area.y0 - 1, min(page.rect.width - 36, area.x1 + extra_width), area.y1 + 18)
        page.insert_textbox(
            insert_rect,
            new_text,
            fontsize=fontsize,
            fontname="hebo",
            color=(0, 0, 0),
            align=0,
        )
    return True


def _rewrite_line_text(page, predicate, transform, fontsize=10.5):
    blocks = page.get_text("dict").get("blocks", [])
    target_lines = []

    for block in blocks:
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            text = " ".join(span.get("text", "") for span in line.get("spans", [])).strip()
            if text and predicate(text):
                target_lines.append((fitz.Rect(line["bbox"]), text))

    if not target_lines:
        return False

    for rect, _text in target_lines:
        redact_rect = fitz.Rect(rect.x0 - 2, rect.y0 - 2, page.rect.width - 36, rect.y1 + 3)
        page.add_redact_annot(redact_rect, fill=(1, 1, 1))
    page.apply_redactions()

    for rect, text in target_lines:
        new_text = transform(text)
        insert_rect = fitz.Rect(rect.x0, rect.y0 - 1, page.rect.width - 36, rect.y1 + 10)
        page.insert_textbox(
            insert_rect,
            new_text,
            fontsize=fontsize,
            fontname="hebo",
            color=(0, 0, 0),
            align=0,
        )
    return True


def _lowercase_printer_acxxel(page):
    matches = []
    for word in page.get_text("words"):
        text = word[4]
        lowered = re.sub(r"acxxel", "acxxel", text, flags=re.IGNORECASE)
        if lowered != text:
            matches.append((fitz.Rect(word[:4]), lowered))
    if not matches:
        return
    for area, _text in matches:
        page.add_redact_annot(
            fitz.Rect(area.x0 - 0.5, area.y0 - 0.5, area.x1 + 0.5, area.y1 + 0.5),
            fill=(1, 1, 1),
        )
    page.apply_redactions()
    for area, text in matches:
        fontsize = max(7, min(12, area.height * 0.82))
        page.insert_text(
            (area.x0, area.y1 - 1),
            text,
            fontsize=fontsize,
            fontname="hebo",
            color=(0, 0, 0),
        )


def _regex_replace_line_text(page, predicate, pattern, replacement, fontsize=10.5):
    return _rewrite_line_text(
        page,
        predicate,
        lambda text: re.sub(pattern, replacement, text, flags=re.IGNORECASE),
        fontsize=fontsize,
    )


def _printer_warranty_text(value):
    text = str(value or "").strip()
    if not text:
        return "standard warranty"
    if re.fullmatch(r"\d+", text):
        return f"{text} year" if text == "1" else f"{text} years"
    return text.lower()


def _rewrite_printer_warranty_paragraph(page, bid):
    warranty = _printer_warranty_text(
        bid.onsite_warranty or bid.extended_warranty
    )
    model_number = str(bid.model_number or "quoted model").strip()
    paragraph = (
        "This is to certify that Laps N Tabs Technology Pvt. Ltd. is the OEM of acxxel "
        "Printer Brand and will provide comprehensive warranty during entire standard "
        f"warranty period i.e. {warranty} for quoted acxxel Printer "
        f"{model_number}, if the said bid award to us."
    )
    para_rect = fitz.Rect(82, 314, page.rect.width - 42, 374)
    page.add_redact_annot(para_rect, fill=(1, 1, 1))
    page.apply_redactions()
    page.insert_textbox(
        para_rect,
        paragraph,
        fontsize=10.5,
        fontname="hebo",
        color=(0, 0, 0),
        align=0,
    )


def _rewrite_printer_oem_declaration(page):
    if "decleration of oem status on gem" not in page.get_text("text").lower():
        return

    body_rect = fitz.Rect(68, 252, page.rect.width - 62, 430)
    page.add_redact_annot(body_rect, fill=(1, 1, 1))
    page.apply_redactions()
    declaration = (
        "This is to certify and declare that M/S LAPS N TABS TECHNOLOGY PVT. LTD. is an MSME\n"
        "start-up engaged in manufacturing of A4 and Legal Size MFP under its own brand name\n"
        "\"acxxel\". It is also a registered OEM on GeM for the same name\n\n"
        "UdyogAadhar No./Udyam - UP50A0005900/UDYAM-UP-50-0003804\n\n"
        "DIPP No. - DIPP28252\n\n"
        "acxxel Brand Trademark No. - 1535583\n\n"
        "acxxel brand name is owned and trademarked by M/S LAPS N TABS TECHNOLOGY PRIVATE\n"
        "LIMITED."
    )
    page.insert_textbox(
        fitz.Rect(72, 257, page.rect.width - 72, 428),
        declaration,
        fontsize=10.5,
        fontname="hebo",
        color=(0, 0, 0),
        lineheight=1.15,
        align=0,
    )


def _rewrite_printer_service_intro(page):
    page_text = page.get_text("text").lower()
    if "escalation matrix below reference" not in page_text or "certifying that" not in page_text:
        return

    intro_rect = fitz.Rect(68, 190, page.rect.width - 36, 275)
    page.add_redact_annot(intro_rect, fill=(1, 1, 1))
    page.apply_redactions()
    page.insert_textbox(
        fitz.Rect(72, 204, page.rect.width - 50, 238),
        "This is certifying that acxxel Printers offers on-site comprehensive warranty "
        "as said in bid document.",
        fontsize=10.5,
        fontname="hebo",
        color=(0, 0, 0),
        lineheight=1.25,
        align=0,
    )
    page.insert_text(
        (72, 260),
        "Escalation matrix below reference:",
        fontsize=10.5,
        fontname="helv",
        color=(0, 0, 0),
    )


def _rewrite_printer_make_in_india(page, bid):
    # Replace the certificate introduction without constraining the longer printer text
    # to the narrow bounding box of the original desktop wording.
    _rewrite_line_text(
        page,
        lambda text: "desktop" in text.lower() and "desktop model" not in text.lower(),
        lambda text: re.sub(r"desktop", "PRINTER", text, flags=re.IGNORECASE),
        fontsize=10.5,
    )

    model_lines = []
    for block in page.get_text("dict").get("blocks", []):
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            text = " ".join(span.get("text", "") for span in line.get("spans", [])).strip()
            if "acxxel desktop model" in text.lower() or "acxxel printer model" in text.lower():
                model_lines.append(fitz.Rect(line["bbox"]))

    if not model_lines:
        return

    anchor = max(model_lines, key=lambda rect: rect.y0)
    block_rect = fitz.Rect(max(36, anchor.x0 - 2), anchor.y0 - 3, page.rect.width - 30, anchor.y0 + 52)
    page.add_redact_annot(block_rect, fill=(1, 1, 1))
    page.apply_redactions()

    model_number = str(bid.model_number or "quoted model").strip()
    x = anchor.x0
    page.insert_text((x, anchor.y0 + 10), f"acxxel PRINTER MODEL  {model_number}", fontsize=10.5, fontname="hebo", color=(0, 0, 0))
    page.insert_text((x, anchor.y0 + 25), "Manufacturing plant: Laps N Tabs Technology Private Limited C-187, Nirala Nagar", fontsize=9.5, fontname="helv", color=(0, 0, 0))
    page.insert_text((x, anchor.y0 + 40), "Lucknow-226020.", fontsize=10.5, fontname="hebo", color=(0, 0, 0))


def _rewrite_printer_preloaded_os_paragraph(page):
    lines = []
    for block in page.get_text("dict").get("blocks", []):
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            text = " ".join(span.get("text", "") for span in line.get("spans", [])).strip()
            if text:
                lines.append((fitz.Rect(line["bbox"]), text))

    paragraph_lines = [
        (rect, text) for rect, text in lines
        if "you may kindly take reference" in text.lower()
        or "acxxel make of desktop computer" in text.lower()
        or "microsoft windows 11 professional license" in text.lower()
    ]
    if not paragraph_lines:
        return

    paragraph_lines.sort(key=lambda item: item[0].y0)
    x0 = min(rect.x0 for rect, _text in paragraph_lines)
    y0 = paragraph_lines[0][0].y0
    please_line = next(
        (rect for rect, text in lines if text.lower().startswith("please do feel free") and rect.y0 > y0),
        None,
    )
    y1 = (please_line.y0 - 5) if please_line else (paragraph_lines[-1][0].y1 + 18)
    redraw_rect = fitz.Rect(x0 - 2, y0 - 3, page.rect.width - 35, y1)
    page.add_redact_annot(redraw_rect, fill=(1, 1, 1))
    page.apply_redactions()

    paragraph = (
        "You may kindly take reference of the above bid for procurement of A4 and legal size MFP. "
        "We hereby confirm that acxxel make of printer quoted by the above bid is offered with "
        "factory preloaded Microsoft Windows 11 Professional license."
    )
    page.insert_textbox(
        fitz.Rect(x0, y0, page.rect.width - 38, y1 + 2),
        paragraph,
        fontsize=10.2,
        fontname="hebo",
        color=(0, 0, 0),
        lineheight=1.25,
        align=0,
    )


def _post_process_printer_pdf(doc_type, output_path, bid=None):
    if not fitz or not os.path.exists(output_path):
        return

    doc = fitz.open(output_path)
    try:
        for page in doc:
            if doc_type == "warranty" and bid is not None:
                _rewrite_printer_warranty_paragraph(page, bid)
            elif doc_type == "manufacturer_auth":
                _rewrite_line_text(
                    page,
                    lambda text: (
                        "desktop and all in one" in text.lower()
                        or "all in one pc" in text.lower()
                        or "desktop computer" in text.lower()
                    ),
                    lambda text: re.sub(
                        r"\s+",
                        " ",
                        text
                        .replace("Acxxel Desktop and All in One", "acxxel A4 and legal size MFP")
                        .replace("ACXXEL Desktop and All in One", "acxxel A4 and legal size MFP")
                        .replace("Desktop and All in One", "A4 and legal size MFP")
                        .replace("desktop and all in one", "A4 and legal size MFP")
                        .replace("All in One PC", "A4 and legal size MFP")
                        .replace("all in one pc", "A4 and legal size MFP")
                        .replace("desktop computer", "printer")
                        .replace("Desktop Computer", "printer"),
                    ).strip(),
                )
                _rewrite_printer_oem_declaration(page)
            elif doc_type == "preloaded_os":
                _rewrite_printer_preloaded_os_paragraph(page)
            elif doc_type == "service_support":
                _rewrite_line_text(
                    page,
                    lambda text: "desktops" in text.lower(),
                    lambda text: re.sub(r"desktops", "Printers", text, flags=re.IGNORECASE),
                    fontsize=10.5,
                )
                _rewrite_printer_service_intro(page)
            elif doc_type == "make_in_india" and bid is not None:
                _rewrite_printer_make_in_india(page, bid)
            elif doc_type in {"approved_atc_documents", "approved_all_documents"}:
                page_text = page.get_text("text").lower()
                if bid is not None and "warranty period" in page_text:
                    _rewrite_printer_warranty_paragraph(page, bid)
                _rewrite_line_text(
                    page,
                    lambda text: (
                        "desktop and all in one" in text.lower()
                        or "all in one pc" in text.lower()
                        or "desktop computer" in text.lower()
                    ),
                    lambda text: re.sub(
                        r"\s+",
                        " ",
                        text
                        .replace("Acxxel Desktop and All in One", "acxxel A4 and legal size MFP")
                        .replace("ACXXEL Desktop and All in One", "acxxel A4 and legal size MFP")
                        .replace("Desktop and All in One", "A4 and legal size MFP")
                        .replace("desktop and all in one", "A4 and legal size MFP")
                        .replace("All in One PC", "A4 and legal size MFP")
                        .replace("all in one pc", "A4 and legal size MFP")
                        .replace("desktop computer", "printer")
                        .replace("Desktop Computer", "printer"),
                    ).strip(),
                )
                _rewrite_printer_oem_declaration(page)
                _rewrite_line_text(
                    page,
                    lambda text: "desktops" in text.lower(),
                    lambda text: re.sub(r"desktops", "Printers", text, flags=re.IGNORECASE),
                    fontsize=10.5,
                )
                _rewrite_printer_service_intro(page)
                _rewrite_printer_preloaded_os_paragraph(page)
                if bid is not None:
                    _rewrite_printer_make_in_india(page, bid)

            if doc_type in {"manufacturer_auth", "service_support"}:
                _lowercase_printer_acxxel(page)

        doc.saveIncr()
    finally:
        doc.close()


def _printer_pdf_value(value, default="Not Applicable"):
    text = str(value or "").strip()
    return default if text.lower() in {"", "na", "n/a", "none", "not applicable"} else text


def _printer_pdf_lines(text, width, fontsize=8.5):
    words = str(text or "").replace("\n", " ").split()
    if not words:
        return [""]
    lines = []
    current = words[0]
    for word in words[1:]:
        candidate = f"{current} {word}"
        if fitz.get_text_length(candidate, fontname="helv", fontsize=fontsize) <= width:
            current = candidate
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


def _printer_draw_cell(page, rect, text, bold=False, fontsize=8.5, padding=4):
    page.draw_rect(rect, color=(0, 0, 0), width=0.6)
    page.insert_textbox(
        fitz.Rect(rect.x0 + padding, rect.y0 + padding, rect.x1 - padding, rect.y1 - padding),
        str(text or ""),
        fontsize=fontsize,
        fontname="hebo" if bold else "helv",
        color=(0, 0, 0),
        lineheight=1.15,
    )


def _printer_recipient_text(bid):
    lines = ["To,"]
    if bid.dept_name:
        lines.append(str(bid.dept_name))
    if bid.organization:
        lines.append(str(bid.organization))
    address = str(bid.address or "").strip()
    pincode = str(bid.pincode or "").strip()
    if address or pincode:
        lines.append(f"{address}{' - ' if address and pincode else ''}{pincode}")
    return "\n".join(lines)


def _printer_description(bid):
    if "multifunction" in str(bid.printer_type or "").lower():
        return (
            "A4 and Legal size Multifunction Machine Printer with core function as "
            "Print, Scan and Copy with Power Cord/Adapter and connecting USB cable"
        )
    return (
        "A4 and Legal size Computer Printer with core function as Print with "
        "Power Cord/Adapter and connecting USB cable"
    )


def _printer_compliance_rows(bid):
    rows = [
        ("General Product Information", "Description of Stores", "A4 and Legal size Printer / Multifunction Printer", _printer_description(bid)),
        ("", "Printing Technology", "Inkjet, Electrophotography/Xerography (Laser/LED)", _printer_pdf_value(bid.printing_technology)),
        ("", "Cartridge Technology", "Separate Drum and Toner, Composite Cartridge", _printer_pdf_value(bid.cartridge_technology)),
        ("", "Type of Printing", "Monochrome, Colour", _printer_pdf_value(bid.type_of_printing)),
        ("", "Availability of Fax", "Yes, No", _printer_pdf_value(bid.fax_availability)),
        ("", "Operating System Compatibility", "Microsoft Windows, Linux, Mac OS, Microsoft Windows Server", _printer_pdf_value(bid.operating_system_compatibility)),
        ("Printing Performance", "Minimum Print Speed A4 Monochrome (Black) PPM for Laser/LED MFPs", "5 to 54 PPM", _printer_pdf_value(bid.mono_print_speed_ppm)),
        ("", "Minimum Print Speed A4 Colour PPM for Laser/LED MFPs", "Not Applicable, 5 to 54 PPM", _printer_pdf_value(bid.colour_print_speed_ppm)),
        ("Duplexing & Copying Features", "Auto Duplexing Printing/Copying (2-sided Feature)", "Yes, No", _printer_pdf_value(bid.auto_duplexing)),
        ("", "Reduction and Enlargement Feature", "Yes, No", _printer_pdf_value(bid.reduction_enlarge_features)),
        ("Scanning Capabilities", "Maximum Scan Area (Platen/ADF)", "A4, A4 and Legal", _printer_pdf_value(bid.max_scan_area)),
        ("", "A4 Scan Speed - Colour", "Not Applicable, 1 to 80", _printer_pdf_value(bid.a4_scan_speed_colour)),
        ("", "Scan To Functions", "Folder, Email, Scan to Local Computer", _printer_pdf_value(bid.scan_to_functions)),
        ("Document and Paper Handling", "Original Document Feeder Type", "Platen, ADF, RADF/DADF, SDF", _printer_pdf_value(bid.document_feeder_type)),
        ("", "Feeder Capacity (Number of Sheets)", "1 to 300", _printer_pdf_value(bid.feeder_capacity)),
        ("", "Number of Main Paper Tray", "1, 2, 3, 4", _printer_pdf_value(bid.main_paper_tray_count)),
        ("", "Total Main Paper Tray Combined Capacity at 75 GSM", "50 to 3000", _printer_pdf_value(bid.total_paper_tray_capacity)),
        ("", "Bypass Tray Facility", "Yes, No", _printer_pdf_value(bid.bypass_tray_facility)),
        ("", "Bypass Tray Capacity at 75 GSM", "1 to 499", _printer_pdf_value(bid.bypass_tray_capacity)),
        ("Connectivity and Reliability", "Connectivity", "USB Port, Ethernet, Wi-Fi", _printer_pdf_value(bid.connectivity)),
        ("", "Duty Cycle (Prints/Month)", "1,000 to 1,99,999", _printer_pdf_value(bid.duty_cycle)),
        ("Certification and Warranty", "On Site Warranty (in Year)", "1 or higher", _printer_pdf_value(bid.onsite_warranty)),
        ("", "Extended Warranty over standard warranty", "Not Applicable, 1 to 5", _printer_pdf_value(bid.extended_warranty)),
    ]
    if "multifunction" not in str(bid.printer_type or "").lower():
        multifunction_titles = {
            "Availability of Fax",
            "Reduction and Enlargement Feature",
            "Maximum Scan Area (Platen/ADF)",
            "A4 Scan Speed - Colour",
            "Scan To Functions",
            "Original Document Feeder Type",
            "Feeder Capacity (Number of Sheets)",
        }
        rows = [row for row in rows if row[1] not in multifunction_titles]
    return rows


def _generate_printer_spec_pdf(request, bid, doc_type):
    is_compliance = doc_type == "technical_compliance"
    rows = _printer_compliance_rows(bid)
    if not is_compliance:
        rows = [(section, title, offered) for section, title, _allowed, offered in rows]

    doc = fitz.open()
    letterhead_doc = None
    letterhead_image = None
    signature_image = None
    letterhead_path = os.path.join(settings.BASE_DIR, "media", "templates", "documents.pdf")
    if os.path.exists(letterhead_path):
        letterhead_doc = fitz.open(letterhead_path)
        source_page = 5 if len(letterhead_doc) > 5 else 0
        source = letterhead_doc[source_page]
        letterhead_image = source.get_pixmap(
            matrix=fitz.Matrix(2, 2),
            clip=fitz.Rect(0, 0, source.rect.width, 110),
            alpha=False,
        ).tobytes("png")
        source_images = source.get_images(full=True)
        if len(source_images) > 1:
            signature_image = letterhead_doc.extract_image(source_images[1][0]).get("image")
    page_width, page_height = 595, 842
    margin, bottom = 54, 72
    model = str(bid.model_number or "").strip() or "Not Assigned"
    date_text = bid.date.isoformat() if bid.date else ""
    title = (
        f"SUBJECT: COMPLIANCE OF BOQ SPECIFICATION ({model})"
        if is_compliance
        else f"SUBJECT: DATA SHEET OF acxxel PRINTER ({model})"
    )
    widths = [105, 145, 145, 92] if is_compliance else [135, 235, 117]

    def new_page(first=False):
        page = doc.new_page(width=page_width, height=page_height)
        if letterhead_image:
            page.insert_image(
                fitz.Rect(18, 12, page_width - 18, 112),
                stream=letterhead_image,
                keep_proportion=False,
            )
        y = 130
        if first:
            page.insert_textbox(fitz.Rect(margin, y, page_width - margin, y + 95), _printer_recipient_text(bid), fontsize=10, fontname="hebo", lineheight=1.25)
            y += 105
            page.insert_text((margin, y), f"Tender No: {bid.bid_no or ''}    Dated: {date_text}", fontsize=9.5, fontname="hebo")
            y += 30
            page.insert_textbox(fitz.Rect(margin, y, page_width - margin, y + 35), title, fontsize=11, fontname="hebo")
            y += 42
        else:
            y = 130
        headers = ["Specification", "Title", "Allowed Values", "Offered Values"] if is_compliance else ["Specification", "Title", "Offered Values"]
        x = margin
        for header, width in zip(headers, widths):
            _printer_draw_cell(page, fitz.Rect(x, y, x + width, y + 28), header, bold=True, fontsize=8.5)
            x += width
        return page, y + 28

    page, y = new_page(first=True)
    for row in rows:
        line_counts = [len(_printer_pdf_lines(value, width - 8)) for value, width in zip(row, widths)]
        height = max(30, max(line_counts) * 10 + 10)
        if y + height > page_height - bottom:
            page, y = new_page(first=False)
        x = margin
        for index, (value, width) in enumerate(zip(row, widths)):
            _printer_draw_cell(page, fitz.Rect(x, y, x + width, y + height), value, bold=(index == 0 and bool(value)), fontsize=8.2)
            x += width
        y += height

    if y + 155 > page_height - 35:
        page = doc.new_page(width=page_width, height=page_height)
        y = 70
    else:
        y += 25
    page.insert_textbox(
        fitz.Rect(margin, y, page_width - margin, y + 35),
        "Auth. Signatory\nFor Laps N Tabs Technology Pvt. Ltd.",
        fontsize=9,
        fontname="hebo",
        lineheight=1.2,
    )
    if signature_image:
        page.insert_image(
            fitz.Rect(margin, y + 30, margin + 182, y + 82),
            stream=signature_image,
            keep_proportion=False,
        )
    page.insert_textbox(
        fitz.Rect(margin, y + 85, page_width - margin, y + 145),
        "Name:- Devank Rastogi\nDesignation:- Director\n"
        "Email:- lapsntabs123@gmail.com\nContact No.:- 9918200166",
        fontsize=9,
        fontname="hebo",
        lineheight=1.2,
    )

    output_dir = os.path.join("media", "generated")
    os.makedirs(output_dir, exist_ok=True)
    output_filename = f"bid_{bid.id}_{doc_type}.pdf"
    output_path = os.path.join(output_dir, output_filename)
    doc.save(output_path)
    doc.close()
    if letterhead_doc:
        letterhead_doc.close()
    return JsonResponse({
        "success": True,
        "pdf_url": request.build_absolute_uri(f"/media/generated/{output_filename}"),
        "message": f"{doc_type} certificate generated successfully",
    })


class _PrinterDesktopBidAdapter:
    def __init__(self, bid):
        connectivity = (bid.connectivity or "").lower()
        self.id = bid.id
        self.user = bid.user
        self.bid_no = bid.bid_no
        self.dept_name = bid.dept_name
        self.organization = bid.organization
        self.qty = bid.qty
        self.address = bid.address
        self.pincode = bid.pincode
        self.atc = bid.atc
        self.date = bid.date
        self.model_number = bid.model_number
        self.local_content = bid.local_content or ""
        self.selected_general_docs = bid.selected_general_docs or []
        self.selected_general_doc_labels = bid.selected_general_doc_labels or []
        self.review_status = bid.review_status
        self.status = bid.status
        self.created_at = bid.created_at
        self.updated_at = bid.updated_at
        self.atc_special_document = bid.atc_special_document

        self.processor = bid.printer_type or bid.type_of_printing or ""
        self.pro_descp = bid.extra_requirements or ""
        self.ram = ""
        self.hdd = ""
        self.ssd1 = ""
        self.ssd2 = ""
        self.os = bid.operating_system_compatibility or ""
        self.dvd = ""
        self.wifi = "Yes" if "wi-fi" in connectivity or "wifi" in connectivity else ""
        self.monitor = ""
        self.cabinet = ""
        self.keyboard = ""
        self.warranty = bid.onsite_warranty or bid.extended_warranty or ""
        self.motherboard = bid.cartridge_technology or ""
        self.motherboard_descp = bid.document_feeder_type or ""
        self.software1 = bid.scan_to_functions or ""
        self.gp = ""
        self.epbg = bid.epbg
        self.freightInstallation = bid.freightInstallation
        self.freightInstallation_price = 0
        self.total_price = bid.final_amount or 0
        self.hddreturnable = "No"
        self.hddreturnable_price = 0
        self.optional_ports = ""

    def __getattr__(self, _name):
        return ""


@csrf_exempt
@require_http_methods(["POST"])
def generate_printer_certificates(request, bid_id):
    try:
        bid = PrinterBid.objects.get(id=bid_id)
    except PrinterBid.DoesNotExist:
        return JsonResponse({"error": "Bid not found"}, status=404)

    try:
        request_data = json.loads(request.body or b"{}")
        requested_doc_type = request_data.get("doc_type", "")
    except (TypeError, ValueError):
        requested_doc_type = ""

    if requested_doc_type in {"technical_compliance", "data_sheet"}:
        return _generate_printer_spec_pdf(request, bid, requested_doc_type)

    adapter = _PrinterDesktopBidAdapter(bid)
    original_get = desktop_views.DesktopBid.objects.get

    def _mock_get(*args, **kwargs):
        return adapter

    desktop_views.DesktopBid.objects.get = _mock_get
    try:
        response = desktop_views.generate_certificates(request, bid_id)
        try:
            request_data = json.loads(request.body or b"{}")
            doc_type = request_data.get("doc_type", "")
        except (TypeError, ValueError):
            doc_type = ""

        if getattr(response, "status_code", 500) == 200 and doc_type:
            output_filenames = {
                "approved_price_paper": f"bid_{bid_id}_price_approved.pdf",
                "approved_all_documents": f"bid_{bid_id}_all_approved_documents.pdf",
            }
            output_path = os.path.join(
                "media", "generated", output_filenames.get(doc_type, f"bid_{bid_id}_{doc_type}.pdf")
            )
            _post_process_printer_pdf(doc_type, output_path, bid=bid)
        return response
    finally:
        desktop_views.DesktopBid.objects.get = original_get






@csrf_exempt
@require_http_methods(["POST"])
def create_printer_bid(request):
    try:
        data = request.POST
        user_id  = data.get("user_id")
        username = data.get("username", "")

        print(f"🔍 Received user_id: {user_id}, username: {username}")

        if not user_id and not username:
            return JsonResponse({"error": "User ID or username is required."}, status=400)

        user = None

        if user_id:
            try:
                user = User.objects.get(id=user_id)
                print(f"✅ User found by ID: {user.username}")
            except (User.DoesNotExist, ValueError):
                print(f"⚠️ User ID {user_id} not found, trying username...")

        if not user and username:
            try:
                user = User.objects.get(username=username)
                print(f"✅ User found by username: {user.username}")
            except User.DoesNotExist:
                pass

        if not user:
            return JsonResponse({
                "error": f"User not found. ID: {user_id}, Username: {username}",
                "hint": "Please log out and sign in again."
            }, status=404)

        bid = PrinterBid.objects.create(
            user          = user,
            bid_no        = data.get("bid_no", ""),
            dept_name     = data.get("dept_name", ""),
            organization  = data.get("organization", ""),
            qty           = int(data.get("qty", 0) or 0),
            address       = data.get("address", ""),
            pincode       = data.get("pincode", ""),
            atc           = data.get("atc", ""),
            printer_type  = data.get("printer_type", "Printer"),
            status        = "draft",
            review_status = "pending",
            date          = "2000-01-01",
            selected_general_docs       = [],
            selected_general_doc_labels = [],
        )

        return JsonResponse({
            "message"      : "Printer Bid Created Successfully",
            "bid_id"       : bid.id,
            "user"         : user.username,
            "status"       : bid.status,
            "review_status": bid.review_status,
        }, status=201)

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return JsonResponse({"error": str(e)}, status=400)






@csrf_exempt
@require_http_methods(["POST"])
def update_printer_bid(request, bid_id):
    try:
        try:
            bid = PrinterBid.objects.get(id=bid_id)
        except PrinterBid.DoesNotExist:
            return JsonResponse({"error": f"Bid ID {bid_id} not found"}, status=404)

        data = json.loads(request.body)


        bid.printing_technology = data.get("printing_technology", bid.printing_technology or "")
        bid.cartridge_technology = data.get("cartridge_technology", bid.cartridge_technology or "")
        bid.type_of_printing = data.get("type_of_printing", bid.type_of_printing or "")
        bid.fax_availability = data.get("fax_availability", bid.fax_availability or "No")
        bid.operating_system_compatibility = data.get(
            "operating_system_compatibility",
            bid.operating_system_compatibility or "",
        )


        bid.mono_print_speed_ppm   = data.get("mono_print_speed_ppm",   bid.mono_print_speed_ppm or "")
        bid.mono_print_speed_ipm   = data.get("mono_print_speed_ipm",   bid.mono_print_speed_ipm or "")
        bid.colour_print_speed_ppm = data.get("colour_print_speed_ppm", bid.colour_print_speed_ppm or "")
        bid.colour_print_speed_ipm = data.get("colour_print_speed_ipm", bid.colour_print_speed_ipm or "")


        bid.auto_duplexing = data.get("auto_duplexing", bid.auto_duplexing or "Yes")
        bid.reduction_enlarge_features = data.get(
            "reduction_enlarge_features",
            bid.reduction_enlarge_features or "",
        )
        bid.printer_type = data.get("printer_type", bid.printer_type or "")


        bid.max_scan_area     = data.get("max_scan_area",     bid.max_scan_area or "")
        bid.a4_scan_speed_colour = data.get(
            "a4_scan_speed_colour",
            bid.a4_scan_speed_colour or "",
        )
        bid.scan_to_functions = data.get("scan_to_functions", bid.scan_to_functions or "")


        bid.document_feeder_type      = data.get("document_feeder_type",      bid.document_feeder_type or "")
        bid.feeder_capacity           = data.get("feeder_capacity",           bid.feeder_capacity or "")
        bid.main_paper_tray_count     = data.get("main_paper_tray_count",     bid.main_paper_tray_count or "")
        bid.total_paper_tray_capacity = data.get("total_paper_tray_capacity", bid.total_paper_tray_capacity or "")
        bid.bypass_tray_facility      = data.get("bypass_tray_facility",      bid.bypass_tray_facility or "")
        bid.bypass_tray_capacity      = data.get("bypass_tray_capacity",      bid.bypass_tray_capacity or "")


        bid.connectivity = data.get("connectivity", bid.connectivity or "")
        bid.duty_cycle   = data.get("duty_cycle",   bid.duty_cycle or "")


        bid.onsite_warranty   = data.get("onsite_warranty",   bid.onsite_warranty or "")
        bid.extended_warranty = data.get("extended_warranty", bid.extended_warranty or "")


        bid.extra_requirements = data.get("extra_requirements", bid.extra_requirements or "")
        bid.software1      = data.get("software1",      bid.software1 or "")


        bid.date = data.get("date") or bid.date
        bid.epbg = float(data.get("epbg", 0) or 0)

        bid.freightInstallation = data.get("freightInstallation", bid.freightInstallation or "Yes")

        bid.status = "configured"
        bid.save()

        return JsonResponse({
            "message": "Printer Specs Saved Successfully",
            "bid_id" : bid.id,
            "status" : bid.status,
        }, status=200)

    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON body"}, status=400)
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return JsonResponse({"error": str(e)}, status=400)


def _printer_bid_data(bid, request, status_label=None):
    user_name = bid.user.username if bid.user else ""
    return {
        "id": bid.id,
        "bid_id": bid.id,
        "bid_no": bid.bid_no,
        "dept_name": bid.dept_name,
        "organization": bid.organization or "",
        "qty": bid.qty,
        "address": bid.address,
        "pincode": bid.pincode,
        "atc": bid.atc or "",
        "local_content": bid.local_content or "",
        "submitted_by": user_name,
        "user_name": user_name,
        "status": status_label or bid.review_status,
        "review_status": bid.review_status,
        "created_at": bid.created_at.isoformat() if bid.created_at else "",
        "updated_at": bid.updated_at.isoformat() if bid.updated_at else "",
        "atc_special_document": _file_url(request, bid.atc_special_document),
        "selected_general_docs": bid.selected_general_docs or [],
        "selected_general_doc_labels": bid.selected_general_doc_labels or [],
        "printing_technology": bid.printing_technology or "",
        "cartridge_technology": bid.cartridge_technology or "",
        "type_of_printing": bid.type_of_printing or "",
        "fax_availability": bid.fax_availability or "No",
        "operating_system_compatibility": bid.operating_system_compatibility or "",
        "mono_print_speed_ppm": bid.mono_print_speed_ppm or "",
        "mono_print_speed_ipm": bid.mono_print_speed_ipm or "",
        "colour_print_speed_ppm": bid.colour_print_speed_ppm or "",
        "colour_print_speed_ipm": bid.colour_print_speed_ipm or "",
        "auto_duplexing": bid.auto_duplexing or "Yes",
        "reduction_enlarge_features": bid.reduction_enlarge_features or "",
        "printer_type": bid.printer_type or "",
        "max_scan_area": bid.max_scan_area or "",
        "a4_scan_speed_colour": bid.a4_scan_speed_colour or "",
        "scan_to_functions": bid.scan_to_functions or "",
        "document_feeder_type": bid.document_feeder_type or "",
        "feeder_capacity": bid.feeder_capacity or "",
        "main_paper_tray_count": bid.main_paper_tray_count or "",
        "total_paper_tray_capacity": bid.total_paper_tray_capacity or "",
        "bypass_tray_facility": bid.bypass_tray_facility or "",
        "bypass_tray_capacity": bid.bypass_tray_capacity or "",
        "connectivity": bid.connectivity or "",
        "duty_cycle": bid.duty_cycle or "",
        "onsite_warranty": bid.onsite_warranty or "",
        "extended_warranty": bid.extended_warranty or "",
        "extra_requirements": bid.extra_requirements or "",
        "software1": bid.software1 or "",
        "date": bid.date.isoformat() if bid.date else "",
        "epbg": bid.epbg,
        "freightInstallation": bid.freightInstallation or "Yes",
        "model_number": bid.model_number or "",
        "final_amount": bid.final_amount,
        "special_terms": bid.special_terms or "",
        "bid_status": bid.bid_status or "",
        "remarks": bid.remarks or "",
        "analyser_note": bid.analyser_note or "",
        "analyser_username": bid.analyser_username or "",
        "analyser_display_name": bid.analyser_username or user_name,
        "admin_note": bid.admin_note or "",
        "admin_username": bid.admin_username or "",
    }


def _apply_printer_payload(bid, data):
    bid.bid_no = data.get("bid_no", bid.bid_no)
    bid.dept_name = data.get("dept_name", bid.dept_name)
    bid.organization = data.get("organization", bid.organization)
    bid.address = data.get("address", bid.address)
    bid.pincode = data.get("pincode", bid.pincode)
    bid.atc = data.get("atc", bid.atc)
    if data.get("qty"):
        bid.qty = int(data.get("qty"))
    bid.model_number = data.get("model_number") or data.get("model") or bid.model_number
    bid.printing_technology = data.get("printing_technology", bid.printing_technology)
    bid.cartridge_technology = data.get("cartridge_technology", bid.cartridge_technology)
    bid.type_of_printing = data.get("type_of_printing", bid.type_of_printing)
    bid.fax_availability = data.get("fax_availability", bid.fax_availability)
    bid.operating_system_compatibility = data.get(
        "operating_system_compatibility",
        bid.operating_system_compatibility,
    )
    bid.mono_print_speed_ppm = data.get("mono_print_speed_ppm", bid.mono_print_speed_ppm)
    bid.mono_print_speed_ipm = data.get("mono_print_speed_ipm", bid.mono_print_speed_ipm)
    bid.colour_print_speed_ppm = data.get("colour_print_speed_ppm", bid.colour_print_speed_ppm)
    bid.colour_print_speed_ipm = data.get("colour_print_speed_ipm", bid.colour_print_speed_ipm)
    bid.auto_duplexing = data.get("auto_duplexing", bid.auto_duplexing)
    bid.reduction_enlarge_features = data.get(
        "reduction_enlarge_features",
        bid.reduction_enlarge_features,
    )
    bid.printer_type = data.get("printer_type", bid.printer_type)
    bid.max_scan_area = data.get("max_scan_area", bid.max_scan_area)
    bid.a4_scan_speed_colour = data.get("a4_scan_speed_colour", bid.a4_scan_speed_colour)
    bid.scan_to_functions = data.get("scan_to_functions", bid.scan_to_functions)
    bid.document_feeder_type = data.get("document_feeder_type", bid.document_feeder_type)
    bid.feeder_capacity = data.get("feeder_capacity", bid.feeder_capacity)
    bid.main_paper_tray_count = data.get("main_paper_tray_count", bid.main_paper_tray_count)
    bid.total_paper_tray_capacity = data.get("total_paper_tray_capacity", bid.total_paper_tray_capacity)
    bid.bypass_tray_facility = data.get("bypass_tray_facility", bid.bypass_tray_facility)
    bid.bypass_tray_capacity = data.get("bypass_tray_capacity", bid.bypass_tray_capacity)
    bid.connectivity = data.get("connectivity", bid.connectivity)
    bid.duty_cycle = data.get("duty_cycle", bid.duty_cycle)
    bid.onsite_warranty = data.get("onsite_warranty", bid.onsite_warranty)
    bid.extended_warranty = data.get("extended_warranty", bid.extended_warranty)
    bid.extra_requirements = data.get("extra_requirements", bid.extra_requirements)
    bid.software1 = data.get("software1", bid.software1)
    if data.get("date"):
        bid.date = data.get("date")
    bid.epbg = safe_float(data.get("epbg"), bid.epbg)
    bid.freightInstallation = data.get("freightInstallation", bid.freightInstallation)
    bid.local_content = str(data.get("local_content", bid.local_content) or "").strip().rstrip("%")
    bid.final_amount = safe_float(data.get("final_amount"), bid.final_amount)
    bid.special_terms = data.get("special_terms", bid.special_terms)
    bid.bid_status = data.get("bid_status", bid.bid_status)
    bid.remarks = data.get("remarks", bid.remarks)
    bid.analyser_note = data.get("analyser_note") or data.get("remark") or bid.analyser_note


@csrf_exempt
@require_http_methods(["POST"])
def save_printer_model_number(request, bid_id):
    try:
        bid = PrinterBid.objects.get(id=bid_id)
        data = json.loads(request.body or "{}")
        model_number = _get_model_number_from_data(data)
        if not model_number:
            return JsonResponse({"error": "Model number required"}, status=400)

        model_number = model_number.strip()
        catalogue_product = CatalogueProduct.objects.filter(model_no__iexact=model_number).first()
        bid.model_number = model_number
        if bid.status not in ["complete", "approved"]:
            bid.status = "configured"
            bid.review_status = "pending"
        bid.save()

        return JsonResponse({
            "success": True,
            "bid_id": bid.id,
            "model_number": bid.model_number,
            "model": bid.model_number,
            "product_id": catalogue_product.id if catalogue_product else None,
            "source": "catalogue" if catalogue_product else "bid",
            "status": bid.status,
            "review_status": bid.review_status,
        }, status=200)
    except PrinterBid.DoesNotExist:
        return JsonResponse({"error": "Bid not found"}, status=404)
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=400)


@csrf_exempt
@require_http_methods(["POST"])
def match_printer_catalogue_models(request, bid_id):
    try:
        bid = PrinterBid.objects.get(id=bid_id)
    except PrinterBid.DoesNotExist:
        return JsonResponse({"error": "Bid not found"}, status=404)

    body = _body_json(request)
    bid_specs = {
        "printing_technology": _value_from_body_or_bid(body, bid, "printing_technology"),
        "cartridge_technology": _value_from_body_or_bid(body, bid, "cartridge_technology"),
        "type_of_printing": _value_from_body_or_bid(body, bid, "type_of_printing"),
        "fax_availability": _value_from_body_or_bid(body, bid, "fax_availability"),
        "operating_system_compatibility": _value_from_body_or_bid(body, bid, "operating_system_compatibility"),
        "mono_print_speed_ppm": _value_from_body_or_bid(body, bid, "mono_print_speed_ppm"),
        "colour_print_speed_ppm": _value_from_body_or_bid(body, bid, "colour_print_speed_ppm"),
        "auto_duplexing": _value_from_body_or_bid(body, bid, "auto_duplexing"),
        "reduction_enlarge_features": _value_from_body_or_bid(body, bid, "reduction_enlarge_features"),
        "printer_type": _value_from_body_or_bid(body, bid, "printer_type"),
        "max_scan_area": _value_from_body_or_bid(body, bid, "max_scan_area"),
        "a4_scan_speed_colour": _value_from_body_or_bid(body, bid, "a4_scan_speed_colour"),
        "scan_to_functions": _value_from_body_or_bid(body, bid, "scan_to_functions"),
        "document_feeder_type": _value_from_body_or_bid(body, bid, "document_feeder_type"),
        "feeder_capacity": _value_from_body_or_bid(body, bid, "feeder_capacity"),
        "main_paper_tray_count": _value_from_body_or_bid(body, bid, "main_paper_tray_count"),
        "total_paper_tray_capacity": _value_from_body_or_bid(body, bid, "total_paper_tray_capacity"),
        "bypass_tray_facility": _value_from_body_or_bid(body, bid, "bypass_tray_facility"),
        "bypass_tray_capacity": _value_from_body_or_bid(body, bid, "bypass_tray_capacity"),
        "connectivity": _value_from_body_or_bid(body, bid, "connectivity"),
        "duty_cycle": _value_from_body_or_bid(body, bid, "duty_cycle"),
        "onsite_warranty": _value_from_body_or_bid(body, bid, "onsite_warranty"),
        "extended_warranty": _value_from_body_or_bid(body, bid, "extended_warranty"),
    }

    # Capacity is not applicable when the bid has no bypass tray. Older bids
    # could save a capacity range alongside "No", which incorrectly prevented
    # an otherwise exact catalogue match.
    if _printer_semantic_value(
        "bypass_tray_facility", bid_specs["bypass_tray_facility"]
    ) == "no":
        bid_specs["bypass_tray_capacity"] = "NA"

    printer_field_map = {
        "printing_technology": "printing_technology",
        "cartridge_technology": "cartridge_technology",
        "type_of_printing": "type_of_printing",
        "fax_availability": "fax_availability",
        # OS compatibility is informational and must not affect catalogue matching.
        "mono_print_speed_ppm": "mono_print_speed_ppm",
        "colour_print_speed_ppm": "colour_print_speed_ppm",
        "auto_duplexing": "auto_duplexing",
        "reduction_enlarge_features": "reduction_enlarge_features",
        "printer_type": "printer_type",
        "max_scan_area": "max_scan_area",
        "a4_scan_speed_colour": "a4_scan_speed_colour",
        "document_feeder_type": "document_feeder_type",
        "feeder_capacity": "feeder_capacity",
        "main_paper_tray_count": "main_paper_tray_count",
        "total_paper_tray_capacity": "total_paper_tray_capacity",
        "bypass_tray_facility": "bypass_tray_facility",
        "bypass_tray_capacity": "bypass_tray_capacity",
        "connectivity": "connectivity",
        "duty_cycle": "duty_cycle",
        # On-site warranty is informational and must not affect catalogue matching.
        "extended_warranty": "extended_warranty",
    }

    results = []
    debug_all = []

    for product in _load_printer_catalogue():
        matched_count = 0
        checked_count = 0
        total_score = 0
        details = []
        for bid_key, product_key in printer_field_map.items():
            bid_value = bid_specs.get(bid_key, "")
            if _printer_bid_is_unspecified(bid_value):
                continue
            catalogue_value = product.get(product_key, "")
            if not str(catalogue_value or "").strip() and _printer_semantic_value(bid_key, bid_value) == "na":
                matched, score = True, 100
            else:
                matched, score = _printer_catalogue_match_value(bid_value, catalogue_value, bid_key)
            checked_count += 1
            if matched:
                matched_count += 1
                total_score += max(float(score or 0), 0)
            else:
                total_score += max(float(score or 0), 0) * 0.25
            details.append({
                "field": bid_key,
                "bid_value": bid_value,
                "matched": bool(matched),
                "catalogue_key": product_key,
                "catalogue_value": catalogue_value,
                "score": score,
            })
        if checked_count == 0:
            continue
        is_perfect = checked_count >= 6 and matched_count == checked_count
        result = {
            "model_no": product["model_no"],
            "product_id": product["id"],
            "bid_id": None,
            "source": "printer_excel",
            "category": product["category"],
            "match_count": matched_count,
            "total_checked": checked_count,
            "total_score": round(total_score, 2),
            "is_perfect": is_perfect,
            "debug_details": details,
        }
        results.append(result)
        debug_all.append(result)

    perfect_results = [result for result in results if result["is_perfect"]]
    if not perfect_results:
        debug_all.sort(key=lambda item: (-item["match_count"], -item["total_score"], item["model_no"]))
        return JsonResponse({
            "match": None,
            "matches": [],
            "total_found": 0,
            "has_perfect_match": False,
            "message": "No 100% accurate model match found. Please recheck your specs and create another bid if needed.",
            "bid_specs_used": bid_specs,
            "best_failed_match": debug_all[0] if debug_all else None,
        }, status=200)

    perfect_results.sort(key=lambda item: (-item["match_count"], -item["total_score"], item["model_no"]))
    best = perfect_results[0]
    best_public = {
        "model_no": best["model_no"],
        "product_id": best["product_id"],
        "bid_id": best["bid_id"],
        "source": best["source"],
        "category": best["category"],
    }
    return JsonResponse({
        "match": best_public,
        "matches": [best_public],
        "total_found": 1,
        "has_perfect_match": True,
        "message": "100% accurate matching model found.",
        "bid_specs_used": bid_specs,
    }, status=200)


@require_http_methods(["GET"])
def list_printer_catalogue_products(request):
    search = (request.GET.get("search") or "").strip().lower()
    products = _load_printer_catalogue()
    if search:
        products = [
            product for product in products
            if search in product["model_no"].lower() or search in product["description"].lower()
        ]
    return JsonResponse(products, safe=False, status=200)


@require_http_methods(["GET"])
def list_printer_bids(request):
    try:
        status_filter = request.GET.get("status", "pending")
        role = request.GET.get("role", "analyser")
        if role == "admin":
            db_status = {"pending": "reviewed", "re-analyze": "re-analyze", "approved": "approved"}.get(status_filter, "reviewed")
            bids = PrinterBid.objects.filter(status="complete", review_status=db_status).order_by("-updated_at")
        elif status_filter == "reviewed":
            bids = PrinterBid.objects.filter(status="complete", review_status__in=["reviewed", "approved"]).order_by("-created_at")
        else:
            bids = PrinterBid.objects.filter(status="complete", review_status=status_filter).order_by("-created_at")
        return JsonResponse([_printer_bid_data(bid, request, status_filter) for bid in bids], safe=False)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


@csrf_exempt
@require_http_methods(["GET"])
def get_printer_bid(request, bid_id):
    try:
        return JsonResponse(_printer_bid_data(PrinterBid.objects.get(id=bid_id), request))
    except PrinterBid.DoesNotExist:
        return JsonResponse({"error": "Bid not found"}, status=404)


@csrf_exempt
@require_http_methods(["PATCH"])
def review_printer_bid(request, bid_id):
    try:
        bid = PrinterBid.objects.get(id=bid_id)
        data = json.loads(request.body)
        _apply_printer_payload(bid, data)
        analyser_username = (data.get("analyser_username") or data.get("username") or "").strip()
        if analyser_username:
            bid.analyser_username = analyser_username
        bid.status = "complete"
        bid.review_status = "pending"
        bid.save()
        return JsonResponse({"success": True, "bid_id": bid.id, "review_status": bid.review_status})
    except PrinterBid.DoesNotExist:
        return JsonResponse({"error": "Bid not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


@csrf_exempt
@require_http_methods(["PATCH"])
def admin_review_printer_bid(request, bid_id):
    try:
        bid = PrinterBid.objects.get(id=bid_id)
        data = request.POST if request.content_type and request.content_type.startswith("multipart/form-data") else json.loads(request.body)
        action = data.get("status", "")
        if action not in ("approved", "re-analyze"):
            return JsonResponse({"error": "Invalid status."}, status=400)
        final_amount = safe_float(data.get("final_amount"), bid.final_amount)
        if action == "approved" and final_amount <= 0:
            return JsonResponse(
                {"error": "Please enter a valid Final Price before approving the bid."},
                status=400,
            )
        _apply_printer_payload(bid, data)
        bid.review_status = action
        bid.admin_note = data.get("admin_note", "").strip()
        bid.admin_username = data.get("admin_username", "").strip()
        bid.save()
        return JsonResponse({"success": True, "bid_id": bid.id, "review_status": bid.review_status})
    except PrinterBid.DoesNotExist:
        return JsonResponse({"error": "Bid not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


@csrf_exempt
@require_http_methods(["DELETE"])
def delete_printer_bid(request, bid_id):
    try:
        bid = PrinterBid.objects.filter(id=bid_id).first()
        if not bid:
            return JsonResponse({"error": "Bid not found"}, status=404)
        bid.delete()
        return JsonResponse({"message": "Printer bid deleted successfully"}, status=200)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


@csrf_exempt
@require_http_methods(["POST"])
def update_printer_docs(request, bid_id):
    try:
        bid = PrinterBid.objects.get(id=bid_id)
        if "atc_special_document" in request.FILES:
            uploaded_file = request.FILES["atc_special_document"]
            bid.atc_special_document = uploaded_file
        analyser_username = request.POST.get("analyser_username", "").strip()
        selected_general_docs = _parse_json_list(request.POST.get("selected_general_docs", ""))
        selected_general_labels = _parse_json_list(request.POST.get("selected_general_doc_labels", ""))
        selected_analyser_docs = _parse_json_list(request.POST.get("selected_analyser_docs", ""))
        selected_analyser_labels = _parse_json_list(request.POST.get("selected_analyser_doc_labels", ""))
        if analyser_username or selected_analyser_docs or selected_analyser_labels:
            bid.selected_general_docs = list(dict.fromkeys((bid.selected_general_docs or []) + selected_analyser_docs))
            bid.selected_general_doc_labels = list(dict.fromkeys((bid.selected_general_doc_labels or []) + selected_analyser_labels))
            bid.analyser_username = analyser_username or bid.analyser_username
            bid.status = "complete"
            bid.review_status = "reviewed"
        else:
            bid.selected_general_docs = selected_general_docs
            bid.selected_general_doc_labels = selected_general_labels
            bid.status = "complete"
            bid.review_status = "pending"
        model_number = (request.POST.get("model_number") or request.POST.get("model") or "").strip()
        if model_number:
            bid.model_number = model_number
        bid.save()
        return JsonResponse({
            "success": True,
            "bid_id": bid.id,
            "status": bid.status,
            "review_status": bid.review_status,
            "atc_special_document": _file_url(request, bid.atc_special_document),
            "selected_general_docs": bid.selected_general_docs or [],
            "selected_general_doc_labels": bid.selected_general_doc_labels or [],
        })
    except PrinterBid.DoesNotExist:
        return JsonResponse({"error": "Bid not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


# ---------------------------------------------------------------------------
# GeM extension autofill payload (plumbing only)
#
# TODO(gem-fields): The keys inside `specifications` below reuse this app's
# own internal field labels (same as PrinterConfig.jsx / _printer_bid_data).
# They have NOT been verified against the live GeM "Printer / Multifunction
# Printer" category technical-evaluation form. Before the Chrome extension
# can actually autofill a Printer bid on GeM, someone needs to open an
# approved Printer bid on bidplus.gem.gov.in and confirm each field's exact
# label + accepted option text (the way `_desktop_gem_payload` in Desktop.py
# already does for Desktop), then adjust the keys/values here to match.
# ---------------------------------------------------------------------------
def _printer_gem_payload(bid, request, account):
    document_types = [
        "approved_atc_documents",
        "approved_price_paper",
        "approved_all_documents",
    ]
    documents = [
        {
            "type": doc_type,
            "url": request.build_absolute_uri(
                f"/api/printer-bids/{bid.id}/generate-docs/"
            ),
        }
        for doc_type in document_types
    ]
    catalogue_product = CatalogueProduct.objects.filter(
        model_no__iexact=bid.model_number or ""
    ).first()
    local_content = str(bid.local_content or "").strip().rstrip("%")
    return {
        "workflow": "printer_gem_upload",
        "product_type": "printer",
        "bid_id": bid.id,
        "callback_url": request.build_absolute_uri(
            f"/api/printer-bids/{bid.id}/gem-status/"
        ),
        "model_number": bid.model_number or "",
        "brand": "ACXXEL",
        "category": {
            "key": "printer",
            "label": bid.printer_type or "Printer",
            "slug": "",
        },
        "quantity": bid.qty,
        "price": bid.final_amount,
        "bid_number": bid.bid_no,
        "department": bid.dept_name,
        "organization": bid.organization or "",
        "delivery_address": bid.address or "",
        "pincode": bid.pincode or "",
        "local_content": local_content,
        "specifications": {
            "Printing Technology": bid.printing_technology or "",
            "Cartridge Technology": bid.cartridge_technology or "",
            "Type of Printing": bid.type_of_printing or "",
            "Availability of Fax": bid.fax_availability or "No",
            "Operating System Compatibility": bid.operating_system_compatibility or "",
            "Minimum Print Speed A4 Monochrome (Black) (PPM) - Laser/LED MFPs": bid.mono_print_speed_ppm or "",
            "Minimum Print Speed A4 Colour (PPM) - Laser/LED MFPs": bid.colour_print_speed_ppm or "",
            "Auto Duplexing Printing/Copying (2-sided Feature)": bid.auto_duplexing or "Yes",
            "Reduction and Enlarge Features": bid.reduction_enlarge_features or "",
            "Maximum Scan Area (Platen/ADF)": bid.max_scan_area or "",
            "A4 Scan Speed Colour (Image Per Minute) @ 200 x 200 DPI": bid.a4_scan_speed_colour or "",
            "Scan To Functions": bid.scan_to_functions or "",
            "Original Document Feeder Type (For Scanning and Copying)": bid.document_feeder_type or "",
            "Feeder Capacity (Number of Sheets)": bid.feeder_capacity or "",
            "Number of Main Paper Tray": bid.main_paper_tray_count or "",
            "Total Main Paper Tray Combined Capacity (75 GSM)": bid.total_paper_tray_capacity or "",
            "Bypass Tray Facility": bid.bypass_tray_facility or "",
            "Bypass Tray Capacity (75 GSM)": bid.bypass_tray_capacity or "",
            "Connectivity": bid.connectivity or "",
            "Duty Cycle (Prints/Month)": bid.duty_cycle or "",
            "On Site Warranty (In Year)": bid.onsite_warranty or "",
            "Extended Warranty (in Years)": bid.extended_warranty or "",
            "Country Of Origin": "INDIA",
        },
        "documents": documents,
        "images": [
            request.build_absolute_uri(catalogue_product.image.url)
            for _ in [0]
            if catalogue_product and catalogue_product.image
        ],
    }
