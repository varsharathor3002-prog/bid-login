from django.http import JsonResponse
from django.http.multipartparser import MultiPartParser
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.hashers import make_password, check_password
import json
from django.utils import timezone
from datetime import timedelta
from django.views.decorators.http import require_http_methods
from ..models import User, DesktopBid, CatalogueProduct
import re
import os
from collections import OrderedDict
import tempfile
from datetime import datetime


try:
    import fitz 
except ImportError:
    fitz = None

try:
    from PyPDF2 import PdfReader
except Exception:
    PdfReader = None

from django.db.models import Q

# =========================
# REGISTER User
# =========================
@csrf_exempt
def register(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            username = data.get("username")
            email = data.get("email")
            password = data.get("password")

            if not username or not email or not password:
                return JsonResponse({"error": "All fields required"}, status=400)

            if User.objects.filter(username=username).exists():
                return JsonResponse({"error": "Username already exists"}, status=400)

            if User.objects.filter(email=email).exists():
                return JsonResponse({"error": "Email already exists"}, status=400)

            User.objects.create(
                username=username,
                email=email,
                password=make_password(password),
                role="user"
            )
            return JsonResponse({"message": "User registered successfully ✅"})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "Use POST method"}, status=405)

# =========================
# USER LIST
# =========================
@csrf_exempt
def user_list(request):
    if request.method == "GET":
        try:
            users = User.objects.filter(role="user")
            data = [{"id": u.id, "username": u.username, "email": u.email} for u in users]
            return JsonResponse(data, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
    return JsonResponse({"error": "Use GET method"}, status=405)

# =========================
# DELETE USER
# =========================
@csrf_exempt
def delete_user(request, id):
    if request.method == "DELETE":
        try:
            user = User.objects.filter(id=id, role="user").first()
            if not user:
                return JsonResponse({"error": "User not found"}, status=404)
            user.delete()
            return JsonResponse({"message": "User deleted successfully ✅"})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
    return JsonResponse({"error": "Use DELETE method"}, status=405)

# =========================
# Analyser LIST
# =========================
@csrf_exempt
def analyser_list(request):
    if request.method == "GET":
        try:
            analysers = User.objects.filter(role="analyser")
            data = [{"id": a.id, "username": a.username, "email": a.email} for a in analysers]
            return JsonResponse(data, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
    return JsonResponse({"error": "Use GET method"}, status=405)

# =========================
# REGISTER Analyser
# =========================
@csrf_exempt
def register_analyser(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            username = data.get("username")
            email = data.get("email")
            password = data.get("password")

            if not username or not email or not password:
                return JsonResponse({"error": "All fields required"}, status=400)

            if User.objects.filter(username=username).exists():
                return JsonResponse({"error": "Username already exists"}, status=400)

            if User.objects.filter(email=email).exists():
                return JsonResponse({"error": "Email already exists"}, status=400)

            User.objects.create(
                username=username,
                email=email,
                password=make_password(password),
                role="analyser"
            )
            return JsonResponse({"message": "Analyser registered successfully ✅"})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
    return JsonResponse({"error": "Use POST method"}, status=405)

# =========================
# DELETE Analyser
# =========================
@csrf_exempt
def delete_analyser(request, id):
    if request.method == "DELETE":
        try:
            analyser = User.objects.filter(id=id, role="analyser").first()
            if not analyser:
                return JsonResponse({"error": "Analyser not found"}, status=404)
            analyser.delete()
            return JsonResponse({"message": "Analyser deleted successfully ✅"})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
    return JsonResponse({"error": "Use DELETE method"}, status=405)

# =========================
# LOGIN Admin, Analyser, User
# =========================
@csrf_exempt
def login(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            username = data.get("username")
            password = data.get("password")
            role = data.get("role")

            if not username or not password:
                return JsonResponse({"error": "Username and Password required"}, status=400)

            user = User.objects.filter(username=username).first()
            if not user:
                return JsonResponse({"error": "User not found"}, status=404)

            if role and user.role != role:
                return JsonResponse({"error": "Invalid role selected"}, status=400)

            if check_password(password, user.password):
                return JsonResponse({
                    "message": "Login successful ✅",
                    "username": user.username,
                    "email": user.email,
                    "role": user.role,
                    "user_id": user.id,
                })
            else:
                return JsonResponse({"error": "Invalid password"}, status=400)

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "Use POST method"}, status=405)

@csrf_exempt
def forgot_password(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            username = data.get("username")
            email = data.get("email")
            new_password = data.get("new_password")

            if not username or not email or not new_password:
                return JsonResponse({"error": "All fields are required"}, status=400)

            user = User.objects.filter(username=username, email=email).first()
            if not user:
                return JsonResponse({"error": "Invalid username or email"}, status=404)

            user.password = make_password(new_password)
            user.save()
            return JsonResponse({"message": "Password updated successfully ✅"})

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "Use POST method"}, status=405)

# =========================
# HELPER
# =========================
def safe_float(value, default=0):
    if value in (None, "", "price"):
        return float(default or 0)
    try:
        return float(value)
    except (TypeError, ValueError):
        return float(default or 0)

def _file_url(request, field):
    try:
        if field and field.name:
            return request.build_absolute_uri(field.url)
    except Exception:
        pass
    return ""

# =========================
# HELPER (used inside generate_certificates)
# =========================
def _get_model_number_from_data(data):
    if data is None:
        return ""
    model = (
        data.get("model_number") or data.get("model") or data.get("selected_model") or
        data.get("matched_model") or data.get("model_no") or data.get("modelNo") or ""
    )
    if isinstance(model, dict):
        model = (
            model.get("model_number") or model.get("model_no") or
            model.get("modelNo") or model.get("model") or ""
        )
    return str(model or "").strip()


def _match_clean(value):
    """Same normalization helper used elsewhere in the project (catalogue
    matching code) — required here because _extract_motherboard_features_from_text
    depends on it."""
    if value is None:
        return ""
    raw = str(value).lower().strip()
    if raw in {"none", "no", "not required", "not applicable", "n/a"}:
        return "0"
    v = raw
    v = v.replace("₹", "").replace(",", "").replace("-", "").replace("_", "")
    v = v.replace("/", "").replace("(", "").replace(")", "").replace('"', "").replace("'", "")
    v = v.replace("m dot 2", "m2").replace("m.2", "m2")
    v = v.replace("pcie", "pci").replace("pci express", "pci")
    v = re.sub(r"\s+", " ", v).strip()
    return v


def _numbers_from_text(value):
    return re.findall(r"\d+(?:\.\d+)?", _match_clean(value))


def _extract_motherboard_features_from_text(text):
    """Used inside generate_certificates() -> _form_specs() to derive
    motherboard expansion-slot / port counts from a free-text motherboard
    description string."""
    t = _match_clean(text)
    features = {
        "pcie_x1": 0,
        "pcie_x4": 0,
        "pcie_x16": 0,
        "m2_ssd": 0,
        "m2_wifi": 0,
        "tpm": 0,
        "usb2": 0,
        "usb3": 0,
        "type_c": 0,
        "vga": 0,
        "hdmi": 0,
        "dp": 0,
        "ethernet": 0,
    }

    m = re.search(r"pci\s*x\s*16\s*(?:-|:)?\s*(\d+)", t)
    if m:
        features["pcie_x16"] = int(m.group(1))

    m = re.search(r"pci16\s*\*?\s*(\d+)", t)
    if m:
        features["pcie_x16"] = int(m.group(1))

    m = re.search(r"pci\s*x\s*1(?!\d)\s*(?:-|:)?\s*(\d+)", t)
    if m:
        features["pcie_x1"] = int(m.group(1))

    m = re.search(r"pci1(?!\d)\s*\*?\s*(\d+)", t)
    if m:
        features["pcie_x1"] = int(m.group(1))

    m = re.search(r"pci\s*x\s*4\s*(?:-|:)?\s*(\d+)", t)
    if m:
        features["pcie_x4"] = int(m.group(1))

    # DesktopConfig values use "PCI 4 X1" / "PCI 4 X2" for PCIe x4 count.
    m = re.search(r"pci\s*4\s*x\s*(\d+)", t)
    if m:
        features["pcie_x4"] = int(m.group(1))

    m = re.search(r"pci4\s*\*?\s*(\d+)", t)
    if m:
        features["pcie_x4"] = int(m.group(1))

    m = re.search(r"m2\s*(\d+)", t)
    if m:
        features["m2_ssd"] = int(m.group(1))

    if "m2 wifi" in t or "wifi" in t:
        features["m2_wifi"] = max(features["m2_wifi"], 1)

    if "tpm" in t:
        features["tpm"] = 1

    m = re.search(r"(\d+)\s*usb\s*2", t)
    if m:
        features["usb2"] = int(m.group(1))

    m = re.search(r"(\d+)\s*usb\s*3", t)
    if m:
        features["usb3"] = int(m.group(1))

    m = re.search(r"type\s*c\s*(\d+)", t)
    if m:
        features["type_c"] = int(m.group(1))
    elif "type c" in t or "typec" in t:
        features["type_c"] = 1

    if "vga" in t:
        features["vga"] = 1
    if "hdmi" in t:
        features["hdmi"] = 1
    if re.search(r"\bdp\b", t) or "display port" in t:
        features["dp"] = 1
    if "ethernet" in t or "gigabit" in t or "lan" in t:
        features["ethernet"] = 1

    return features


# ═══════════════════════════════════════════════════════════
# PDF CERTIFICATE GENERATION — SPECIFIC PAGE ONLY
# ═══════════════════════════════════════════════════════════
@csrf_exempt
@require_http_methods(["POST"])
def generate_certificates(request, bid_id):
    """
    v20 — WARRANTY FIX:
    ✅ "For warranty confirmation visit" line aur uske baad ke links remove.
    ✅ Saare URLs/Links remove.
    ✅ Model Number (e.g., AXL-AIO0006) placeholders ko replace karega.
    ✅ v18/v17 ke baaki sabhi fixes (Service Support, Tender No, etc.) as-is rahenge.
    """
    if not fitz:
        return JsonResponse({"error": "PyMuPDF installed nahi hai."}, status=500)
    try:
        bid = DesktopBid.objects.get(id=bid_id)
    except DesktopBid.DoesNotExist:
        return JsonResponse({"error": "Bid not found"}, status=404)

    try:
        body = json.loads(request.body)
        doc_type = body.get("doc_type", "")
    except Exception:
        body = {}
        doc_type = ""

    CERT_PAGE_RANGES = {
        "manufacturer_auth":    (2, 3),
        "make_in_india":        (5, 5),
        "warranty":             (6, 6),
        "bidder_financial":     (7, 7),
        "non_obsolete":         (8, 8),
        "data_sheet":           (31, 32),
        "non_malicious":        (16, 16),
        "non_return_hdd":       (17, 17),
        "technical_compliance": (18, 18),
        "non_blacklisting":     (20, 20),
        "service_support":      (25, 30),
        "ipv6":                 (21, 21),
        "preloaded_os":         (22, 22),
    }

    if not doc_type or doc_type not in CERT_PAGE_RANGES:
        return JsonResponse({"error": f"Invalid doc_type: '{doc_type}'"}, status=400)

    template_path = os.path.join("media", "templates", "documents.pdf")
    if not os.path.exists(template_path):
        return JsonResponse({"error": "Template PDF not found"}, status=404)

    dept_name = (bid.dept_name or "").strip()
    organization = (bid.organization or "").strip()
    bid_no = (bid.bid_no or "").strip()
    address = (bid.address or "").strip()
    pincode = (bid.pincode or "").strip()
    model_number = (
        _get_model_number_from_data(body)
        or (bid.model_number or "")
    ).strip()

    catalogue_product = None
    catalogue_specs = {}
    product_id = body.get("product_id") or body.get("productId")
    try:
        if product_id:
            catalogue_product = CatalogueProduct.objects.filter(id=product_id).first()
        if not catalogue_product and model_number:
            catalogue_product = CatalogueProduct.objects.filter(
                model_no__iexact=model_number
            ).first()
        if catalogue_product:
            catalogue_specs = catalogue_product.extra_specs or {}
            if isinstance(catalogue_specs, str):
                try:
                    catalogue_specs = json.loads(catalogue_specs)
                except Exception:
                    catalogue_specs = {}
            if not isinstance(catalogue_specs, dict):
                catalogue_specs = {}
    except Exception:
        catalogue_product = None
        catalogue_specs = {}

    warranty_text = str(
        body.get("warranty")
        or getattr(bid, "warranty", "")
        or ""
    ).strip()

    gstin_number = ""
    gstin_match = re.search(r'GSTIN[:\s]*([A-Za-z0-9]+)', address, re.IGNORECASE)
    if gstin_match:
        gstin_number = gstin_match.group(1).strip()

    local_content = str(
        body.get("local_content")
        or body.get("localContent")
        or getattr(bid, "local_content", "")
        or ""
    ).strip()
    if local_content and not local_content.endswith("%"):
        local_content = f"{local_content}%"

    full_address = f"{address} - {pincode}" if pincode else address

    bid_date_formatted = ""
    if bid.date:
        try:
            d = datetime.strptime(str(bid.date), "%Y-%m-%d")
            bid_date_formatted = d.strftime("%d-%m-%Y")
        except Exception:
            bid_date_formatted = str(bid.date)

    def _text_width(text, fontsize, bold=False):
        try:
            fname = "hebo" if bold else "helv"
            font = fitz.Font(fname)
            return font.text_length(text, fontsize=fontsize)
        except Exception:
            return len(text) * fontsize * 0.55

    def _get_cell_bg_color(page, rect):
        try:
            drawings = page.get_drawings()
            for d in drawings:
                if d.get("fill") and d.get("rect"):
                    dr = fitz.Rect(d["rect"])
                    if dr.intersects(rect) and dr.get_area() > 100:
                        fill = d["fill"]
                        if fill and len(fill) >= 3:
                            r, g, b = fill[0], fill[1], fill[2]
                            if not (r > 0.97 and g > 0.97 and b > 0.97):
                                return (r, g, b)
        except Exception:
            pass
        return (0.94, 0.94, 0.94)

    def _draw_inline_paragraph(page, x, y, line_height, max_width, segments, fontsize=11):
        word_tokens = []
        for text_chunk, is_bold in segments:
            words = text_chunk.split(' ')
            for i, w in enumerate(words):
                if w:
                    word_tokens.append((w, is_bold, True))

        current_line = []
        current_width = 0.0
        cur_y = y

        def render_line(line_tokens, base_y):
            cx = x
            for word, bold, _ in line_tokens:
                fname = "hebo" if bold else "helv"
                page.insert_text(
                    (cx, base_y),
                    word,
                    fontsize=fontsize,
                    fontname=fname,
                    color=(0, 0, 0),
                )
                cx += _text_width(word + "  ", fontsize, bold)

        for word, is_bold, add_space in word_tokens:
            w_width = _text_width(word + "  ", fontsize, is_bold)
            if current_line and (current_width + w_width) > max_width:
                render_line(current_line, cur_y)
                cur_y += line_height
                current_line = [(word, is_bold, add_space)]
                current_width = w_width
            else:
                current_line.append((word, is_bold, add_space))
                current_width += w_width

        if current_line:
            render_line(current_line, cur_y)

    def _draw_centered_heading(page, text, y, fontsize=16, bold=True, color=(0, 0, 0.6)):
        fname = "hebo" if bold else "helv"
        text_w = _text_width(text, fontsize, bold)
        x = (page.rect.width - text_w) / 2
        page.insert_text(
            (x, y),
            text,
            fontsize=fontsize,
            fontname=fname,
            color=color,
        )
        underline_y = y + 3
        page.draw_line(
            (x, underline_y),
            (x + text_w, underline_y),
            color=color,
            width=1.2,
        )
        return underline_y + 8

    def _shrink_for_cell(area, pad_x=2, pad_y=1):
        return fitz.Rect(
            area.x0 + pad_x,
            area.y0 + pad_y,
            area.x1 - pad_x,
            area.y1 - pad_y,
        )

    def _format_model_number(model):
        if not model:
            return ""
        model = model.strip()
        model = re.sub(r'^[-\s]+|[-\s]+$', '', model)
        model = re.sub(r'\s+', ' ', model)
        return model

    def _normalize_warranty_text(value):
        value = str(value or "").strip()
        if not value:
            return ""
        m = re.search(r'\d+', value)
        if m:
            years = m.group(0)
            suffix = "year" if years == "1" else "years"
            return f"{years} {suffix}"
        return value

    def _bid_value(*keys, default=""):
        for key in keys:
            if key in body and body.get(key) not in (None, ""):
                return str(body.get(key)).strip()
            if hasattr(bid, key):
                value = getattr(bid, key)
                if value not in (None, ""):
                    return str(value).strip()
        return default

    def _compact_text(*parts):
        return " ".join(str(part or "").strip() for part in parts if str(part or "").strip())

    def _ram_type(value):
        text = str(value or "")
        match = re.search(r'\bDDR\s*([345])\b', text, re.IGNORECASE)
        return f"DDR{match.group(1)}" if match else text

    def _ram_size(value):
        text = str(value or "")
        match = re.search(r'\b(\d+)\s*GB\b', text, re.IGNORECASE)
        return match.group(1) if match else text

    def _yes_no_from_value(value, positive_default="Yes"):
        text = str(value or "").strip()
        if not text:
            return ""
        if re.search(r'\b(no|none|not required|not applicable|n/a|0)\b', text, re.IGNORECASE):
            return "No"
        if re.search(r'\b(yes|required|available|wired|wireless|wifi|bluetooth)\b', text, re.IGNORECASE):
            return positive_default
        return text

    def _keyboard_connectivity(value):
        text = str(value or "")
        if re.search(r'wireless', text, re.IGNORECASE):
            return "Wireless"
        if re.search(r'wired|usb', text, re.IGNORECASE):
            return "Wired"
        return text

    def _graphics_type(value):
        text = str(value or "").strip()
        if not text:
            return "Integrated"
        if re.search(r'dedicated|graphic card|gpu', text, re.IGNORECASE):
            return "Dedicated"
        if re.search(r'integrated|uhd|vega', text, re.IGNORECASE):
            return "Integrated"
        return text

    def _storage_type(hdd, ssd1, ssd2):
        has_hdd = bool(hdd and not re.search(r'\b(no|none|0|not required|n/a)\b', hdd, re.IGNORECASE))
        has_ssd = bool((ssd1 and not re.search(r'\b(no|none|0|not required|n/a)\b', ssd1, re.IGNORECASE)) or
                       (ssd2 and not re.search(r'\b(no|none|0|not required|n/a)\b', ssd2, re.IGNORECASE)))
        if has_hdd and has_ssd:
            return "HDD + SSD"
        if has_ssd:
            return "SSD"
        if has_hdd:
            return "HDD"
        return ""

    def _availability(value):
        text = str(value or "").strip()
        if not text or re.search(r'\b(no|none|not required|not applicable|n/a|0)\b', text, re.IGNORECASE):
            return "No"
        return "Yes"

    def _motherboard_chipset(value):
        text = str(value or "").strip()
        if not text:
            return ""
        first_part = text.split(",")[0].strip()
        first_part = re.sub(r'\s+', ' ', first_part)
        return first_part

    def _motherboard_feature_value(features, key, fallback=""):
        try:
            val = features.get(key, "")
        except Exception:
            val = ""
        if val in (None, ""):
            return fallback
        return str(val)

    def _catalogue_spec(*labels, default=""):
        for label in labels:
            value = catalogue_specs.get(label, "")
            if value not in (None, ""):
                return str(value).strip()
        return default

    def _prefer_catalogue(value, *labels):
        cat_value = _catalogue_spec(*labels)
        return cat_value if cat_value not in (None, "") else value

    def _form_specs():
        hdd = _bid_value("hdd")
        ssd1 = _bid_value("ssd1", "ssd")
        ssd2 = _bid_value("ssd2")
        ram = _bid_value("ram")
        motherboard = _bid_value("motherboard", "motherboard_descp")
        mb_features = {}
        try:
            mb_features = _extract_motherboard_features_from_text(motherboard)
        except Exception:
            mb_features = {}

        return {
            "model_number": _format_model_number(model_number),
            "brand": "acxxel",
            "computer_type": _catalogue_spec("Computer Type", default="Desktop Computer"),
            "processor": _prefer_catalogue(_bid_value("processor"), "Processor Number"),
            "motherboard": _motherboard_chipset(motherboard),
            "pcie_x1": _prefer_catalogue(_motherboard_feature_value(mb_features, "pcie_x1", ""), "Expansion Slots (PCIe x 1)"),
            "pcie_x4": _prefer_catalogue(_motherboard_feature_value(mb_features, "pcie_x4", ""), "Expansion Slots (PCIe x 4)"),
            "pcie_x16": _prefer_catalogue(_motherboard_feature_value(mb_features, "pcie_x16", ""), "Expansion Slots (PCIe x 16)"),
            "m2_ssd": _prefer_catalogue(_motherboard_feature_value(mb_features, "m2_ssd", ""), "Expansion Slots (M Dot 2) for SSD"),
            "m2_wifi": _prefer_catalogue(_motherboard_feature_value(mb_features, "m2_wifi", ""), "Expansion Slots (M Dot 2) for WiFi"),
            "tpm": _prefer_catalogue("Discrete TPM 2.0" if str(mb_features.get("tpm", "") or "").strip() in {"1", "True", "true"} else "", "Trusted Platform Module"),
            "graphics_type": _prefer_catalogue(_graphics_type(_bid_value("gp")), "Graphics Type"),
            "graphics_model": _prefer_catalogue(_bid_value("gp") or "Integrated Graphics", "Graphic Card Make and Model - Must declare"),
            "graphics_memory": _prefer_catalogue("0" if not _bid_value("gp") else _bid_value("gp"), "Size of Memory in Case of Dedicated Graphic Card(GB)"),
            "graphics_description": _bid_value("gp"),
            "os": _prefer_catalogue(_bid_value("os"), "Factory Pre-loaded Operating System by DesktopOEM"),
            "recovery_media": _catalogue_spec("Recovery Media for OS", default="Online / Cloud Recovery"),
            "ram_type": _prefer_catalogue(_ram_type(ram), "Type of RAM"),
            "ram_size": _prefer_catalogue(ram, "RAM Size (Memory Card/Module) (in GB) (Capacity tobe installed in the System)"),
            "ram_size_gb": _ram_size(ram),
            "ram_expandable": _catalogue_spec("Memory Expandable Up To (in GB)", default="As per motherboard support"),
            "dimm_slots_available": _catalogue_spec("Total Numbers of DIMM Slots Available"),
            "dimm_slots_populated": _catalogue_spec("Number of DIMM Slots Populated with MemoryCard/Module"),
            "hdd": hdd,
            "ssd1": ssd1,
            "ssd2": ssd2,
            "storage_type": _prefer_catalogue(_storage_type(hdd, ssd1, ssd2), "Type of Storage Installed with the System"),
            "ssd_capacity": _catalogue_spec("SSD - Storage Capacity (in GB)", default=ssd1),
            "hdd_capacity": _catalogue_spec("HDD - Storage Capacity (in GB)", default=hdd),
            "bay_25_available": _catalogue_spec("Number of Internal Bays Available, Size 2 Point 5 Inch"),
            "bay_25_populated": _catalogue_spec("Number of Internal Bay Populated, Size 2 Point 5Inch"),
            "bay_35_available": _catalogue_spec("Number of Internal Bays Available, Size 3 Point 5 inch"),
            "bay_35_populated": _catalogue_spec("Number of Internal Bay Populated, Size 3 Point 5inch"),
            "cabinet": _prefer_catalogue(_bid_value("cabinet"), "Cabinet Form Factor"),
            "optical_bays": _catalogue_spec("Bays for Optical Drive"),
            "dvd": _prefer_catalogue(_yes_no_from_value(_bid_value("dvd")), "Optical Drive"),
            "audio_interface": _catalogue_spec("Audio Interface Type"),
            "wifi": _bid_value("wifi"),
            "usb2": _prefer_catalogue(_motherboard_feature_value(mb_features, "usb2", ""), "Number of USB Type A Port (Version 2 Point 0)"),
            "usb3": _prefer_catalogue(_motherboard_feature_value(mb_features, "usb3", ""), "Number of USB Type A Port (Version 3 point 2 Gen 1)"),
            "type_c": _prefer_catalogue(_motherboard_feature_value(mb_features, "type_c", ""), "Number of USB Ports Type C"),
            "vga": _prefer_catalogue(_motherboard_feature_value(mb_features, "vga", ""), "Number of VGA Ports"),
            "hdmi": _prefer_catalogue(_motherboard_feature_value(mb_features, "hdmi", ""), "Number of HDMI Ports"),
            "dp": _prefer_catalogue(_motherboard_feature_value(mb_features, "dp", ""), "Number of DP Ports"),
            "ethernet_type": _prefer_catalogue("RJ45 / Gigabit Ethernet" if str(mb_features.get("ethernet", "") or "").strip() not in {"", "0", "False", "false"} else "", "Type of Ethernet Ports"),
            "ethernet": _prefer_catalogue(_motherboard_feature_value(mb_features, "ethernet", ""), "Number of Ethernet Ports"),
            "optional_port1": _bid_value("optional_port", "optional_port1"),
            "optional_port2": _bid_value("optional_port2"),
            "optional_port3": _bid_value("optional_port3"),
            "optional_port4": _bid_value("optional_port4"),
            "optional_port5": _bid_value("optional_port5"),
            "optional_ports": _bid_value("optional_ports") or ", ".join(
                port for port in [
                    _bid_value("optional_port", "optional_port1"),
                    _bid_value("optional_port2"),
                    _bid_value("optional_port3"),
                ] if port
            ),
            "monitor_available": _prefer_catalogue(_availability(_bid_value("monitor")), "Availibility of Monitor"),
            "monitor": _prefer_catalogue(_bid_value("monitor"), "Screen Size (in CMs)"),
            "panel_type": _catalogue_spec("Panel Type"),
            "display_technology": _catalogue_spec("Display Technology"),
            "max_resolution": _catalogue_spec("Maximum Resolution (Pixels)"),
            "aspect_ratio": _catalogue_spec("Image Aspect Ratio"),
            "brightness": _catalogue_spec("Brightness (in Nits)"),
            "refresh_rate": _catalogue_spec("Refresh Rate (in Hz)"),
            "monitor_port": _catalogue_spec("Monitor Port"),
            "webcam_mic": _catalogue_spec("Integrated Webcam with Mic"),
            "monitor_power": _catalogue_spec("Power Supply for Monitor"),
            "speaker": _prefer_catalogue("Yes" if re.search(r'speaker', _bid_value("monitor"), re.IGNORECASE) else "", "Speaker"),
            "keyboard": _bid_value("keyboard"),
            "mouse_connectivity": _prefer_catalogue(_keyboard_connectivity(_bid_value("keyboard")), "Mouse Connectivity"),
            "keyboard_connectivity": _prefer_catalogue(_keyboard_connectivity(_bid_value("keyboard")), "Keyboard Connectivity"),
            "keyboard_type": _catalogue_spec("Type of Keyboard", default=_bid_value("keyboard")),
            "warranty": _prefer_catalogue(_bid_value("warranty"), "On Site OEM Warranty (in Year)"),
            "description": _compact_text(
                _format_model_number(model_number),
                _bid_value("processor"),
                ram,
                hdd,
                ssd1,
                _bid_value("os"),
                _bid_value("monitor"),
                _bid_value("warranty"),
            ),
            "warranty_text": _normalize_warranty_text(_bid_value("warranty")),
        }

    def _insert_data_sheet_value(page, rect, value, fontsize=9.5, erase=False):
        value = str(value or "").strip()
        if not value:
            return

        area = fitz.Rect(rect)
        inner = fitz.Rect(area.x0 + 3, area.y0 + 2, area.x1 - 3, area.y1 - 2)
        if erase:
            page.draw_rect(area, color=None, fill=(1, 1, 1), overlay=True)
        page.insert_textbox(
            inner,
            value,
            fontsize=fontsize,
            fontname="hebo",
            color=(0, 0, 0),
            align=0,
        )

    def _replace_value_right_of_label(page, label, value, fontsize=9.5):
        value = str(value or "").strip()
        if not value:
            return False

        lines = []
        for block in page.get_text("dict").get("blocks", []):
            if block.get("type") != 0:
                continue
            for line in block.get("lines", []):
                text = " ".join(span.get("text", "") for span in line.get("spans", [])).strip()
                if text:
                    lines.append((fitz.Rect(line["bbox"]), text))

        label_norm = re.sub(r'\s+', ' ', label).strip().lower()
        target = None
        for bbox, text in lines:
            text_norm = re.sub(r'\s+', ' ', text).strip().lower()
            if text_norm.rstrip(":") == label_norm.rstrip(":") and bbox.x0 < 240:
                target = bbox
                break
        if target is None:
            return False

        value_x0 = 262 if label_norm.rstrip(":") == "brand" else 282
        value_rect = fitz.Rect(value_x0, target.y0 - 4, page.rect.width - 38, target.y1 + 6)
        page.add_redact_annot(value_rect, fill=(1, 1, 1))
        page.apply_redactions()
        page.insert_textbox(
            fitz.Rect(value_rect.x0 + 3, value_rect.y0 + 2, value_rect.x1 - 3, value_rect.y1 - 2),
            value,
            fontsize=fontsize,
            fontname="hebo",
            color=(0, 0, 0),
            align=0,
        )
        return True

    def _fill_blank_data_sheet_page(page, page_index, specs):
        if page_index == 0:
            value_cells = {
                "model_number": (253, 235, 550, 258),
                "brand": (253, 258, 550, 281),
                "processor": (253, 319, 550, 343),
                "motherboard": (253, 380, 550, 403),
                "pcie_x1": (253, 403, 550, 425),
                "pcie_x4": (253, 425, 550, 447),
                "pcie_x16": (253, 447, 550, 470),
                "m2_ssd": (253, 470, 550, 493),
                "m2_wifi": (253, 493, 550, 515),
                "wifi": (253, 549, 550, 571),
                "usb2": (253, 571, 550, 591),
                "usb3": (253, 591, 550, 611),
                "vga": (253, 611, 550, 631),
                "hdmi": (253, 631, 550, 651),
                "os": (253, 651, 550, 671),
                "ram_type": (253, 705, 550, 728),
                "ram_size": (253, 728, 550, 750),
            }
        else:
            optional_area = fitz.Rect(31, 581, 554, 703)
            page.draw_rect(optional_area, color=None, fill=(1, 1, 1), overlay=True)
            port_row = fitz.Rect(31, 583, 554, 607)
            page.draw_rect(port_row, color=(0, 0, 0), fill=None, width=0.7, overlay=True)
            page.draw_line((254, 583), (254, 607), color=(0, 0, 0), width=0.7, overlay=True)
            page.insert_textbox(
                fitz.Rect(39, 586, 246, 604),
                "Port",
                fontsize=9.5,
                fontname="hebo",
                color=(0, 0, 0),
                align=0,
            )
            old_warranty_area = fitz.Rect(31, 719, 554, 763)
            page.draw_rect(old_warranty_area, color=None, fill=(1, 1, 1), overlay=True)
            page.insert_textbox(
                fitz.Rect(31, 626, 254, 646),
                "WARRANTY",
                fontsize=11,
                fontname="hebo",
                color=(0, 0, 0),
                align=0,
            )
            warranty_row = fitz.Rect(31, 652, 554, 676)
            page.draw_rect(warranty_row, color=(0, 0, 0), fill=None, width=0.7, overlay=True)
            page.draw_line((254, 652), (254, 676), color=(0, 0, 0), width=0.7, overlay=True)
            page.insert_textbox(
                fitz.Rect(39, 655, 246, 673),
                "On Site OEM Warranty",
                fontsize=9.5,
                fontname="hebo",
                color=(0, 0, 0),
                align=0,
            )
            value_cells = {
                "hdd_capacity": (254, 209, 554, 234),
                "ssd_capacity": (254, 234, 554, 259),
                "ssd2": (254, 259, 554, 284),
                "cabinet": (254, 327, 554, 351),
                "monitor_available": (254, 402, 554, 428),
                "monitor": (254, 428, 554, 453),
                "speaker": (254, 453, 554, 477),
                "keyboard": (254, 516, 554, 542),
                "optional_ports": (254, 583, 554, 607),
                "warranty": (254, 652, 554, 676),
            }

        for key, rect in value_cells.items():
            _insert_data_sheet_value(page, rect, specs.get(key, ""), erase=(key == "brand"))

    def _replace_technical_cell(page, rect, value, fontsize=8.5):
        value = str(value or "").strip()
        if not value:
            return
        area = fitz.Rect(rect)
        page.add_redact_annot(area, fill=(1, 1, 1))
        page.apply_redactions()
        inner = fitz.Rect(area.x0 + 3, area.y0 + 3, area.x1 - 3, area.y1 - 3)
        if inner.height <= 22:
            page.insert_text(
                (inner.x0, inner.y0 + fontsize + 1),
                value,
                fontsize=fontsize,
                fontname="helv",
                color=(0, 0, 0),
            )
        else:
            page.insert_textbox(
                inner,
                value,
                fontsize=fontsize,
                fontname="helv",
                color=(0, 0, 0),
                align=0,
            )

    def _fill_data_sheet_page(page, page_index=0):
        specs = _form_specs()
        label_values = {
            "Model Number": specs["model_number"],
            "Brand": specs["brand"],
            "Computer Type": specs["computer_type"],
            "Processor Number": specs["processor"],
            "Chipset / Motherboard": specs["motherboard"],
            "Expansion Slots (PCIe x 1)": specs["pcie_x1"],
            "Expansion Slots (PCIe x 4)": specs["pcie_x4"],
            "Expansion Slots (PCIe x 16)": specs["pcie_x16"],
            "Expansion Slots (M.2) for SSD": specs["m2_ssd"],
            "Expansion Slots (M.2) for WiFi": specs["m2_wifi"],
            "Expansion Slots (M Dot 2) for SSD": specs["m2_ssd"],
            "Expansion Slots (M Dot 2) for WiFi": specs["m2_wifi"],
            "Trusted Platform Module": specs["tpm"],
            "Graphics Type": specs["graphics_type"],
            "Graphic Card Make and Model": specs["graphics_model"],
            "Graphic Card Make and Model - Must declare": specs["graphics_model"],
            "Dedicated Graphic Card Memory (GB)": specs["graphics_memory"],
            "Size of Memory in Case of Dedicated Graphic Card(GB)": specs["graphics_memory"],
            "Graphics Description (Add On)": specs["graphics_description"],
            "Factory Pre-loaded Operating System": specs["os"],
            "Factory Pre-loaded Operating System by DesktopOEM": specs["os"],
            "Factory Pre-loaded Operating System by Desktop OEM": specs["os"],
            "Recovery Media for OS": specs["recovery_media"],
            "Type of RAM": specs["ram_type"],
            "RAM Size": specs["ram_size"],
            "RAM Size (Memory Card/Module) (in GB) (Capacity tobe installed in the System)": specs["ram_size"],
            "Memory Expandable Up To": specs["ram_expandable"],
            "Memory Expandable Up To (in GB)": specs["ram_expandable"],
            "Total Numbers of DIMM Slots Available": specs["dimm_slots_available"],
            "Number of DIMM Slots Populated with MemoryCard/Module": specs["dimm_slots_populated"],
            "Hard Disk Drive": specs["hdd_capacity"],
            "HDD - Storage Capacity (in GB)": specs["hdd_capacity"],
            "Solid State Drive 1": specs["ssd_capacity"],
            "Solid State Drive 2": specs["ssd2"],
            "SSD - Storage Capacity (in GB)": specs["ssd_capacity"],
            "Type of Storage Installed with the System": specs["storage_type"],
            "Number of Internal Bays Available, Size 2 Point 5 Inch": specs["bay_25_available"],
            "Number of Internal Bay Populated, Size 2 Point 5Inch": specs["bay_25_populated"],
            "Number of Internal Bays Available, Size 3 Point 5 inch": specs["bay_35_available"],
            "Number of Internal Bay Populated, Size 3 Point 5inch": specs["bay_35_populated"],
            "Cabinet Form Factor": specs["cabinet"],
            "Bays for Optical Drive": specs["optical_bays"],
            "Optical Drive / DVD": specs["dvd"],
            "Optical Drive": specs["dvd"],
            "Audio Interface Type": specs["audio_interface"],
            "WiFi / Bluetooth": specs["wifi"],
            "Availibility of Monitor": specs["monitor_available"],
            "Availability of Monitor": specs["monitor_available"],
            "Screen Size": specs["monitor"],
            "Screen Size (in CMs)": specs["monitor"],
            "Panel Type": specs["panel_type"],
            "Display Technology": specs["display_technology"],
            "Maximum Resolution (Pixels)": specs["max_resolution"],
            "Image Aspect Ratio": specs["aspect_ratio"],
            "Brightness (in Nits)": specs["brightness"],
            "Refresh Rate (in Hz)": specs["refresh_rate"],
            "Monitor Port": specs["monitor_port"],
            "Integrated Webcam with Mic": specs["webcam_mic"],
            "Power Supply for Monitor": specs["monitor_power"],
            "Speaker": specs["speaker"],
            "Keyboard  & Mouse": specs["keyboard"],
            "Mouse Connectivity": specs["mouse_connectivity"],
            "Keyboard Connectivity": specs["keyboard_connectivity"],
            "Type of Keyboard": specs["keyboard_type"],
            "On Site OEM Warranty": specs["warranty"],
            "On Site OEM Warranty (in Year)": specs["warranty"],
        }
        if page_index == 0:
            label_values.update({
                "Type of Ethernet Ports": specs["ethernet_type"],
                "Type of Ethernet Port": specs["ethernet_type"],
                "Number of Ethernet Ports": specs["ethernet"],
                "USB 2.0 Ports": specs["usb2"],
                "Number of USB Type A Port (Version 2 Point 0)": specs["usb2"],
                "USB 3.0 Ports": specs["usb3"],
                "Number of USB Type A Port (Version 3 point 2 Gen 1)": specs["usb3"],
                "USB Type C Ports": specs["type_c"],
                "Number of USB Ports Type C": specs["type_c"],
                "VGA Port": specs["vga"],
                "Number of VGA Ports": specs["vga"],
                "HDMI Port": specs["hdmi"],
                "Number of HDMI Ports": specs["hdmi"],
                "DP Port": specs["dp"],
                "Number of DP Ports": specs["dp"],
                "Optional Port": specs["optional_ports"],
                "Optional Ports": specs["optional_ports"],
            })
        filled_any = False
        for label, value in label_values.items():
            filled_any = _replace_value_right_of_label(page, label, value) or filled_any

        if not filled_any:
            _fill_blank_data_sheet_page(page, page_index, specs)

    def _fill_technical_compliance_page(page):
        heading_areas = page.search_for("Compliance or BOQ") or page.search_for("Compliance or BOq")
        for area in heading_areas:
            page.add_redact_annot(
                fitz.Rect(area.x0 - 2, area.y0 - 2, area.x1 + 2, area.y1 + 2),
                fill=(1, 1, 1),
            )
        if heading_areas:
            page.apply_redactions()
            heading = "Technical Compliance Certificate"
            heading_width = fitz.get_text_length(heading, fontname="hebo", fontsize=11.27)
            page.insert_text(
                ((page.rect.width - heading_width) / 2, heading_areas[0].y1 - 1),
                heading,
                fontsize=11.27,
                fontname="hebo",
                color=(0, 0, 0),
            )

        specs = _form_specs()
        description = specs["description"] or "Desktop Computer"
        if specs["model_number"] and specs["model_number"] not in description:
            description = _compact_text("Model", specs["model_number"], description)
        if specs.get("warranty_text"):
            description = re.sub(
                r'\b\d+\s*years?\b',
                specs["warranty_text"],
                description,
                flags=re.IGNORECASE,
            )

        replacements = [
            ((316, 190, 542, 250), description, 8.2),
            ((316, 274, 542, 386), specs["processor"], 8.2),
            ((316, 404, 542, 422), specs["mouse_connectivity"], 8.8),
            ((316, 449, 542, 467), specs["keyboard_connectivity"], 8.8),
            ((316, 494, 542, 512), specs["graphics_type"], 8.8),
            ((316, 548, 542, 568), specs["os"], 8.8),
            ((316, 606, 542, 624), specs["ram_type"], 8.8),
            ((316, 650, 542, 670), specs["ram_size_gb"], 8.8),
        ]
        for rect, value, fontsize in replacements:
            _replace_technical_cell(page, rect, value, fontsize=fontsize)

    def _remove_tender_no_date_lines(page):
        blocks = page.get_text("dict").get("blocks", [])
        erase_rects = []
        for block in blocks:
            if block.get("type") != 0:
                continue
            for line in block.get("lines", []):
                line_text = " ".join(span.get("text", "") for span in line.get("spans", [])).strip()
                if not line_text:
                    continue
                if (
                    re.search(r'Tender\s*No', line_text, re.IGNORECASE)
                    or re.search(r'GEM/\d{4}/[A-Z]/\d+', line_text)
                    or re.search(r'\bDated\s*:?\s*\d{2}-\d{2}-\d{4}', line_text, re.IGNORECASE)
                ):
                    bbox = fitz.Rect(line["bbox"])
                    erase_rects.append(fitz.Rect(bbox.x0 - 3, bbox.y0 - 3, page.rect.width - 36, bbox.y1 + 4))

        if erase_rects:
            for rect in erase_rects:
                page.add_redact_annot(rect, fill=(1, 1, 1))
            page.apply_redactions()

    def _replace_warranty_period_and_model(page):
        normalized_warranty = _normalize_warranty_text(warranty_text)

        if normalized_warranty:
            page_text_now = page.get_text("text")
            warranty_matches = []
            for m in re.finditer(r'\b\d+\s*years?\b', page_text_now, re.IGNORECASE):
                start = max(0, m.start() - 90)
                end = min(len(page_text_now), m.end() + 90)
                context = page_text_now[start:end].lower()
                if "warranty" in context or "standard warranty period" in context:
                    warranty_matches.append(m.group(0))

            for old_warranty in dict.fromkeys(warranty_matches):
                areas = page.search_for(old_warranty)
                if not areas:
                    continue
                for area in areas:
                    replace_rect = fitz.Rect(area.x0 - 2, area.y0 - 2, area.x1 + 24, area.y1 + 3)
                    page.add_redact_annot(replace_rect, fill=(1, 1, 1))
                page.apply_redactions()
                for area in areas:
                    page.insert_text(
                        (area.x0, area.y1 - 2),
                        normalized_warranty,
                        fontsize=11,
                        fontname="hebo",
                        color=(0, 0, 0),
                    )

        if model_number:
            formatted_model = _format_model_number(model_number)
            page_text_now = page.get_text("text")
            model_patterns = [
                r'AXL-[A-Z0-9-]+',
                r'ACL-[A-Z0-9-]+',
                r'ACXXEL[^\s,.;]+',
                r'ACXOEL[^\s,.;]+',
            ]
            for pattern in model_patterns:
                replaced = False
                for m in re.finditer(pattern, page_text_now, re.IGNORECASE):
                    old_model = m.group(0)
                    areas = page.search_for(old_model)
                    if not areas:
                        continue
                    for area in areas:
                        replace_rect = fitz.Rect(area.x0 - 3, area.y0 - 2, min(page.rect.width - 36, area.x1 + 115), area.y1 + 4)
                        page.add_redact_annot(replace_rect, fill=(1, 1, 1))
                    page.apply_redactions()
                    for area in areas:
                        insert_rect = fitz.Rect(area.x0, area.y0 - 1, min(page.rect.width - 36, area.x0 + 180), area.y1 + 8)
                        page.insert_textbox(
                            insert_rect,
                            formatted_model,
                            fontsize=10,
                            fontname="hebo",
                            color=(0, 0, 0),
                            align=0,
                        )
                    replaced = True
                if replaced:
                    break

    def _rewrite_warranty_paragraph(page):
        normalized_warranty = _normalize_warranty_text(warranty_text) or "standard warranty"
        formatted_model = _format_model_number(model_number) or "quoted model"
        paragraph = (
            "This is to certify that Laps N Tabs Technology Pvt. Ltd. is the OEM of ACXXEL "
            f"Desktop Brand and will provide comprehensive warranty during entire standard "
            f"warranty period i.e. {normalized_warranty} for quoted ACXXEL Desktop "
            f"{formatted_model}, if the said bid award to us."
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

    def _force_customer_to_block(page):
        blocks = page.get_text("dict").get("blocks", [])
        lines = []
        for block in blocks:
            if block.get("type") != 0:
                continue
            for line in block.get("lines", []):
                text = " ".join(span.get("text", "") for span in line.get("spans", [])).strip()
                if text:
                    lines.append((fitz.Rect(line["bbox"]), text))

        lines.sort(key=lambda item: (item[0].y0, item[0].x0))

        to_line = None
        for bbox, text in lines:
            if text.strip().rstrip(", ").lower() == "to":
                to_line = bbox
                break
        if to_line is None:
            return

        anchor = None
        for bbox, text in lines:
            if bbox.y0 <= to_line.y0:
                continue
            if re.search(r'(Tender|Bid)\s*No|Subject|Dear\s+Sir', text, re.IGNORECASE):
                anchor = bbox
                break
        if anchor is None:
            return

        erase_rect = fitz.Rect(
            to_line.x0,
            to_line.y1 + 2,
            page.rect.width - 36,
            max(to_line.y1 + 8, anchor.y0 - 6),
        )
        page.add_redact_annot(erase_rect, fill=(1, 1, 1))
        page.apply_redactions()

        customer_lines = []
        if dept_name:
            customer_lines.append(dept_name)
        if organization:
            customer_lines.append(organization)
        if gstin_number:
            customer_lines.append(f"GSTIN Number: {gstin_number}")
        if full_address:
            customer_lines.append(full_address)

        if not customer_lines:
            return

        x = to_line.x0
        y = to_line.y1 + 16
        line_height = 16
        for value in customer_lines:
            if y > anchor.y0 - 4:
                break
            page.insert_text(
                (x, y),
                value,
                fontsize=12,
                fontname="hebo",
                color=(0, 0, 0),
            )
            y += line_height

    def _force_tender_no_date(page):
        """
        Bidder Financial Standing / IPV6 / PRELOADED OS jaise pages me
        Tender No. aur Dated line ko pakka replace/insert karta hai.
        """
        if not (bid_no or bid_date_formatted):
            return

        tender_text = f"Bid No: {bid_no if bid_no else ''} Dated: {bid_date_formatted if bid_date_formatted else ''}"

        blocks = page.get_text("dict").get("blocks", [])
        tender_rects = []
        first_rect = None
        subject_rect = None

        for block in blocks:
            if block.get("type") != 0:
                continue

            for line in block.get("lines", []):
                line_text = " ".join(span.get("text", "") for span in line.get("spans", [])).strip()
                if not line_text:
                    continue

                bbox = fitz.Rect(line["bbox"])

                if subject_rect is None and re.search(r'\bSubject\b|Subject-', line_text, re.IGNORECASE):
                    subject_rect = bbox

                if (
                    re.search(r'(Tender|Bid)\s*No', line_text, re.IGNORECASE)
                    or re.search(r'GEM/\d{4}/[A-Z]/\d+', line_text)
                    or re.search(r'Dated\s*:?\s*\d{2}-\d{2}-\d{4}', line_text, re.IGNORECASE)
                ):
                    tender_rects.append(fitz.Rect(bbox.x0 - 2, bbox.y0 - 3, page.rect.width - 36, bbox.y1 + 4))
                    if first_rect is None:
                        first_rect = bbox

        if tender_rects:
            for rect in tender_rects:
                page.add_redact_annot(rect, fill=(1, 1, 1))
            page.apply_redactions()

            insert_x = first_rect.x0
            insert_y = first_rect.y1 - 2
        else:
            # Agar template me tender line detect na ho to Subject ke upar insert karo
            insert_x = 128
            insert_y = subject_rect.y0 - 28 if subject_rect else 330

        page.insert_text(
            (insert_x, insert_y),
            tender_text,
            fontsize=11,
            fontname="hebo",
            color=(0, 0, 0),
        )

    def _replace_service_support_consignee_contact(page):
        old_text = "Saurabh Singh - 9918200467"
        new_text = "Madhuri Pal - 9519598884"
        areas = page.search_for(old_text)
        if not areas:
            return

        for area in areas:
            page.add_redact_annot(
                fitz.Rect(area.x0 - 1, area.y0 - 2, area.x1 + 1, area.y1 + 2),
                fill=(1, 1, 1),
            )
        page.apply_redactions()

        for area in areas:
            page.insert_text(
                (area.x0, area.y1 - 2),
                new_text,
                fontsize=11.02,
                fontname="hebo",
                color=(63 / 255, 49 / 255, 81 / 255),
            )

    def _remove_to_whomsoever_line(page):
        """
        ✅ v19: Service Support pages par jahan bhi
        "TO WHOMSOVER IT MAY CONCERN" / "TO WHOMSOEVER IT MAY CONCERN"
        heading milti hai, usko white-out karke remove kar deta hai.

        Agar us page par pehle se "To," wala address block (dept/org/address)
        maujood nahi hai, to heading ki jagah par
            To,
            <dept_name>
            <organization>
            <address - pincode>
        insert kar diya jata hai — taaki block missing na rahe.
        """
        blocks = page.get_text("dict").get("blocks", [])

        heading_bbox = None
        next_line_bbox = None
        page_already_has_to_block = False

        # Sare lines collect karo (sorted by vertical position) taaki heading
        # ke turant baad wali line (insertion ka reference point) mil sake
        all_lines = []
        for block in blocks:
            if block.get("type") != 0:
                continue
            for line in block.get("lines", []):
                line_text = " ".join(span.get("text", "") for span in line.get("spans", [])).strip()
                if line_text:
                    all_lines.append((fitz.Rect(line["bbox"]), line_text))
        all_lines.sort(key=lambda t: t[0].y0)

        for i, (bbox, line_text) in enumerate(all_lines):
            normalized = re.sub(r'[^A-Za-z\s]', ' ', line_text).upper()
            normalized = re.sub(r'\s+', ' ', normalized).strip()

            # Matches "TO WHOMSOVER IT MAY CONCERN" / "TO WHOMSOEVER IT MAY CONCERN"
            # (actual template uses "WHOMSOVER" — without the middle "E" before "VER") —
            # tolerant of extra spacing/punctuation variations
            if heading_bbox is None and re.search(
                r'TO\s+WHOM\s*S\s*O\s*E?\s*VER\s+IT\s+MAY\s+CONCERN', normalized
            ):
                heading_bbox = bbox
                if i + 1 < len(all_lines):
                    next_line_bbox = all_lines[i + 1][0]

            if line_text.strip().rstrip(", ").strip().upper() == "TO":
                page_already_has_to_block = True

        if heading_bbox is None:
            # Is page par heading hi nahi hai — kuch karne ki zaroorat nahi
            return

        # Heading line ko erase karo
        erase_rect = fitz.Rect(
            heading_bbox.x0 - 4, heading_bbox.y0 - 3,
            page.rect.width - 36, heading_bbox.y1 + 3,
        )
        page.add_redact_annot(erase_rect, fill=(1, 1, 1))
        page.apply_redactions()

        # ✅ v19: Agar page par already "To," address block nahi hai,
        # to heading ki jagah par To,/dept/org/address block insert karo —
        # bilkul "This is certifying..." (next content line) ke upar
        if not page_already_has_to_block:
            # ✅ v20: Left margin ab page ke standard body-text margin se
            # match hoti hai (next_line_bbox = "This is certifying..." wali
            # line ka left edge) — heading center-aligned thi isliye uska
            # x0 use karna galat tha aur block right-shifted dikh raha tha.
            if next_line_bbox is not None:
                insert_x = next_line_bbox.x0
            elif heading_bbox.x0 < 200:
                insert_x = heading_bbox.x0
            else:
                insert_x = 48

            block_lines = ["To,"]
            if dept_name:
                block_lines.append(dept_name)
            if organization:
                block_lines.append(organization)
            if full_address:
                block_lines.append(full_address)

            # ✅ v21 FIX: Block aur uske neeche wali existing content
            # ("This is certifying...") ke beech mein gap mix ho raha tha
            # kyunki block top (heading_bbox.y0) se neeche ki taraf likha
            # ja raha tha aur uska bottom kabhi-kabhi next line ko chhoo
            # ya overlap kar jaata tha. Ab block ko UCHIT GAP ke saath
            # next_line_bbox ke upar se "backward" anchor kiya jata hai,
            # taaki dono sections ke beech hamesha proper spacing rahe.
            line_height = 14
            gap_before_content = 24  # block aur "This is certifying..." ke beech ka gap
            block_height = line_height * len(block_lines)

            if next_line_bbox is not None:
                block_bottom_y = next_line_bbox.y0 - gap_before_content
                insert_y = block_bottom_y - block_height + line_height
                # Heading se upar wali content ko overlap na kare, isliye
                # ek sensible minimum bhi rakho
                insert_y = max(insert_y, heading_bbox.y0)
            else:
                insert_y = heading_bbox.y0

            # ✅ v20: Pura block bold (hebo) — professional letterhead jaisa look,
            # "To," ke alawa baki lines bhi ab bold hain
            cur_y = insert_y
            for idx, bl in enumerate(block_lines):
                page.insert_text(
                    (insert_x, cur_y),
                    bl,
                    fontsize=12 if idx > 0 else 11,
                    fontname="hebo",
                    color=(0, 0, 0),
                )
                cur_y += line_height

    try:
        doc = fitz.open(template_path)
        page_from, page_to = CERT_PAGE_RANGES[doc_type]

        new_doc = fitz.open()
        new_doc.insert_pdf(doc, from_page=page_from - 1, to_page=page_to - 1)
        doc.close()

        all_gem_numbers = set()
        all_dates = set()

        for page in new_doc:
            full_text = page.get_text("text")
            for m in re.finditer(r'(?<![A-Za-z])GEM/\d{4}/[A-Z]/\d+', full_text):
                all_gem_numbers.add(m.group(0))
            for m in re.finditer(r'\d{2}-\d{2}-\d{4}', full_text):
                all_dates.add(m.group(0))

        if not all_gem_numbers or not all_dates:
            _full_doc = fitz.open(template_path)
            for _pg in _full_doc:
                _txt = _pg.get_text("text")
                if not all_gem_numbers:
                    for m in re.finditer(r'(?<![A-Za-z])GEM/\d{4}/[A-Z]/\d+', _txt):
                        all_gem_numbers.add(m.group(0))
                if not all_dates:
                    for m in re.finditer(r'\d{2}-\d{2}-\d{4}', _txt):
                        all_dates.add(m.group(0))
                if all_gem_numbers and all_dates:
                    break
            _full_doc.close()

        suppress_tender_page_numbers = {3, 26, 27, 28, 29}

        for page_index, page in enumerate(new_doc):
            original_page_number = page_from + page_index
            suppress_tender_on_page = original_page_number in suppress_tender_page_numbers
            page_text_raw = page.get_text("text")

            # ✅ v18: service_support ke har page par — chahe To,/address block ho
            # ya na ho (jaise centered heading-only pages) — "TO WHOMSOVER /
            # WHOMSOEVER IT MAY CONCERN" line ko unconditionally remove karo.
            if doc_type == "service_support":
                _remove_to_whomsoever_line(page)
                if original_page_number == 25:
                    _replace_service_support_consignee_contact(page)
                page_text_raw = page.get_text("text")

            if suppress_tender_on_page:
                _remove_tender_no_date_lines(page)
                page_text_raw = page.get_text("text")

            # ✅ FIX: In 3 documents me Tender No / Dated line forcefully update hogi
            if doc_type in [
                "manufacturer_auth",
                "warranty",
                "bidder_financial",
                "non_obsolete",
                "non_malicious",
                "non_return_hdd",
                "non_blacklisting",
                "ipv6",
                "preloaded_os",
            ] and not suppress_tender_on_page:
                _force_tender_no_date(page)
                page_text_raw = page.get_text("text")

            if doc_type == "technical_compliance":
                _fill_technical_compliance_page(page)
                continue

            if doc_type == "data_sheet":
                _fill_data_sheet_page(page, page_index)
                continue

            # ✅ v20: WARRANTY CERTIFICATE - URLs Remove & Model No Fix
            if doc_type == "warranty":
                # 1. "For warranty confirmation visit" line aur uske baad ke links ko remove karo
                page_text_now = page.get_text("text")

                # Search for the specific phrase and remove it along with following URLs
                warranty_phrase_pattern = r'For\s+warranty\s+confirmation\s+visit[^\n]*'
                for m in re.finditer(warranty_phrase_pattern, page_text_now, re.IGNORECASE):
                    areas = page.search_for(m.group(0))
                    if areas:
                        for area in areas:
                            # Expand area slightly to catch any trailing spaces or immediate links
                            expand_rect = fitz.Rect(area.x0 - 2, area.y0 - 2, page.rect.width - 36, area.y1 + 2)
                            page.add_redact_annot(expand_rect, fill=(1, 1, 1))

                # 2. Saare URLs/Links ko remove karo (backup ke liye agar upar wala pattern miss kar de)
                url_patterns = [
                    r'https?://[^\s]+',
                    r'www\.[^\s]+',
                    r'[a-zA-Z0-9-]+\.html[^\s]*',
                    r'[a-zA-Z0-9-]+#variant_id=[^\s]+',
                    r'mkp\.gem\.gov\.in[^\s]*',
                ]
                for pattern in url_patterns:
                    for m in re.finditer(pattern, page_text_now, re.IGNORECASE):
                        areas = page.search_for(m.group(0))
                        if areas:
                            for area in areas:
                                page.add_redact_annot(area, fill=(1, 1, 1))

                page.apply_redactions()

                _rewrite_warranty_paragraph(page)

                # 3. Model Number ko replace karo
                if model_number:
                    formatted_model = _format_model_number(model_number)

                    # Common placeholders ko search karo
                    placeholder_patterns = [
                        r'he haaaaa+',
                        r'AXL-[A-Z0-9]+',
                        r'ACXXEL[^\s]+',
                        r'ACXOEL[^\s]+',
                        r'Model\s*No\.?\s*[:\s]*[^\n]+',  # Generic Model No line
                    ]

                    page_text_after_url_removal = page.get_text("text")
                    for pattern in placeholder_patterns:
                        for m in re.finditer(pattern, page_text_after_url_removal, re.IGNORECASE):
                            areas = page.search_for(m.group(0))
                            if areas:
                                for area in areas:
                                    shrunk = _shrink_for_cell(area)
                                    cell_bg = _get_cell_bg_color(page, shrunk)
                                    page.add_redact_annot(shrunk, fill=cell_bg)
                                page.apply_redactions()

                                # Naya model number insert karo
                                for area in areas:
                                    mid_y = (area.y0 + area.y1) / 2 + 4
                                    # Agar pattern "Model No.: ..." tha, to prefix ke saath likho
                                    if "Model" in m.group(0):
                                        insert_text = f"Model No.: {formatted_model}"
                                    else:
                                        insert_text = formatted_model

                                    page.insert_text(
                                        (area.x0 + 4, mid_y),
                                        insert_text,
                                        fontsize=10,
                                        fontname="hebo",
                                        color=(0, 0, 0),
                                    )

                # Warranty specific generic replacements (GEM No, Date, To block) niche wale generic code se handle honge
                # Lekin agar warranty me bhi "To," block hai to wo bhi update hoga.

            if doc_type == "make_in_india":
                mfg_block_bottom_y = None

                blocks = page.get_text("dict")["blocks"]
                all_lines_raw = []
                for block in blocks:
                    if block.get("type") != 0:
                        continue
                    for line in block.get("lines", []):
                        line_text = " ".join(s["text"] for s in line.get("spans", []))
                        if line_text.strip():
                            all_lines_raw.append((line["bbox"], line_text.strip()))
                all_lines_raw.sort(key=lambda lx: lx[0][1])

                if all_lines_raw:
                    for bbox, text in all_lines_raw[:3]:
                        if re.match(r'^MAKE\s*IN\s*INDIA', text, re.IGNORECASE):
                            page.add_redact_annot(
                                fitz.Rect(bbox[0] - 10, bbox[1] - 5, page.rect.width - 26, bbox[3] + 5),
                                fill=(1, 1, 1)
                            )
                    page.apply_redactions()

                to_line_y = None
                for bbox, text in all_lines_raw:
                    if text.strip() == "To,":
                        to_line_y = bbox[3]
                        break

                heading_y = to_line_y + 50 if to_line_y else 200

                _draw_centered_heading(
                    page,
                    "MAKE IN INDIA CERTIFICATE",
                    y=heading_y,
                    fontsize=16,
                    bold=True,
                    color=(0, 0, 0.6),
                )

                blocks = page.get_text("dict")["blocks"]
                all_lines_raw = []
                for block in blocks:
                    if block.get("type") != 0:
                        continue
                    for line in block.get("lines", []):
                        line_text = " ".join(s["text"] for s in line.get("spans", []))
                        all_lines_raw.append((line["bbox"], line_text.strip()))
                all_lines_raw.sort(key=lambda lx: lx[0][1])

                intro_start_idx = None
                intro_end_idx = None
                for i, (bbox, text) in enumerate(all_lines_raw):
                    if "This is to certify" in text and intro_start_idx is None:
                        intro_start_idx = i
                    if intro_start_idx is not None and (
                        "content details are as below" in text.lower() or
                        "local content details" in text.lower()
                    ):
                        intro_end_idx = i
                        break

                if intro_start_idx is not None and intro_end_idx is not None:
                    intro_lines = all_lines_raw[intro_start_idx:intro_end_idx + 1]
                    region_x0 = min(b[0] for b, t in intro_lines)
                    region_y0 = intro_lines[0][0][1]
                    region_x1 = page.rect.width - 36
                    region_y1 = intro_lines[-1][0][3] + 6

                    page.add_redact_annot(
                        fitz.Rect(region_x0 - 2, region_y0 - 2, region_x1, region_y1),
                        fill=(1, 1, 1)
                    )
                    page.apply_redactions()

                    formatted_model = _format_model_number(model_number)

                    para_segments = [
                        ("This is to certify that ", False),
                        ("ACXXEL DESKTOP ", True),
                        (formatted_model + " ", True),
                        ("Quoted under ", False),
                        ("GeM Bid No. – ", True),
                        ((bid_no if bid_no else "N/A") + " ", True),
                        ("is getting manufactured in India. Local content details are as below:", False),
                    ]

                    _draw_inline_paragraph(
                        page,
                        x=region_x0,
                        y=region_y0 + 11,
                        line_height=17,
                        max_width=region_x1 - region_x0 - 4,
                        segments=para_segments,
                        fontsize=11,
                    )

                page_text_raw = page.get_text("text")
                url_patterns = [
                    r'https?://[^\s]+',
                    r'www\.[^\s]+',
                    r'[a-zA-Z0-9-]+\.html[^\s]*',
                    r'[a-zA-Z0-9-]+#variant_id=[^\s]+',
                    r'mkp\.gem\.gov\.in[^\s]*',
                ]
                for pattern in url_patterns:
                    for m in re.finditer(pattern, page_text_raw, re.IGNORECASE):
                        areas = page.search_for(m.group(0))
                        if areas:
                            for area in areas:
                                page.add_redact_annot(area, fill=(1, 1, 1))
                page.apply_redactions()

                blocks2 = page.get_text("dict")["blocks"]
                all_page_lines2 = []
                for block in blocks2:
                    if block.get("type") != 0:
                        continue
                    for line in block.get("lines", []):
                        lt = " ".join(s["text"] for s in line.get("spans", []))
                        all_page_lines2.append((line["bbox"], lt.strip()))
                all_page_lines2.sort(key=lambda lx: lx[0][1])

                config_link_idx = None
                for i, (bbox, text) in enumerate(all_page_lines2):
                    if "Config Link" in text or "config link" in text.lower():
                        config_link_idx = i
                        break

                if config_link_idx is not None:
                    erase_rects = [fitz.Rect(*all_page_lines2[config_link_idx][0])]
                    for j in range(config_link_idx + 1, min(config_link_idx + 8, len(all_page_lines2))):
                        bbox_j, text_j = all_page_lines2[j]
                        if text_j and (
                            "http" in text_j.lower() or "www" in text_j.lower() or
                            ".com" in text_j.lower() or ".in" in text_j.lower() or
                            ".html" in text_j.lower() or "variant_id" in text_j.lower() or
                            "mkp" in text_j.lower() or
                            re.match(r'^[a-zA-Z0-9\-_/#.:]+$', text_j)
                        ):
                            erase_rects.append(fitz.Rect(*bbox_j))
                        else:
                            break
                    for rect in erase_rects:
                        page.add_redact_annot(rect, fill=(1, 1, 1))
                    page.apply_redactions()

                blocks3 = page.get_text("dict")["blocks"]
                all_page_lines3 = []
                for block in blocks3:
                    if block.get("type") != 0:
                        continue
                    for line in block.get("lines", []):
                        lt = " ".join(s["text"] for s in line.get("spans", []))
                        all_page_lines3.append((line["bbox"], lt.strip()))
                all_page_lines3.sort(key=lambda lx: lx[0][1])

                to_idx = None
                for i, (bbox, text) in enumerate(all_page_lines3):
                    if text == "To,":
                        to_idx = i
                        break

                if to_idx is not None:
                    table_start_idx = None
                    for i in range(to_idx + 1, len(all_page_lines3)):
                        if "Sr. No." in all_page_lines3[i][1] or "Description" in all_page_lines3[i][1]:
                            table_start_idx = i
                            break

                    if table_start_idx is not None:
                        address_lines = []
                        manufacturing_start_idx = None
                        manufacturing_end_idx = None

                        for i in range(to_idx + 1, table_start_idx):
                            bbox, text = all_page_lines3[i]
                            if "Manufacturing" in text or "Laps N Tabs" in text:
                                if manufacturing_start_idx is None:
                                    manufacturing_start_idx = i
                                manufacturing_end_idx = i

                        for i in range(to_idx + 1, table_start_idx):
                            bbox, text = all_page_lines3[i]

                            if manufacturing_start_idx is not None and manufacturing_start_idx <= i <= manufacturing_end_idx:
                                continue

                            if text and "Sr. No." not in text and "Description" not in text:
                                address_lines.append((bbox, text, i))

                        if len(address_lines) >= 1 and dept_name:
                            bbox = address_lines[0][0]
                            page.add_redact_annot(
                                fitz.Rect(bbox[0], bbox[1], page.rect.width - 36, bbox[3]),
                                fill=(1, 1, 1)
                            )
                            page.apply_redactions()
                            page.insert_text(
                                (bbox[0], bbox[1] + 10),
                                dept_name, fontsize=12, fontname="hebo", color=(0, 0, 0),
                            )

                        if len(address_lines) >= 2 and organization:
                            bbox = address_lines[1][0]
                            page.add_redact_annot(
                                fitz.Rect(bbox[0], bbox[1], page.rect.width - 36, bbox[3]),
                                fill=(1, 1, 1)
                            )
                            page.apply_redactions()
                            page.insert_text(
                                (bbox[0], bbox[1] + 10),
                                organization, fontsize=12, fontname="hebo", color=(0, 0, 0),
                            )

                        if len(address_lines) >= 3 and full_address:
                            for i in range(2, min(len(address_lines), 8)):
                                bbox = address_lines[i][0]
                                page.add_redact_annot(
                                    fitz.Rect(bbox[0], bbox[1], page.rect.width - 36, bbox[3]),
                                    fill=(1, 1, 1)
                                )
                            page.apply_redactions()
                            ax, ay = address_lines[2][0][0], address_lines[2][0][1]

                            page.insert_textbox(
                                fitz.Rect(ax, ay, page.rect.width - 36, ay + 100),
                                full_address,
                                fontsize=11.5, fontname="hebo", color=(0, 0, 0), align=0,
                            )

                            if bid_no or bid_date_formatted:
                                tender_text = f"Bid No: {bid_no if bid_no else ''} Dated: {bid_date_formatted if bid_date_formatted else ''}"
                                tender_y = ay + 45
                                page.insert_text(
                                    (ax, tender_y),
                                    tender_text,
                                    fontsize=10,
                                    fontname="hebo",
                                    color=(0, 0, 0),
                                )

                        table_top_y = all_page_lines3[table_start_idx][0][1]
                        if manufacturing_start_idx is not None:
                            mfg_block_bottom_y = table_top_y

                min_table_y = mfg_block_bottom_y if mfg_block_bottom_y is not None else 0

                page_text = page.get_text("text")
                table_start = page_text.find("Sr. No.")
                if table_start != -1:
                    table_end = len(page_text)
                    for marker in ["Config", "Yours", "Thanking"]:
                        idx = page_text.find(marker, table_start)
                        if idx != -1 and idx < table_end:
                            table_end = idx

                    table_text = page_text[table_start:table_end]
                    row_pattern = r'(\d+)\s+([^\d%\n]+?)\s+(\d{1,3}\s*%)'
                    rows = re.findall(row_pattern, table_text)

                    for row in rows:
                        sr_no, description, content = row
                        desc_clean = description.strip()
                        content_clean = content.strip()

                        if model_number and desc_clean:
                            desc_areas = page.search_for(desc_clean)
                            if not desc_areas:
                                for part in desc_clean.split():
                                    if len(part) > 3:
                                        desc_areas = page.search_for(part)
                                        if desc_areas:
                                            break
                            desc_areas = [a for a in desc_areas if a.y0 >= min_table_y]
                            if desc_areas:
                                for area in desc_areas:
                                    shrunk = _shrink_for_cell(area)
                                    cell_bg = _get_cell_bg_color(page, shrunk)
                                    page.add_redact_annot(shrunk, fill=cell_bg)
                                page.apply_redactions()
                                for area in desc_areas:
                                    mid_y = (area.y0 + area.y1) / 2 + 4
                                    formatted_model = _format_model_number(model_number)
                                    tw = _text_width(formatted_model, 10, bold=True)
                                    cx = area.x0 + max(0, (area.width - tw) / 2)
                                    page.insert_text(
                                        (cx, mid_y),
                                        formatted_model,
                                        fontsize=10, fontname="hebo", color=(0, 0, 0),
                                    )

                        if local_content and content_clean:
                            content_areas = page.search_for(content_clean)
                            content_areas = [a for a in content_areas if a.y0 >= min_table_y]
                            if content_areas:
                                for area in content_areas:
                                    shrunk = _shrink_for_cell(area)
                                    cell_bg = _get_cell_bg_color(page, shrunk)
                                    page.add_redact_annot(shrunk, fill=cell_bg)
                                page.apply_redactions()
                                for area in content_areas:
                                    mid_y = (area.y0 + area.y1) / 2 + 4
                                    tw = _text_width(local_content, 10, bold=True)
                                    cx = area.x0 + max(0, (area.width - tw) / 2)
                                    page.insert_text(
                                        (cx, mid_y),
                                        local_content,
                                        fontsize=10, fontname="hebo", color=(0, 0, 0),
                                    )

                if model_number:
                    placeholder_patterns = [
                        r'he haaaaa+', r'AXL-[A-Z0-9]+',
                        r'ACXXEL[^\s]+', r'ACXOEL[^\s]+',
                    ]
                    page_text_now = page.get_text("text")
                    for pattern in placeholder_patterns:
                        for m in re.finditer(pattern, page_text_now, re.IGNORECASE):
                            areas = page.search_for(m.group(0))
                            areas = [a for a in areas if a.y0 >= min_table_y]
                            if areas:
                                for area in areas:
                                    shrunk = _shrink_for_cell(area)
                                    cell_bg = _get_cell_bg_color(page, shrunk)
                                    page.add_redact_annot(shrunk, fill=cell_bg)
                                page.apply_redactions()
                                for area in areas:
                                    mid_y = (area.y0 + area.y1) / 2 + 4
                                    formatted_model = _format_model_number(model_number)
                                    page.insert_text(
                                        (area.x0 + 4, mid_y),
                                        formatted_model, fontsize=10, fontname="hebo", color=(0, 0, 0),
                                    )

                if local_content:
                    page_text_now = page.get_text("text")
                    for m in re.finditer(r'\b\d{1,3}\s*%', page_text_now):
                        areas = page.search_for(m.group(0))
                        areas = [a for a in areas if a.y0 >= min_table_y]
                        if areas:
                            for area in areas:
                                shrunk = _shrink_for_cell(area)
                                cell_bg = _get_cell_bg_color(page, shrunk)
                                page.add_redact_annot(shrunk, fill=cell_bg)
                            page.apply_redactions()
                            for area in areas:
                                mid_y = (area.y0 + area.y1) / 2 + 4
                                page.insert_text(
                                    (area.x0 + 4, mid_y),
                                    local_content, fontsize=10, fontname="hebo", color=(0, 0, 0),
                                )

                page_text_final = page.get_text("text")
                for pattern in [r'\S+\.html\S*', r'\S+#variant_id=\S+',
                                r'\S+\.in/\S+', r'\S+\.com/\S+', r'mkp\.[^\s]+']:
                    for m in re.finditer(pattern, page_text_final, re.IGNORECASE):
                        areas = page.search_for(m.group(0))
                        if areas:
                            for area in areas:
                                page.add_redact_annot(area, fill=(1, 1, 1))
                page.apply_redactions()

                continue

            # ════════════════════════════════════════════════════════
            # GENERIC CERTIFICATES — Replace GEM no, date, To block
            # ════════════════════════════════════════════════════════

            # ✅ v16 FIX: Track if Tender No/Dated already in page
            page_has_tender_no = (
                "Tender No:" in page_text_raw
                or "Tender No :" in page_text_raw
                or "Bid No:" in page_text_raw
                or "Bid No :" in page_text_raw
            )

            gem_replaced_on_page = False
            date_replaced_on_page = False

            if bid_no and not suppress_tender_on_page:
                for gem in all_gem_numbers:
                    areas = page.search_for(gem)
                    if areas:
                        for area in areas:
                            page.add_redact_annot(area, fill=(1, 1, 1))
                        page.apply_redactions()
                        page.insert_text(
                            (areas[0].x0, areas[0].y1 - 2),
                            bid_no, fontsize=11, fontname="hebo", color=(0, 0, 0),
                        )
                        gem_replaced_on_page = True

            if bid_date_formatted and not suppress_tender_on_page:
                for dt in all_dates:
                    areas = page.search_for(dt)
                    if areas:
                        for area in areas:
                            page.add_redact_annot(area, fill=(1, 1, 1))
                        page.apply_redactions()
                        page.insert_text(
                            (areas[0].x0, areas[0].y1 - 2),
                            bid_date_formatted, fontsize=11, fontname="hebo", color=(0, 0, 0),
                        )
                        date_replaced_on_page = True

            # ✅ v16: Agar page mein pehle se "Tender No:" hai, to fallback skip
            # warna hamesha fallback insert karo
            if suppress_tender_on_page:
                needs_fallback = False
            elif page_has_tender_no:
                needs_fallback = False
            else:
                needs_fallback = True

            if "To," not in page_text_raw:
                # ✅ v16: Agar "To," nahi hai, to default position par fallback insert karo
                if needs_fallback and (bid_no or bid_date_formatted):
                    tender_text = f"Bid No: {bid_no if bid_no else ''} Dated: {bid_date_formatted if bid_date_formatted else ''}"
                    # Default position: page ke top-right area
                    default_x = 50
                    default_y = 100
                    page.insert_text(
                        (default_x, default_y),
                        tender_text,
                        fontsize=10,
                        fontname="hebo",
                        color=(0, 0, 0),
                    )
                continue

            # ✅ v19 FIX: service_support ke liye To,/dept/org/address block
            # already _remove_to_whomsoever_line() ne sahi se insert kar diya
            # hai (page ke top par, heading ki jagah). Is generic block ko
            # yahan se skip karo — warna ye dept_line/org_line ko galat
            # detect karke overwrite kar deta tha (dept/org gayab ho jate the).
            if doc_type == "service_support":
                continue

            blocks = page.get_text("dict")["blocks"]
            all_lines = []
            for block in blocks:
                if block.get("type") != 0:
                    continue
                for line in block.get("lines", []):
                    lt = " ".join(s["text"] for s in line.get("spans", []))
                    all_lines.append((line["bbox"], lt.strip()))
            all_lines.sort(key=lambda lx: lx[0][1])

            to_idx = None
            for i, (bbox, text) in enumerate(all_lines):
                if text == "To,":
                    to_idx = i
                    break
            if to_idx is None:
                continue

            gstin_idx = None
            for i in range(to_idx + 1, len(all_lines)):
                if "GSTIN" in all_lines[i][1]:
                    gstin_idx = i
                    break

            tender_idx = None
            for i in range(to_idx + 1, len(all_lines)):
                line_lower = all_lines[i][1].lower()
                if "tender" in line_lower or "bid no" in line_lower:
                    tender_idx = i
                    break

            dept_line = None
            for i in range(to_idx + 1, len(all_lines)):
                bbox, text = all_lines[i]
                if tender_idx and i >= tender_idx:
                    break
                if text and "GSTIN" not in text and "Address:" not in text:
                    dept_line = (bbox, text)
                    break

            org_line = None
            if dept_line:
                dept_i = next(i for i, (b, t) in enumerate(all_lines) if b == dept_line[0])
                for i in range(dept_i + 1, len(all_lines)):
                    bbox, text = all_lines[i]
                    if tender_idx and i >= tender_idx:
                        break
                    if text and "GSTIN" not in text and "Address:" not in text:
                        org_line = (bbox, text)
                        break

            if dept_line and dept_name:
                r = fitz.Rect(
                    dept_line[0][0], dept_line[0][1],
                    page.rect.width - 36, dept_line[0][3]
                )
                page.add_redact_annot(r, fill=(1, 1, 1))
                page.apply_redactions()
                page.insert_text(
                    (dept_line[0][0], dept_line[0][3] - 2),
                    dept_name, fontsize=12, fontname="hebo", color=(0, 0, 0),
                )

            if org_line and organization:
                r = fitz.Rect(
                    org_line[0][0], org_line[0][1],
                    page.rect.width - 36, org_line[0][3]
                )
                page.add_redact_annot(r, fill=(1, 1, 1))
                page.apply_redactions()
                page.insert_text(
                    (org_line[0][0], org_line[0][3] - 2),
                    organization, fontsize=12, fontname="hebo", color=(0, 0, 0),
                )

            if full_address:
                if gstin_idx is not None:
                    addr_start_idx = gstin_idx + 1
                elif org_line:
                    org_i = next(i for i, (b, t) in enumerate(all_lines) if b == org_line[0])
                    addr_start_idx = org_i + 1
                else:
                    addr_start_idx = to_idx + 3

                addr_erase = []
                write_x = None
                write_y = None
                prev_y1 = all_lines[addr_start_idx - 1][0][3] if addr_start_idx > 0 else 0

                for i in range(addr_start_idx, len(all_lines)):
                    bbox, text = all_lines[i]
                    if tender_idx and i >= tender_idx:
                        break
                    if any(kw in text for kw in ["Subject", "Dear", "Tender", "Bid No"]):
                        break
                    if (bbox[1] - prev_y1) > 25:
                        break
                    if text:
                        if write_x is None:
                            write_x = bbox[0]
                            write_y = bbox[1]
                        r = fitz.Rect(bbox[0], bbox[1], page.rect.width - 36, bbox[3])
                        addr_erase.append(r)
                        prev_y1 = bbox[3]

                for i in range(to_idx, len(all_lines)):
                    bbox, text = all_lines[i]
                    if "Address:" in text:
                        if write_x is None:
                            write_x = bbox[0]
                            write_y = bbox[1]
                        r = fitz.Rect(bbox[0], bbox[1], page.rect.width - 36, bbox[3])
                        if r not in addr_erase:
                            addr_erase.insert(0, r)
                        break

                if addr_erase and write_x is not None:
                    for rect in addr_erase:
                        page.add_redact_annot(rect, fill=(1, 1, 1))
                    page.apply_redactions()
                    addr_rect = fitz.Rect(
                        write_x, write_y, page.rect.width - 36, write_y + 120
                    )
                    page.insert_textbox(
                        addr_rect,
                        full_address,
                        fontsize=11.5, fontname="hebo", color=(0, 0, 0), align=0,
                    )

                # ✅ v16 FIX: Fallback ab address block ke bahar hai
                # Agar write_x/write_y available nahi hain to default position use karo
                if needs_fallback and (bid_no or bid_date_formatted):
                    tender_text = f"Bid No: {bid_no if bid_no else ''} Dated: {bid_date_formatted if bid_date_formatted else ''}"

                    # Position determine karo
                    if write_x is not None and write_y is not None:
                        # Address block mila tha, uske neeche insert karo
                        tender_x = write_x
                        tender_y = write_y + 45
                    else:
                        # Address block nahi mila, default position use karo
                        tender_x = 50
                        tender_y = 100

                    page.insert_text(
                        (tender_x, tender_y),
                        tender_text,
                        fontsize=10,
                        fontname="hebo",
                        color=(0, 0, 0),
                    )

        if doc_type in {"warranty", "non_return_hdd", "non_obsolete"}:
            for page in new_doc:
                _force_customer_to_block(page)

        output_dir = os.path.join("media", "generated")
        os.makedirs(output_dir, exist_ok=True)
        output_filename = f"bid_{bid_id}_{doc_type}.pdf"
        output_path = os.path.join(output_dir, output_filename)
        new_doc.save(output_path)
        new_doc.close()

        pdf_url = request.build_absolute_uri(f"/media/generated/{output_filename}")
        return JsonResponse({
            "success": True,
            "pdf_url": pdf_url,
            "message": f"{doc_type} certificate generated successfully",
        }, status=200)

    except Exception as e:
        return JsonResponse({"error": f"PDF generate error: {str(e)}"}, status=500)

# ═══════════════════════════════════════════════════════════
# STEP 3 — FINAL DOCUMENT SUBMIT
# ═══════════════════════════════════════════════════════════
@csrf_exempt
@require_http_methods(["POST"])
def update_desktop_docs(request, bid_id):
    try:
        bid = DesktopBid.objects.get(id=bid_id)
    except DesktopBid.DoesNotExist:
        return JsonResponse({"error": "Bid not found"}, status=404)
    try:
        if "atc_special_document" in request.FILES:
            uploaded_file = request.FILES["atc_special_document"]

            if uploaded_file.size > 5 * 1024 * 1024:
                return JsonResponse({"error": "File size should be less than 5MB"}, status=400)

            bid.atc_special_document = uploaded_file

        analyser_username = request.POST.get("analyser_username", "").strip()

        selected_analyser_docs_raw = request.POST.get("selected_analyser_docs", "")
        selected_analyser_labels_raw = request.POST.get("selected_analyser_doc_labels", "")

        selected_general_docs_raw = request.POST.get("selected_general_docs", "")
        selected_general_labels_raw = request.POST.get("selected_general_doc_labels", "")

        is_analyser_submit = bool(
            analyser_username
            or selected_analyser_docs_raw
            or selected_analyser_labels_raw
        )

        # MODEL NUMBER FIX: agar Step 3/analyser submit me model aaye to bhi save hoga.
        model_number = (
            request.POST.get("model_number")
            or request.POST.get("model")
            or request.POST.get("selected_model")
            or request.POST.get("matched_model")
            or request.POST.get("model_no")
            or request.POST.get("modelNo")
            or ""
        ).strip()

        if model_number:
            bid.model_number = model_number

        if is_analyser_submit:
            analyser_docs = _parse_json_list(selected_analyser_docs_raw)
            analyser_labels = _parse_json_list(selected_analyser_labels_raw)

            old_docs = bid.selected_general_docs or []
            old_labels = bid.selected_general_doc_labels or []

            # Admin General Documents me 13 docs ek saath dikhane ke liye merge.
            merged_docs = list(dict.fromkeys(old_docs + analyser_docs))
            merged_labels = list(dict.fromkeys(old_labels + analyser_labels))

            bid.selected_general_docs = merged_docs
            bid.selected_general_doc_labels = merged_labels

            if analyser_username:
                bid.analyser_username = analyser_username

            # ANALYSER FINAL SUBMIT: ab admin ko dikhna chahiye.
            bid.status = "complete"
            bid.review_status = "reviewed"
            message = "Analyser documents saved. Bid submitted to Admin."

        else:
            general_docs = _parse_json_list(selected_general_docs_raw)
            general_labels = _parse_json_list(selected_general_labels_raw)

            bid.selected_general_docs = general_docs
            bid.selected_general_doc_labels = general_labels

            # USER STEP 3: ab analyser ko dikhna chahiye, admin ko nahi.
            bid.status = "complete"
            bid.review_status = "pending"
            message = "User documents saved. Bid submitted to Analyser."

        bid.save()

        return JsonResponse({
            "success": True,
            "message": message,
            "bid_id": bid.id,
            "status": bid.status,
            "review_status": bid.review_status,
            "model_number": bid.model_number or "",
            "model": bid.model_number or "",
            "atc_special_document": _file_url(request, bid.atc_special_document),
            "selected_general_docs": bid.selected_general_docs or [],
            "selected_general_doc_labels": bid.selected_general_doc_labels or [],
            "analyser_username": bid.analyser_username or "",
        }, status=200)

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


# ════════════════════════════════════════════════════════════
# CATALOGUE PRODUCT — HELPERS
# ════════════════════════════════════════════════════════════
GEM_SECTIONS = [
    {"title": "PROCESSOR", "fields": ["Description of Stores", "Computer Type", "Processor Number"]},
    {"title": "MOTHERBOARD", "fields": ["Expansion Slots (PCIe x 1)", "Expansion Slots (PCIe x 4)", "Expansion Slots (PCIe x 16)", "Expansion Slots (M Dot 2) for SSD", "Expansion Slots (M Dot 2) for WiFi", "Trusted Platform Module"]},
    {"title": "GRAPHICS", "fields": ["Graphics Type", "Graphic Card Make and Model - Must declare", "Size of Memory in Case of Dedicated Graphic Card(GB)"]},
    {"title": "OPERATING SYSTEM", "fields": ["Factory Pre-loaded Operating System by DesktopOEM", "Recovery Media for OS"]},
    {"title": "MEMORY (RAM)", "fields": ["Type of RAM", "RAM Size (Memory Card/Module) (in GB) (Capacity tobe installed in the System)", "Memory Expandable Up To (in GB)", "Total Numbers of DIMM Slots Available", "Number of DIMM Slots Populated with MemoryCard/Module"]},
    {"title": "STORAGE", "fields": ["Type of Storage Installed with the System", "SSD - Storage Capacity (in GB)", "HDD - Storage Capacity (in GB)"]},
    {"title": "BAYS AVAILABILITY", "fields": ["Number of Internal Bays Available, Size 2 Point 5 Inch", "Number of Internal Bay Populated, Size 2 Point 5Inch", "Number of Internal Bays Available, Size 3 Point 5 inch", "Number of Internal Bay Populated, Size 3 Point 5inch"]},
    {"title": "CABINET", "fields": ["Cabinet Form Factor", "Bays for Optical Drive", "Optical Drive", "Audio Interface Type"]},
    {"title": "CONNECTIVITY", "fields": ["Type of Ethernet Ports", "Number of Ethernet Ports"]},
    {"title": "PORTS", "fields": ["Number of USB Type A Port (Version 2 Point 0)", "Number of USB Type A Port (Version 3 point 2 Gen 1)", "Number of USB Ports Type C", "Number of VGA Ports", "Number of HDMI Ports", "Number of DP Ports"]},
    {"title": "Monitor", "fields": ["Availibility of Monitor", "Panel Type", "Display Technology", "Screen Size (in CMs)", "Maximum Resolution (Pixels)", "Image Aspect Ratio", "Brightness (in Nits)", "Refresh Rate (in Hz)", "Monitor Port", "Integrated Webcam with Mic", "Power Supply for Monitor", "Speaker"]},
    {"title": "INPUT DEVICES", "fields": ["Mouse Connectivity", "Keyboard Connectivity", "Type of Keyboard"]},
    {"title": "POWER", "fields": ["Power Supply Capacity- Maximum (in Watt)", "Minimum Power Efficiency Range (%)"]},
    {"title": "OPERATING CONDITION", "fields": ["Minimum Operating Temperature (in Degree Celsius)", "Maximum Operating Temperature (in DegreeCelsius)", "Operating Humidity(RH) (in Percentage)"]},
    {"title": "WARRANTY", "fields": ["On Site OEM Warranty (in Year)"]},
]
SECTION_TITLES = [s["title"] for s in GEM_SECTIONS]
ALL_FIELDS = [field for section in GEM_SECTIONS for field in section["fields"]]
FIELD_ALIASES = {
    "Description of Stores": ["Description of Stores"],
    "Computer Type": ["Computer Type"],
    "Processor Number": ["Processor Number"],
    "Expansion Slots (PCIe x 1)": ["Expansion Slots (PCIe x 1)"],
    "Expansion Slots (PCIe x 4)": ["Expansion Slots (PCIe x 4)"],
    "Expansion Slots (PCIe x 16)": ["Expansion Slots (PCIe x 16)"],
    "Expansion Slots (M Dot 2) for SSD": ["Expansion Slots (M Dot 2) for SSD"],
    "Expansion Slots (M Dot 2) for WiFi": ["Expansion Slots (M Dot 2) for WiFi"],
    "Trusted Platform Module": ["Trusted Platform Module"],
    "Graphics Type": ["Graphics Type"],
    "Graphic Card Make and Model - Must declare": ["Graphic Card Make and Model - Must declare"],
    "Size of Memory in Case of Dedicated Graphic Card(GB)": ["Size of Memory in Case of Dedicated Graphic Card(GB)", "Size of Memory in Case of Dedicated Graphic Card (GB)", "Size of Memory in Case of Dedicated Graphic Card"],
    "Factory Pre-loaded Operating System by DesktopOEM": ["Factory Pre-loaded Operating System by DesktopOEM", "Factory Pre-loaded Operating System by Desktop OEM", "Factory Pre-loaded Operating System by Desktop"],
    "Recovery Media for OS": ["Recovery Media for OS"],
    "Type of RAM": ["Type of RAM"],
    "RAM Size (Memory Card/Module) (in GB) (Capacity tobe installed in the System)": ["RAM Size (Memory Card/Module) (in GB) (Capacity tobe installed in the System)", "RAM Size (Memory Card/Module) (in GB) (Capacity to be installed in the System)", "RAM Size (Memory Card/Module) (in GB) (Capacity to"],
    "Memory Expandable Up To (in GB)": ["Memory Expandable Up To (in GB)"],
    "Total Numbers of DIMM Slots Available": ["Total Numbers of DIMM Slots Available"],
    "Number of DIMM Slots Populated with MemoryCard/Module": ["Number of DIMM Slots Populated with MemoryCard/Module", "Number of DIMM Slots Populated with Memory Card/Module", "Number of DIMM Slots Populated with Memory"],
    "Type of Storage Installed with the System": ["Type of Storage Installed with the System"],
    "SSD - Storage Capacity (in GB)": ["SSD - Storage Capacity (in GB)"],
    "HDD - Storage Capacity (in GB)": ["HDD - Storage Capacity (in GB)"],
    "Number of Internal Bays Available, Size 2 Point 5 Inch": ["Number of Internal Bays Available, Size 2 Point 5 Inch"],
    "Number of Internal Bay Populated, Size 2 Point 5Inch": ["Number of Internal Bay Populated, Size 2 Point 5Inch", "Number of Internal Bay Populated, Size 2 Point 5 Inch", "Number of Internal Bay Populated, Size 2 Point 5"],
    "Number of Internal Bays Available, Size 3 Point 5 inch": ["Number of Internal Bays Available, Size 3 Point 5 inch"],
    "Number of Internal Bay Populated, Size 3 Point 5inch": ["Number of Internal Bay Populated, Size 3 Point 5inch", "Number of Internal Bay Populated, Size 3 Point 5 inch", "Number of Internal Bay Populated, Size 3 Point 5"],
    "Cabinet Form Factor": ["Cabinet Form Factor"],
    "Bays for Optical Drive": ["Bays for Optical Drive"],
    "Optical Drive": ["Optical Drive"],
    "Audio Interface Type": ["Audio Interface Type"],
    "Type of Ethernet Ports": ["Type of Ethernet Ports"],
    "Number of Ethernet Ports": ["Number of Ethernet Ports"],
    "Number of USB Type A Port (Version 2 Point 0)": ["Number of USB Type A Port (Version 2 Point 0)"],
    "Number of USB Type A Port (Version 3 point 2 Gen 1)": ["Number of USB Type A Port (Version 3 point 2 Gen 1)"],
    "Number of USB Ports Type C": ["Number of USB Ports Type C"],
    "Number of VGA Ports": ["Number of VGA Ports"],
    "Number of HDMI Ports": ["Number of HDMI Ports"],
    "Number of DP Ports": ["Number of DP Ports"],
    "Availibility of Monitor": ["Availibility of Monitor", "Availability of Monitor"],
    "Panel Type": ["Panel Type"],
    "Display Technology": ["Display Technology"],
    "Screen Size (in CMs)": ["Screen Size (in CMs)"],
    "Maximum Resolution (Pixels)": ["Maximum Resolution (Pixels)"],
    "Image Aspect Ratio": ["Image Aspect Ratio"],
    "Brightness (in Nits)": ["Brightness (in Nits)"],
    "Refresh Rate (in Hz)": ["Refresh Rate (in Hz)"],
    "Monitor Port": ["Monitor Port"],
    "Integrated Webcam with Mic": ["Integrated Webcam with Mic"],
    "Power Supply for Monitor": ["Power Supply for Monitor"],
    "Speaker": ["Speaker"],
    "Mouse Connectivity": ["Mouse Connectivity"],
    "Keyboard Connectivity": ["Keyboard Connectivity"],
    "Type of Keyboard": ["Type of Keyboard"],
    "Power Supply Capacity- Maximum (in Watt)": ["Power Supply Capacity- Maximum (in Watt)"],
    "Minimum Power Efficiency Range (%)": ["Minimum Power Efficiency Range (%)"],
    "Minimum Operating Temperature (in Degree Celsius)": ["Minimum Operating Temperature (in Degree Celsius)"],
    "Maximum Operating Temperature (in DegreeCelsius)": ["Maximum Operating Temperature (in DegreeCelsius)", "Maximum Operating Temperature (in Degree Celsius)", "Maximum Operating Temperature (in Degree"],
    "Operating Humidity(RH) (in Percentage)": ["Operating Humidity(RH) (in Percentage)"],
    "On Site OEM Warranty (in Year)": ["On Site OEM Warranty (in Year)"],
}

def _read_pdf_pages(pdf_file):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        for chunk in pdf_file.chunks():
            tmp.write(chunk)
        tmp_path = tmp.name
    try:
        reader = PdfReader(tmp_path)
        pages = []
        for page in reader.pages:
            try: pages.append(page.extract_text() or "")
            except Exception: pages.append("")
        return pages
    finally:
        try: os.remove(tmp_path)
        except Exception: pass

def _fix_joined_words(text):
    text = str(text or "")
    replacements = {
        "MonitorSystem": "Monitor System", "ProcessorMake": "Processor Make",
        "DesktopOEM": "Desktop OEM", "MemoryCard/Module": "Memory Card/Module",
        "tobe": "to be", "5Inch": "5 Inch", "5inch": "5 inch",
        "DegreeCelsius": "Degree Celsius",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    return text

def _clean_line(line):
    line = _fix_joined_words(line).strip()
    if not line: return ""
    if re.search(r"\b\d{1,2}/\d{1,2}/\d{2,4},\s*\d{1,2}:\d{2}\s*[AP]M\b", line, re.IGNORECASE): return ""
    if "Government e Marketplace" in line: return ""
    if "mkp.gem.gov.in" in line: return ""
    if line.startswith("http://") or line.startswith("https://"): return ""
    if re.fullmatch(r"\d+/\d+", line): return ""
    if line.strip() in {"Product Compare", "Product History", "Product Compare Product History1", "Product Compare Product History 1"}: return ""
    line = re.sub(r"Product Compare\s+Product History\s*1?", "", line, flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", line).strip()

def _select_actual_block(pages):
    page_lines = []
    for page in pages:
        lines = [_clean_line(line) for line in str(page or "").splitlines()]
        page_lines.append([line for line in lines if line])
    start_idx = None
    for i, lines in enumerate(page_lines):
        joined = " ".join(lines)
        if (re.search(r"\bPROCESSOR\b", joined, re.IGNORECASE) and 
            re.search(r"\bMOTHERBOARD\b", joined, re.IGNORECASE) and 
            re.search(r"Processor\s+Number", joined, re.IGNORECASE)):
            start_idx = i
            break
    if start_idx is None: start_idx = 0

    parts = []
    started = False
    for lines in page_lines[start_idx:]:
        for line in lines:
            if line.upper() == "PROCESSOR": started = True
            if not started: continue
            if line.upper() in {"CERTIFICATION", "WEB INFO"}: return " ".join(parts)
            parts.append(line)

    block = " ".join(parts)
    block = re.sub(r"\s+", " ", block).strip()
    return block

def _label_regex(label):
    label = _fix_joined_words(label)
    parts = [re.escape(p) for p in re.split(r"\s+", label.strip())]
    return r"(?<![A-Za-z0-9])" + r"\s+".join(parts)

def _find_boundaries(block):
    candidates = []
    alias_items = []
    for canonical, aliases in FIELD_ALIASES.items():
        for alias in aliases:
            alias_items.append((canonical, alias))
    alias_items.sort(key=lambda x: len(x[1]), reverse=True)
    for canonical, alias in alias_items:
        for m in re.finditer(_label_regex(alias), block, flags=re.IGNORECASE):
            if canonical == "Optical Drive" and block[max(0, m.start() - 3):m.start()].lower() == "no": continue
            candidates.append({
                "start": m.start(), "end": m.end(), "type": "field",
                "canonical": canonical, "alias": alias,
            })

    for title in ["CERTIFICATION", "WEB INFO"]:
        for m in re.finditer(_label_regex(title), block, flags=re.IGNORECASE):
            candidates.append({"start": m.start(), "end": m.end(), "type": "end", "canonical": None, "alias": title})

    candidates.sort(key=lambda x: (x["start"], -(x["end"] - x["start"])))
    filtered = []
    occupied_until = -1
    for c in candidates:
        if c["start"] < occupied_until: continue
        filtered.append(c)
        occupied_until = c["end"]
    filtered.sort(key=lambda x: x["start"])
    return filtered

def _remove_edge_section_titles(value):
    value = re.sub(r"\s+", " ", str(value or "")).strip()
    titles = ["MOTHERBOARD", "GRAPHICS", "OPERATING SYSTEM", "MEMORY (RAM)", "STORAGE", "BAYS AVAILABILITY", "CABINET", "CONNECTIVITY", "PORTS", "Monitor", "INPUT DEVICES", "POWER", "OPERATING CONDITION", "WARRANTY"]
    for _ in range(3):
        for title in titles:
            pat = re.escape(title).replace(r"\ ", r"\s+")
            value = re.sub(r"^" + pat + r"\s+", "", value, flags=re.IGNORECASE).strip()
            value = re.sub(r"\s+" + pat + r"$", "", value, flags=re.IGNORECASE).strip()
    return value

def _clean_value(value):
    value = _fix_joined_words(value)
    value = value.replace("\n", " ").replace("\r", " ")
    value = re.sub(r"Product Compare.$", "", value, flags=re.IGNORECASE)
    value = re.sub(r"Product History.$", "", value, flags=re.IGNORECASE)
    value = re.sub(r"\d{1,2}/\d{1,2}/\d{2,4},\s*\d{1,2}:\d{2}\s*[AP]M.$", "", value, flags=re.IGNORECASE)
    value = re.sub(r"https?://\S+.$", "", value, flags=re.IGNORECASE)
    value = re.sub(r"Government e Marketplace.$", "", value, flags=re.IGNORECASE)
    value = _remove_edge_section_titles(value)
    value = re.sub(r"^(?:(GB)|GB)\s", "", value.strip(), flags=re.IGNORECASE)
    value = re.sub(r"^OEM\s+", "", value.strip(), flags=re.IGNORECASE)
    value = re.sub(r"^(?:(?:be installed in the System)?)?\s*", "", value.strip(), flags=re.IGNORECASE)
    value = re.sub(r"^Card/Module\s*", "", value.strip(), flags=re.IGNORECASE)
    value = re.sub(r"^Inch\s*", "", value.strip(), flags=re.IGNORECASE)
    value = re.sub(r"^(?:(?:Celsius)?)?\s*", "", value.strip(), flags=re.IGNORECASE)
    value = re.sub(r"\s+", " ", value).strip()
    return value

def _extract_specs_from_block(block):
    boundaries = _find_boundaries(block)
    specs = OrderedDict((field, "") for field in ALL_FIELDS)
    for idx, b in enumerate(boundaries):
        if b["type"] != "field": continue
        next_start = len(block)
        for nb in boundaries[idx + 1:]:
            if nb["start"] > b["end"]:
                next_start = nb["start"]
                break
        raw_value = block[b["end"]:next_start]
        specs[b["canonical"]] = _clean_value(raw_value)
    if specs.get("Type of RAM") == "DDR4":
        specs["Type of RAM"] = "DDR4 RAM"
    return specs

def _extract_model_no(pages):
    raw = "\n".join(pages or [])
    upper_raw = raw.upper()
    url_text = re.sub(r"\s+", " ", upper_raw)
    url_patterns = [
        r"ACXXEL-DESKTOP-(ACL-[A-Z0-9-]+)",
        r"/(ACL-[A-Z0-9-]+)/P-",
        r"(ACL-[A-Z0-9]+(?:-[A-Z0-9]+){2,})",
    ]
    for pat in url_patterns:
        m = re.search(pat, url_text, flags=re.IGNORECASE)
        if m:
            model = m.group(1).upper().strip("()[]{}.,;:")
            model = re.sub(r"[^A-Z0-9-]", "", model)
            if _valid_model_no(model):
                return model
    text = upper_raw
    text = text.replace("–", "-").replace("—", "-").replace("−", "-")
    text = re.sub(r"\s*-\s*", "-", text)
    text = re.sub(r"([A-Z0-9])\s*\n\s*([A-Z0-9])", r"\1\2", text)
    text = re.sub(r"[([{]\s*", " ", text)
    text = re.sub(r"\s*[)]}]", " ", text)
    text = re.sub(r"\s+", " ", text)
    model_patterns = [
        r"\bACL-[A-Z0-9]+(?:-[A-Z0-9]+){2,}\b",
        r"\bAIO[0-9A-Z-]{3,}\b",
        r"\bOM[0-9A-Z-]{2,}\b",
        r"\b[A-Z]{2,5}-[0-9A-Z]{2,}(?:-[0-9A-Z]{2,})+\b",
    ]
    for pat in model_patterns:
        matches = re.findall(pat, text, flags=re.IGNORECASE)
        for model in matches:
            model = model.upper().strip("()[]{}.,;:")
            model = re.sub(r"[^A-Z0-9-]", "", model)
            if _valid_model_no(model):
                return model
    return ""

def _valid_model_no(model):
    model = str(model or "").upper().strip()
    banned = {"MEITY", "DESKTOP", "COMPUTER", "INDIA", "PROCESSOR"}
    if not model or model in banned: return False
    if len(model) < 8: return False
    if model.count("-") < 2: return False
    if not re.search(r"\d", model): return False
    return True

def _fallback_hdd_value(raw_text):
    text = _fix_joined_words(raw_text)
    text = re.sub(r"\s+", " ", text)
    patterns = [
        r"HDD\s*-\s*Storage\s+Capacity\s+\(in\s+GB\)\s*(.*?)(?=\s+Product\s+Compare|\s+BAYS\s+AVAILABILITY|\s+CABINET|\s+PORTS|\s+CERTIFICATION|\s+WEB\s+INFO|$)",
        r"HDD\s+-\s+Storage\s+Capacity\s+\(in\s+GB\)\s*(.*?)(?=\s+Product\s+History|\s+\d{1,2}/\d{1,2}/\d{2,4}|$)",
    ]
    for pat in patterns:
        m = re.search(pat, text, flags=re.IGNORECASE)
        if m:
            val = _clean_value(m.group(1))
            if val: return val
    return ""

def _guess_category(text):
    low = str(text or "").lower()
    if "toner" in low or "cartridge" in low: return "Toner"
    if "printer" in low: return "Printer"
    if "desktop" in low or "computer" in low: return "Desktop"
    if "aio" in low or "all in one" in low: return "AIO"
    return ""

def _normalize_extra_specs(extra_specs):
    ordered = OrderedDict()
    for field in ALL_FIELDS:
        ordered[field] = _clean_value((extra_specs or {}).get(field, ""))
    if ordered.get("Type of RAM") == "DDR4":
        ordered["Type of RAM"] = "DDR4 RAM"
    return ordered

def _catalogue_product_data(product, request):
    extra_specs = product.extra_specs or {}
    if isinstance(extra_specs, str):
        try: extra_specs = json.loads(extra_specs)
        except Exception: extra_specs = {}
    extra_specs = _normalize_extra_specs(extra_specs)
    return {
        "id": product.id, "model_no": product.model_no or "",
        "processor": product.processor or "", "ram": product.ram or "",
        "storage": product.storage or "", "os": product.os or "",
        "category": product.category or "", "description": product.description or "",
        "extra_specs": extra_specs, "image": _file_url(request, product.image),
        "created_at": product.created_at.strftime("%Y-%m-%d") if product.created_at else "",
    }

# ════════════════════════════════════════════════════════════
# CATALOGUE PRODUCT APIs
# ════════════════════════════════════════════════════════════
@csrf_exempt
@require_http_methods(["POST"])
def extract_catalogue_pdf(request):
    try:
        pdf_file = request.FILES.get("pdf")
        if not pdf_file: return JsonResponse({"error": "PDF file is required"}, status=400)
        pages = _read_pdf_pages(pdf_file)
        raw_text = "\n".join(pages)
        block = _select_actual_block(pages)
        extra_specs = _extract_specs_from_block(block)
        if not extra_specs.get("HDD - Storage Capacity (in GB)"):
            hdd_val = _fallback_hdd_value(raw_text)
            if hdd_val: extra_specs["HDD - Storage Capacity (in GB)"] = hdd_val
        model_no = _extract_model_no(pages)
        category = _guess_category(raw_text)
        description = extra_specs.get("Description of Stores", "")
        processor = extra_specs.get("Processor Number", "")
        ram_size = extra_specs.get("RAM Size (Memory Card/Module) (in GB) (Capacity tobe installed in the System)", "")
        ram_type = extra_specs.get("Type of RAM", "")
        ram = " ".join(x for x in [ram_size, ram_type] if x).strip()
        storage_type = extra_specs.get("Type of Storage Installed with the System", "")
        ssd = extra_specs.get("SSD - Storage Capacity (in GB)", "")
        storage = " ".join(x for x in [ssd, storage_type] if x).strip()
        os_value = extra_specs.get("Factory Pre-loaded Operating System by DesktopOEM", "")
        if not model_no: return JsonResponse({"error": "Model No. PDF se extract nahi hua."}, status=400)
        return JsonResponse({
            "model_no": model_no, "category": category, "description": description,
            "processor": processor, "ram": ram, "storage": storage,
            "os": os_value, "extra_specs": extra_specs,
        }, status=200)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

@csrf_exempt
@require_http_methods(["GET"])
def list_catalogue_products(request):
    try:
        qs = CatalogueProduct.objects.all().order_by("-created_at")
        search = request.GET.get("search", "").strip()
        if search: qs = qs.filter(model_no__icontains=search)
        category = request.GET.get("category", "").strip()
        if category: qs = qs.filter(category__iexact=category)
        data = [_catalogue_product_data(p, request) for p in qs]
        return JsonResponse(data, safe=False, status=200)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

@csrf_exempt
@require_http_methods(["GET"])
def get_catalogue_product(request, product_id):
    try:
        product = CatalogueProduct.objects.get(id=product_id)
        return JsonResponse(_catalogue_product_data(product, request), status=200)
    except CatalogueProduct.DoesNotExist:
        return JsonResponse({"error": "Product not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

@csrf_exempt
def create_catalogue_product(request):
    if request.method != "POST": return JsonResponse({"error": "Use POST method"}, status=405)
    try:
        data = request.POST
        image = request.FILES.get("image")
        model_no = data.get("model_no", "").strip().upper()
        if not model_no: return JsonResponse({"error": "Model No. is required"}, status=400)
        if model_no in {"MEITY", "DESKTOP", "COMPUTER"}: return JsonResponse({"error": "Invalid model no. Please upload correct PDF."}, status=400)
        if CatalogueProduct.objects.filter(model_no__iexact=model_no).exists(): return JsonResponse({"error": "A product with this model no. already exists"}, status=400)
        try: extra_specs = json.loads(data.get("extra_specs", "{}"))
        except Exception: extra_specs = {}
        product = CatalogueProduct.objects.create(
            model_no=model_no, processor=data.get("processor", ""), ram=data.get("ram", ""),
            storage=data.get("storage", ""), os=data.get("os", ""), category=data.get("category", ""),
            description=data.get("description", ""), extra_specs=_normalize_extra_specs(extra_specs), image=image,
        )
        return JsonResponse({"message": "Catalogue product created successfully", **_catalogue_product_data(product, request)}, status=201)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

@csrf_exempt
def update_catalogue_product(request, product_id):
    if request.method not in ("POST", "PATCH"): return JsonResponse({"error": "Use POST or PATCH method"}, status=405)
    try:
        product = CatalogueProduct.objects.get(id=product_id)
        if request.content_type and "multipart" in request.content_type:
            data, files = MultiPartParser(request.META, request, request.upload_handlers, request.encoding).parse()
            image = files.get("image")
        else:
            data = request.POST
            image = request.FILES.get("image")
        model_no = data.get("model_no", "").strip().upper()
        if model_no:
            if model_no in {"MEITY", "DESKTOP", "COMPUTER"}: return JsonResponse({"error": "Invalid model no."}, status=400)
            duplicate = CatalogueProduct.objects.filter(model_no__iexact=model_no).exclude(id=product.id).exists()
            if model_no != product.model_no and duplicate: return JsonResponse({"error": "Another product with this model no. already exists"}, status=400)
            product.model_no = model_no
        for field in ["processor", "ram", "storage", "os", "category", "description"]:
            if field in data: setattr(product, field, data.get(field, ""))
        if "extra_specs" in data:
            try: extra_specs = json.loads(data.get("extra_specs", "{}"))
            except Exception: extra_specs = {}
            product.extra_specs = _normalize_extra_specs(extra_specs)
        if image: product.image = image
        product.save()
        return JsonResponse({"message": "Catalogue product updated successfully", **_catalogue_product_data(product, request)}, status=200)
    except CatalogueProduct.DoesNotExist:
        return JsonResponse({"error": "Product not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

@csrf_exempt
@require_http_methods(["DELETE"])
def delete_catalogue_product(request, product_id):
    try:
        product = CatalogueProduct.objects.get(id=product_id)
        product.delete()
        return JsonResponse({"message": "Catalogue product deleted successfully"}, status=200)
    except CatalogueProduct.DoesNotExist:
        return JsonResponse({"error": "Product not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

@csrf_exempt
@require_http_methods(["DELETE"])
def delete_all_catalogue_products(request):
    try:
        count, _ = CatalogueProduct.objects.all().delete()
        return JsonResponse({"message": f"{count} products deleted successfully", "deleted_count": count}, status=200)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


# ════════════════════════════════════════════════════════════
# DESKTOP BID — HELPER SERIALIZER
# ════════════════════════════════════════════════════════════
def _bid_data(bid, request, status_label=None):
    return {
        "id": bid.id, "user_name": bid.user.username if bid.user else "Unknown",
        "submitted_by": bid.user.username if bid.user else "Unknown",
        "bid_no": bid.bid_no, "dept_name": bid.dept_name, "qty": bid.qty,
        "organization": bid.organization or "", "address": bid.address or "",
        "pincode": bid.pincode or "", "atc": bid.atc or "",
        "atc_special_document": _file_url(request, bid.atc_special_document),
        "selected_general_docs": bid.selected_general_docs or [],
        "selected_general_doc_labels": bid.selected_general_doc_labels or [],
        "status": status_label if status_label else bid.status,
        "review_status": bid.review_status,
        "created_at": bid.created_at.strftime("%Y-%m-%d") if bid.created_at else "",
        "date": str(bid.date) if bid.date else "",
        "remark": bid.analyser_note or "", "remarks": bid.analyser_note or "",
        "analyser_note": bid.analyser_note or "",
        "analyser_name": bid.analyser_username or "", "analyser_username": bid.analyser_username or "",
        "admin_note": bid.admin_note or "", "admin_username": bid.admin_username or "",
        "model": bid.model_number or "", "model_number": bid.model_number or "",
        "processor_type": bid.processor_type or "", "processor": bid.processor or "",
        "processor_price": bid.processor_price or 0, "pro_descp": bid.pro_descp or "",
        "pro_descp_price": bid.pro_descp_price or 0, "ram": bid.ram or "",
        "ram_price": bid.ram_price or 0, "hdd": bid.hdd or "", "hdd_price": bid.hdd_price or 0,
        "ssd": bid.ssd1 or "", "ssd_price": bid.ssd1_price or 0, "ssd1": bid.ssd1 or "",
        "ssd1_price": bid.ssd1_price or 0, "ssd2": bid.ssd2 or "", "ssd2_price": bid.ssd2_price or 0,
        "os": bid.os or "", "os_price": bid.os_price or 0, "dvd": bid.dvd or "",
        "dvd_price": bid.dvd_price or 0, "wifi": bid.wifi or "", "wifi_price": bid.wifi_price or 0,
        "monitor": bid.monitor or "", "monitor_price": bid.monitor_price or 0,
        "cabinet": bid.cabinet or "", "cabinet_price": bid.cabinet_price or 0,
        "keyboard": bid.keyboard or "", "keyboard_price": bid.keyboard_price or 0,
        "warranty": bid.warranty or "", "warranty_price": bid.warranty_price or 0,
        "motherboard_type": bid.motherboard_type or "", "motherboard": bid.motherboard or "",
        "motherboard_price": bid.motherboard_price or 0, "motherboard_descp": bid.motherboard_descp or "",
        "motherboard_descp_price": bid.motherboard_descp_price or 0, "software1": bid.software1 or "",
        "software1_price": bid.software1_price or 0, "gp": bid.gp or "", "gp_price": bid.gp_price or 0,
        "epbg": bid.epbg or 0, "freightInstallation": bid.freightInstallation or "",
        "freightInstallation_price": bid.freightInstallation_price or 0, "freight_price": bid.freightInstallation_price or 0,
        "hddreturnable": bid.hddreturnable or "", "hddreturnable_price": bid.hddreturnable_price or 0,
        
        # ✅ Optional Ports (single field)
        "optional_ports": bid.optional_ports or "",
        "optional_port": bid.optional_ports or "",
        "optional_port1": bid.optional_ports or "",
        "optional_port2": "",
        "optional_port3": "",
    }

def _parse_json_list(value, default=None):
    if default is None: default = []
    try:
        parsed = json.loads(value or "[]")
        return parsed if isinstance(parsed, list) else default
    except Exception:
        return default

def _get_model_number_from_data(data):
    if data is None: return ""
    model = (
        data.get("model_number") or data.get("model") or data.get("selected_model") or
        data.get("matched_model") or data.get("model_no") or data.get("modelNo") or ""
    )
    if isinstance(model, dict):
        model = (
            model.get("model_number") or model.get("model_no") or
            model.get("modelNo") or model.get("model") or ""
        )
    return str(model or "").strip()


# ─────────────────────────────────────────────
# STEP 1 — Create Bid
# ─────────────────────────────────────────────
@csrf_exempt
@require_http_methods(["POST"])
def create_desktop_bid(request):
    try:
        data = request.POST
        user_id = data.get("user_id")
        if not user_id:
            return JsonResponse({"error": "User ID required"}, status=400)

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return JsonResponse({"error": "User not found"}, status=404)

        bid = DesktopBid.objects.create(
            user=user,
            bid_no=data.get("bid_no", ""),
            dept_name=data.get("dept_name", ""),
            organization=data.get("organization", ""),
            qty=int(data.get("qty", 0) or 0),
            address=data.get("address", ""),
            pincode=data.get("pincode", ""),
            atc=data.get("atc", ""),

            # USER STEP 1: DB me save hoga, lekin analyser/admin ko abhi nahi dikhega.
            status="draft",
            review_status="pending",

            processor="",
            ram="",
            os="",
            monitor="",
            cabinet="",
            warranty="",
            motherboard="",
            date="2000-01-01",

            selected_general_docs=[],
            selected_general_doc_labels=[],
        )

        return JsonResponse({
            "message": "Desktop Bid Created Successfully",
            "bid_id": bid.id,
            "user": user.username,
            "status": bid.status,
            "review_status": bid.review_status,
        }, status=201)

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


# ─────────────────────────────────────────────
# STEP 2 — Update Bid (Specs)
# ─────────────────────────────────────────────
@csrf_exempt
@require_http_methods(["POST"])
def update_desktop_bid(request, bid_id):
    try:
        bid = DesktopBid.objects.get(id=bid_id)
        data = json.loads(request.body)
        # MODEL NUMBER FIX: fetched ya manually filled dono save honge.
        model_number = _get_model_number_from_data(data)
        if model_number:
            bid.model_number = model_number

        bid.processor = data.get("processor", bid.processor)
        bid.processor_price = safe_float(data.get("processor_price"), bid.processor_price)
        bid.pro_descp = data.get("pro_descp", bid.pro_descp)
        bid.pro_descp_price = safe_float(data.get("pro_descp_price"), bid.pro_descp_price)

        bid.ram = data.get("ram", bid.ram)
        bid.ram_price = safe_float(data.get("ram_price"), bid.ram_price)

        bid.hdd = data.get("hdd", bid.hdd)
        bid.hdd_price = safe_float(data.get("hdd_price"), bid.hdd_price)

        bid.ssd1 = data.get("ssd") or data.get("ssd1") or bid.ssd1
        bid.ssd1_price = safe_float(data.get("ssd_price") or data.get("ssd1_price"), bid.ssd1_price)

        bid.ssd2 = data.get("ssd2", bid.ssd2)
        bid.ssd2_price = safe_float(data.get("ssd2_price"), bid.ssd2_price)

        bid.os = data.get("os", bid.os)
        bid.os_price = safe_float(data.get("os_price"), bid.os_price)

        bid.dvd = data.get("dvd", bid.dvd)
        bid.dvd_price = safe_float(data.get("dvd_price"), bid.dvd_price)

        bid.wifi = data.get("wifi", bid.wifi)
        bid.wifi_price = safe_float(data.get("wifi_price"), bid.wifi_price)

        bid.monitor = data.get("monitor", bid.monitor)
        bid.monitor_price = safe_float(data.get("monitor_price"), bid.monitor_price)

        bid.cabinet = data.get("cabinet", bid.cabinet)
        bid.cabinet_price = safe_float(data.get("cabinet_price"), bid.cabinet_price)

        bid.keyboard = data.get("keyboard", bid.keyboard)
        bid.keyboard_price = safe_float(data.get("keyboard_price"), bid.keyboard_price)

        bid.warranty = data.get("warranty", bid.warranty)
        bid.warranty_price = safe_float(data.get("warranty_price"), bid.warranty_price)

        bid.motherboard = data.get("motherboard", bid.motherboard)
        bid.motherboard_price = safe_float(data.get("motherboard_price"), bid.motherboard_price)
        bid.motherboard_descp = data.get("motherboard_descp", bid.motherboard_descp)
        bid.motherboard_descp_price = safe_float(data.get("motherboard_descp_price"), bid.motherboard_descp_price)

        bid.software1 = data.get("software1", bid.software1)
        bid.software1_price = safe_float(data.get("software1_price"), bid.software1_price)
        bid.gp = data.get("gp", bid.gp)
        bid.gp_price = safe_float(data.get("gp_price"), bid.gp_price)

        if data.get("date"):
            bid.date = data.get("date")

        bid.epbg = safe_float(data.get("epbg"), bid.epbg)

        bid.freightInstallation = data.get("freightInstallation", bid.freightInstallation)

        # "No" hone par price hamesha 0 save karo
        if bid.freightInstallation == "No":
            bid.freightInstallation_price = 0
        else:
            freight_price = data.get("freightInstallation_price")
            if freight_price and freight_price != "price":
                bid.freightInstallation_price = safe_float(freight_price, bid.freightInstallation_price)

        bid.hddreturnable = data.get("hddreturnable", bid.hddreturnable)

        if data.get("hddreturnable_price"):
            bid.hddreturnable_price = safe_float(data.get("hddreturnable_price"), bid.hddreturnable_price)

        # USER STEP 2: DB me save hoga, lekin analyser/admin ko abhi nahi dikhega.
        # USER STEP 3 docs ke baad hi status complete hoga.
        bid.status = "configured"
        bid.review_status = "pending"
        bid.save()

        return JsonResponse({
            "success": True,
            "bid_id": bid.id,
            "model_number": bid.model_number or "",
            "model": bid.model_number or "",
            "status": bid.status,
            "review_status": bid.review_status,
        }, status=200)

    except DesktopBid.DoesNotExist:
        return JsonResponse({"error": "Bid not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


# ─────────────────────────────────────────────
# STEP 3 — Save Model Number
# ─────────────────────────────────────────────
@csrf_exempt
@require_http_methods(["POST"])
def save_model_number(request, bid_id):
    try:
        bid = DesktopBid.objects.get(id=bid_id)
        data = json.loads(request.body)
        model_number = _get_model_number_from_data(data)

        if not model_number:
            return JsonResponse({"error": "Model number required"}, status=400)

        model_number = model_number.strip()

        # ✅ Duplicate model number check
        duplicate_exists = DesktopBid.objects.filter(
            model_number__iexact=model_number
        ).exclude(id=bid.id).exists()

        if duplicate_exists:
            return JsonResponse({
                "error": "Duplicate model number is not allowed."
            }, status=400)

        bid.model_number = model_number

        # Sirf model save karo. Is API se analyser/admin visibility change nahi hogi.
        if bid.status not in ["complete", "approved"]:
            bid.status = "configured"
            bid.review_status = "pending"

        bid.save()

        return JsonResponse({
            "success": True,
            "bid_id": bid.id,
            "model_number": bid.model_number,
            "model": bid.model_number,
            "status": bid.status,
            "review_status": bid.review_status,
        }, status=200)

    except DesktopBid.DoesNotExist:
        return JsonResponse({"error": "Bid not found"}, status=404)

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


# ─────────────────────────────────────────────
# PRICE CHECK VIEWS
# ─────────────────────────────────────────────
def get_price_for(component, value):
    return 0

@csrf_exempt
def check_processor(request):
    if request.method == "POST":
        data = json.loads(request.body)
        return JsonResponse({"price": get_price_for("processor", data.get("processor", ""))})

@csrf_exempt
def check_ram(request):
    if request.method == "POST":
        data = json.loads(request.body)
        return JsonResponse({"price": get_price_for("ram", data.get("ram", ""))})

@csrf_exempt
def check_hdd(request):
    if request.method == "POST":
        data = json.loads(request.body)
        return JsonResponse({"price": get_price_for("hdd", data.get("hdd", ""))})

@csrf_exempt
def check_ssd(request):
    if request.method == "POST":
        data = json.loads(request.body)
        return JsonResponse({"price": get_price_for("ssd", data.get("ssd", ""))})

@csrf_exempt
def check_os(request):
    if request.method == "POST":
        data = json.loads(request.body)
        return JsonResponse({"price": get_price_for("os", data.get("os", ""))})

@csrf_exempt
def check_dvd(request):
    if request.method == "POST":
        data = json.loads(request.body)
        return JsonResponse({"price": get_price_for("dvd", data.get("dvd", ""))})

@csrf_exempt
def check_wifi(request):
    if request.method == "POST":
        data = json.loads(request.body)
        return JsonResponse({"price": get_price_for("wifi", data.get("wifi", ""))})

@csrf_exempt
def check_motherboard(request):
    if request.method == "POST":
        data = json.loads(request.body)
        return JsonResponse({"price": get_price_for("motherboard", data.get("motherboard", ""))})

@csrf_exempt
def check_monitor_size(request):
    if request.method == "POST":
        data = json.loads(request.body)
        return JsonResponse({"price": get_price_for("monitor", data.get("monitor", ""))})

@csrf_exempt
def check_cabinet_type(request):
    if request.method == "POST":
        data = json.loads(request.body)
        return JsonResponse({"price": get_price_for("cabinet", data.get("cabinet", ""))})

@csrf_exempt
def check_keyboard(request):
    if request.method == "POST":
        data = json.loads(request.body)
        return JsonResponse({"price": get_price_for("keyboard", data.get("keyboard", ""))})

@csrf_exempt
def check_warranty(request):
    if request.method == "POST":
        data = json.loads(request.body)
        return JsonResponse({"price": get_price_for("warranty", data.get("warranty", ""))})


# ═══════════════════════════════════════════════════════════
# LIST BIDS
# ═══════════════════════════════════════════════════════════
@csrf_exempt
@require_http_methods(["GET"])
def list_desktop_bids(request):
    try:
        status_filter = request.GET.get("status", "pending")
        role = request.GET.get("role", "analyser")
        if role == "admin":
            status_map = {
                "pending": "reviewed",
                "re-analyze": "re-analyze",
                "approved": "approved",
            }
            db_status = status_map.get(status_filter, "reviewed")

            # Admin ko sirf analyser final submit ke baad dikhna chahiye.
            # approved: latest approved pehle (updated_at), baaki: latest created pehle
            if db_status == "approved":
                bids = DesktopBid.objects.filter(
                    status="complete",
                    review_status=db_status,
                ).order_by("-updated_at")
            else:
                bids = DesktopBid.objects.filter(
                    status="complete",
                    review_status=db_status,
                ).order_by("-updated_at")

        else:
            if status_filter == "reviewed":
                # Analyser history tab: admin ko bheje gaye / approved records.
                bids = DesktopBid.objects.filter(
                    status="complete",
                    review_status__in=["reviewed", "approved"],
                ).order_by("-created_at")
            else:
                # Analyser pending tab: user step 3 complete ke baad.
                bids = DesktopBid.objects.filter(
                    status="complete",
                    review_status=status_filter,
                ).order_by("-created_at")

        result = [_bid_data(bid, request, status_label=status_filter) for bid in bids]
        return JsonResponse(result, safe=False, status=200)

    except Exception as e:
        print("ERROR:", str(e))
        return JsonResponse({"error": str(e)}, status=400)


# ═══════════════════════════════════════════════════════════
# GET SINGLE BID
# ═══════════════════════════════════════════════════════════
@csrf_exempt
@require_http_methods(["GET"])
def get_desktop_bid(request, bid_id):
    try:
        bid = DesktopBid.objects.get(id=bid_id)
        return JsonResponse(_bid_data(bid, request), status=200)
    except DesktopBid.DoesNotExist:
        return JsonResponse({"error": "Bid not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


# ═══════════════════════════════════════════════════════════
# ANALYSER REVIEW
# ═══════════════════════════════════════════════════════════
@csrf_exempt
@require_http_methods(["PATCH"])
def review_desktop_bid(request, bid_id):
    try:
        bid = DesktopBid.objects.get(id=bid_id)
        data = json.loads(request.body)
        bid.bid_no = data.get("bid_no", bid.bid_no)
        bid.dept_name = data.get("dept_name", bid.dept_name)
        bid.organization = data.get("organization", bid.organization)
        bid.address = data.get("address", bid.address)
        bid.pincode = data.get("pincode", bid.pincode)
        bid.atc = data.get("atc", bid.atc)

        if data.get("qty"):
            bid.qty = int(data.get("qty"))

        model_number = _get_model_number_from_data(data)
        if model_number:
            bid.model_number = model_number

        bid.processor = data.get("processor", bid.processor)
        bid.processor_price = safe_float(data.get("processor_price"), bid.processor_price)
        bid.pro_descp = data.get("pro_descp", bid.pro_descp)
        bid.pro_descp_price = safe_float(data.get("pro_descp_price"), bid.pro_descp_price)

        bid.ram = data.get("ram", bid.ram)
        bid.ram_price = safe_float(data.get("ram_price"), bid.ram_price)

        bid.hdd = data.get("hdd", bid.hdd)
        bid.hdd_price = safe_float(data.get("hdd_price"), bid.hdd_price)

        bid.ssd1 = data.get("ssd1") or data.get("ssd") or bid.ssd1
        bid.ssd1_price = safe_float(
            data.get("ssd1_price") or data.get("ssd_price"),
            bid.ssd1_price
        )

        bid.ssd2 = data.get("ssd2", bid.ssd2)
        bid.ssd2_price = safe_float(data.get("ssd2_price"), bid.ssd2_price)

        bid.os = data.get("os", bid.os)
        bid.os_price = safe_float(data.get("os_price"), bid.os_price)

        bid.dvd = data.get("dvd", bid.dvd)
        bid.dvd_price = safe_float(data.get("dvd_price"), bid.dvd_price)

        bid.wifi = data.get("wifi", bid.wifi)
        bid.wifi_price = safe_float(data.get("wifi_price"), bid.wifi_price)

        bid.monitor = data.get("monitor", bid.monitor)
        bid.monitor_price = safe_float(data.get("monitor_price"), bid.monitor_price)

        bid.cabinet = data.get("cabinet", bid.cabinet)
        bid.cabinet_price = safe_float(data.get("cabinet_price"), bid.cabinet_price)

        bid.keyboard = data.get("keyboard", bid.keyboard)
        bid.keyboard_price = safe_float(data.get("keyboard_price"), bid.keyboard_price)

        bid.warranty = data.get("warranty", bid.warranty)
        bid.warranty_price = safe_float(data.get("warranty_price"), bid.warranty_price)

        bid.motherboard = data.get("motherboard", bid.motherboard)
        bid.motherboard_price = safe_float(data.get("motherboard_price"), bid.motherboard_price)
        bid.motherboard_descp = data.get("motherboard_descp", bid.motherboard_descp)
        bid.motherboard_descp_price = safe_float(data.get("motherboard_descp_price"), bid.motherboard_descp_price)

        bid.software1 = data.get("software1", bid.software1)
        bid.software1_price = safe_float(data.get("software1_price"), bid.software1_price)
        bid.gp = data.get("gp", bid.gp)
        bid.gp_price = safe_float(data.get("gp_price"), bid.gp_price)

        if data.get("date"):
            bid.date = data.get("date")

        bid.epbg = safe_float(data.get("epbg"), bid.epbg)

        bid.freightInstallation = data.get(
            "freightInstallation",
            bid.freightInstallation
        )

        # "No" hone par price hamesha 0 save karo
        if bid.freightInstallation == "No":
            bid.freightInstallation_price = 0
        else:
            freight_price = data.get("freightInstallation_price")
            if freight_price and freight_price != "price":
                bid.freightInstallation_price = safe_float(
                    freight_price,
                    bid.freightInstallation_price
                )

        bid.hddreturnable = data.get("hddreturnable", bid.hddreturnable)

        if data.get("hddreturnable_price"):
            bid.hddreturnable_price = safe_float(
                data.get("hddreturnable_price"),
                bid.hddreturnable_price
            )

        # ✅ NEW: Optional Ports Save (Analyser Re-Analyze)
        if "optional_ports" in data: bid.optional_ports = data.get("optional_ports") or ""
        elif "optional_port" in data: bid.optional_ports = data.get("optional_port") or ""
        elif "optional_port1" in data: bid.optional_ports = data.get("optional_port1") or ""

        bid.analyser_note = data.get("analyser_note") or data.get("remark") or bid.analyser_note

        analyser_username = (
            data.get("analyser_username")
            or data.get("analyser_name")
            or data.get("username")
            or ""
        ).strip()

        if analyser_username:
            bid.analyser_username = analyser_username

        # Analyser ne review complete kiya, ab document step par rahega
        bid.status = "complete"
        bid.review_status = "pending"
        bid.save()

        return JsonResponse({
            "success": True,
            "message": "Bid reviewed and saved successfully.",
            "bid_id": bid.id,
            "model_number": bid.model_number or "",
            "status": bid.status,
            "review_status": bid.review_status,
        }, status=200)

    except DesktopBid.DoesNotExist:
        return JsonResponse({"error": "Bid not found"}, status=404)

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)



# ═══════════════════════════════════════════════════════════
# DELETE BID  (Admin — approved bid delete)
# URL: /api/admin/desktop-bids/<bid_id>/delete/
# ═══════════════════════════════════════════════════════════
@csrf_exempt
@require_http_methods(["DELETE"])
def delete_desktop_bid(request, bid_id):
    try:
        bid = DesktopBid.objects.filter(id=bid_id).first()
        if not bid:
            return JsonResponse({"error": "Bid not found"}, status=404)
        bid.delete()
        return JsonResponse({"message": "Bid deleted successfully ✅"}, status=200)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)




# ═══════════════════════════════════════════════════════════
# ADMIN REVIEW
# ═══════════════════════════════════════════════════════════
@csrf_exempt
@require_http_methods(["PATCH"])
def admin_review_desktop_bid(request, bid_id):
    try:
        bid = DesktopBid.objects.get(id=bid_id)
        if request.content_type and request.content_type.startswith("multipart/form-data"):
            data, files = MultiPartParser(
                request.META, request, request.upload_handlers, request.encoding
            ).parse()
        else:
            data = json.loads(request.body)

        action = data.get("status", "")
        if action not in ("approved", "re-analyze"):
            return JsonResponse({"error": "Invalid status."}, status=400)

        bid.bid_no = data.get("bid_no", bid.bid_no)
        bid.dept_name = data.get("dept_name", bid.dept_name)
        bid.organization = data.get("organization", bid.organization)
        bid.address = data.get("address", bid.address)
        bid.pincode = data.get("pincode", bid.pincode)
        bid.atc = data.get("atc", bid.atc)

        if data.get("qty"):
            bid.qty = int(data.get("qty"))

        model_number = _get_model_number_from_data(data)
        if model_number:
            bid.model_number = model_number

        bid.processor = data.get("processor", bid.processor)
        bid.processor_price = safe_float(data.get("processor_price"), bid.processor_price)
        bid.pro_descp = data.get("pro_descp", bid.pro_descp)
        bid.pro_descp_price = safe_float(data.get("pro_descp_price"), bid.pro_descp_price)
        bid.ram = data.get("ram", bid.ram)
        bid.ram_price = safe_float(data.get("ram_price"), bid.ram_price)
        bid.hdd = data.get("hdd", bid.hdd)
        bid.hdd_price = safe_float(data.get("hdd_price"), bid.hdd_price)
        bid.ssd1 = data.get("ssd1") or data.get("ssd") or bid.ssd1
        bid.ssd1_price = safe_float(data.get("ssd1_price") or data.get("ssd_price"), bid.ssd1_price)
        bid.ssd2 = data.get("ssd2", bid.ssd2)
        bid.ssd2_price = safe_float(data.get("ssd2_price"), bid.ssd2_price)
        bid.os = data.get("os", bid.os)
        bid.os_price = safe_float(data.get("os_price"), bid.os_price)
        bid.dvd = data.get("dvd", bid.dvd)
        bid.dvd_price = safe_float(data.get("dvd_price"), bid.dvd_price)
        bid.wifi = data.get("wifi", bid.wifi)
        bid.wifi_price = safe_float(data.get("wifi_price"), bid.wifi_price)
        bid.monitor = data.get("monitor", bid.monitor)
        bid.monitor_price = safe_float(data.get("monitor_price"), bid.monitor_price)
        bid.cabinet = data.get("cabinet", bid.cabinet)
        bid.cabinet_price = safe_float(data.get("cabinet_price"), bid.cabinet_price)
        bid.keyboard = data.get("keyboard", bid.keyboard)
        bid.keyboard_price = safe_float(data.get("keyboard_price"), bid.keyboard_price)
        bid.warranty = data.get("warranty", bid.warranty)
        bid.warranty_price = safe_float(data.get("warranty_price"), bid.warranty_price)
        bid.motherboard = data.get("motherboard", bid.motherboard)
        bid.motherboard_price = safe_float(data.get("motherboard_price"), bid.motherboard_price)
        bid.motherboard_descp = data.get("motherboard_descp", bid.motherboard_descp)
        bid.motherboard_descp_price = safe_float(data.get("motherboard_descp_price"), bid.motherboard_descp_price)
        bid.software1 = data.get("software1", bid.software1)
        bid.software1_price = safe_float(data.get("software1_price"), bid.software1_price)
        bid.gp = data.get("gp", bid.gp)
        bid.gp_price = safe_float(data.get("gp_price"), bid.gp_price)

        if data.get("date"):
            bid.date = data.get("date")

        bid.epbg = safe_float(data.get("epbg"), bid.epbg)
        bid.freightInstallation = data.get("freightInstallation", bid.freightInstallation)
        # "No" hone par price hamesha 0 save karo
        if bid.freightInstallation == "No":
            bid.freightInstallation_price = 0
        else:
            bid.freightInstallation_price = safe_float(data.get("freightInstallation_price"), bid.freightInstallation_price)
        bid.hddreturnable = data.get("hddreturnable", bid.hddreturnable)
        bid.hddreturnable_price = safe_float(data.get("hddreturnable_price"), bid.hddreturnable_price)

        # ✅ Optional Ports Save (Admin Review)
        if "optional_ports" in data: bid.optional_ports = data.get("optional_ports") or ""
        elif "optional_port" in data: bid.optional_ports = data.get("optional_port") or ""
        elif "optional_port1" in data: bid.optional_ports = data.get("optional_port1") or ""
        bid.review_status = action
        bid.admin_note = data.get("admin_note", "").strip()
        bid.admin_username = data.get("admin_username", "").strip()

        bid.save()

        return JsonResponse({
            "success": True,
            "bid_id": bid.id,
            "review_status": bid.review_status,
            "model_number": bid.model_number or "",
            "model": bid.model_number or "",
            "message": "✅ Bid approved successfully!" if action == "approved" else "⚠️ Bid sent back to analyser.",
        })

    except DesktopBid.DoesNotExist:
        return JsonResponse({"error": "Bid not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


# ═══════════════════════════════════════════════════════════
# CATALOGUE MATCH API — UPDATED / CONFIG BASED
# ═══════════════════════════════════════════════════════════
# Logic:
# 1) Matching sirf DesktopConfig.jsx ke real configuration fields par hoga.
# 2) SSD2, prices, descriptions, date, EPBG, freight, HDD return, optional ports ignore honge.
# 3) Frontend body bheje ya na bheje — backend database values se fallback karega.
# 4) "None" / "No" / "Not Required" ko zero-like value maana jayega.
# 5) Catalogue me zero-like field absent ho aur bid me None ho, to wo field fail nahi karega.
# 6) Perfect match ka matlab: jitne matching fields check hue, sab pass. Minimum strong fields required.
# 7) Frontend ko sirf ek best model return hoga; debug_details sirf troubleshooting ke liye rahega.

MATCH_REQUIRED_FIELDS = 12
MIN_STRONG_MATCH_FIELDS = 8

_CATALOGUE_FIELD_MAP = {
    "processor": ["Processor Number", "Description of Stores"],
    "ram": [
        "RAM Size (Memory Card/Module) (in GB) (Capacity tobe installed in the System)",
        "RAM Size (Memory Card/Module) (in GB) (Capacity to be installed in the System)",
        "Type of RAM",
        "Memory Expandable Up To (in GB)",
    ],
    "hdd": ["HDD - Storage Capacity (in GB)"],
    "ssd": ["SSD - Storage Capacity (in GB)", "Type of Storage Installed with the System"],
    "os": [
        "Factory Pre-loaded Operating System by DesktopOEM",
        "Factory Pre-loaded Operating System by Desktop OEM",
        "Recovery Media for OS",
    ],
    "dvd": ["Optical Drive", "Bays for Optical Drive"],
    "wifi": ["Expansion Slots (M Dot 2) for WiFi"],
    "motherboard": [
        "Expansion Slots (PCIe x 1)",
        "Expansion Slots (PCIe x 4)",
        "Expansion Slots (PCIe x 16)",
        "Expansion Slots (M Dot 2) for SSD",
        "Expansion Slots (M Dot 2) for WiFi",
        "Trusted Platform Module",
        "Number of USB Type A Port (Version 2 Point 0)",
        "Number of USB Type A Port (Version 3 point 2 Gen 1)",
        "Number of USB Ports Type C",
        "Number of VGA Ports",
        "Number of HDMI Ports",
        "Number of DP Ports",
        "Type of Ethernet Ports",
        "Number of Ethernet Ports",
    ],
    "monitor": [
        "Availibility of Monitor",
        "Availability of Monitor",
        "Screen Size (in CMs)",
        "Maximum Resolution (Pixels)",
        "Panel Type",
        "Display Technology",
        "Monitor Port",
        "Speaker",
    ],
    "cabinet": ["Cabinet Form Factor"],
    "keyboard": ["Keyboard Connectivity", "Mouse Connectivity", "Type of Keyboard"],
    "warranty": ["On Site OEM Warranty (in Year)"],
}


def _raw_text(value):
    if value is None:
        return ""
    return str(value).lower().strip()


def _match_clean(value):
    raw = _raw_text(value)
    if raw in {"none", "no", "not required", "not applicable", "n/a", "na", "0"}:
        return "0"

    raw_joined = re.sub(r"[\s\-_\/()\"']+", " ", raw).strip()
    raw_joined = re.sub(r"\s+", " ", raw_joined)

    zero_phrases = {
        "no optical drive",
        "0 as ssd only installed",
        "0 as ssd installed",
        "ssd only installed",
        "no hdd",
        "without hdd",
        "no dvd",
        "no wifi",
        "no wi fi",
        "no bluetooth",
        "not required",
        "not applicable",
    }
    if raw_joined in zero_phrases:
        return "0"

    v = raw
    replacements = [
        ("₹", ""), (",", ""), ("-", ""), ("_", ""), ("/", ""),
        ("(", ""), (")", ""), ('"', ""), ("'", ""),
        ("windows 11 professional", "windows 11 pro"),
        ("window 11 professional", "windows 11 pro"),
        ("win 11 professional", "windows 11 pro"),
        ("win11", "windows 11"),
        ("dos or equivalent", "dos"),
        ("solid state drive", "ssd"),
        ("hard disk drive", "hdd"),
        ("wi fi", "wifi"),
        ("wi-fi", "wifi"),
        ("bluetooth", "bt"),
        ("nvme ssd", "nvme"),
        ("nvme-ssd", "nvme"),
        ("sata ssd", "sata"),
        ("small form factor", "sff"),
        ("small-form-factor", "sff"),
        ("small formfactor", "sff"),
        ("keyboard & mouse", "keyboard mouse"),
        ("keyboard and mouse", "keyboard mouse"),
        ("usb wired", "wired"),
        ("m dot 2", "m2"),
        ("m.2", "m2"),
        ("pcie", "pci"),
        ("pci express", "pci"),
        ("type a", ""),
    ]
    for old, new_value in replacements:
        v = v.replace(old, new_value)

    v = re.sub(r"\s+", " ", v).strip()
    if v in zero_phrases:
        return "0"
    return v


def _match_is_blank(value):
    raw = _raw_text(value)
    return raw in {"", "na", "n a", "null", "select", "no data", "undefined"}


def _is_zero_like(value):
    return _match_clean(value) in {"0", "00", "0 0"}


def _numbers_from_text(value):
    return re.findall(r"\d+(?:\.\d+)?", _match_clean(value))


def _storage_to_gb(value):
    if _is_zero_like(value):
        return 0
    text = _match_clean(value)
    if not text:
        return None
    m_tb = re.search(r"(\d+(?:\.\d+)?)\s*tb", text)
    if m_tb:
        return int(float(m_tb.group(1)) * 1000)
    m_gb = re.search(r"(\d+(?:\.\d+)?)\s*gb", text)
    if m_gb:
        return int(float(m_gb.group(1)))
    return None


def _values_overlap_score(bid_value, catalogue_value):
    if _match_is_blank(catalogue_value):
        return -1
    if _is_zero_like(bid_value) and _is_zero_like(catalogue_value):
        return 3000

    b = _match_clean(bid_value)
    c = _match_clean(catalogue_value)
    if not b or not c:
        return -1
    if b == c:
        return 2500

    b_storage = _storage_to_gb(bid_value)
    c_storage = _storage_to_gb(catalogue_value)
    if b_storage is not None and c_storage is not None and b_storage == c_storage:
        return 2200

    if b in c or c in b:
        return 2000

    score = 0
    b_nums = _numbers_from_text(bid_value)
    c_nums = _numbers_from_text(catalogue_value)
    if b_nums and c_nums:
        score += len(set(b_nums).intersection(set(c_nums))) * 100

    b_words = {w for w in b.split() if len(w) > 1}
    c_words = {w for w in c.split() if len(w) > 1}
    score += len(b_words.intersection(c_words)) * 25
    return score


def _specs_match(bid_value, catalogue_value):
    if _match_is_blank(bid_value):
        return None
    if _match_is_blank(catalogue_value):
        return False
    return _values_overlap_score(bid_value, catalogue_value) >= 100


def _catalogue_extra_specs(product):
    extra_specs = product.extra_specs or {}
    if isinstance(extra_specs, str):
        try:
            extra_specs = json.loads(extra_specs)
        except Exception:
            extra_specs = {}
    return extra_specs if isinstance(extra_specs, dict) else {}


def _catalogue_values_for_keys(product, keys):
    extra_specs = _catalogue_extra_specs(product)
    pairs = []
    for key in keys:
        val = extra_specs.get(key, "")
        if val not in (None, ""):
            pairs.append((key, str(val)))
    return pairs


def _extract_feature_from_label_value(label, value):
    label_clean = _match_clean(label)
    value_clean = _match_clean(value)
    nums = _numbers_from_text(value)
    num = int(float(nums[0])) if nums else (1 if value_clean and value_clean != "0" else 0)
    mapping = {}

    if "pci x 1" in label_clean or "pci x1" in label_clean:
        mapping["pcie_x1"] = num
    elif "pci x 4" in label_clean or "pci x4" in label_clean:
        mapping["pcie_x4"] = num
    elif "pci x 16" in label_clean or "pci x16" in label_clean:
        mapping["pcie_x16"] = num
    elif "m2 for ssd" in label_clean or ("m2" in label_clean and "ssd" in label_clean):
        mapping["m2_ssd"] = num
    elif "m2 for wifi" in label_clean or ("m2" in label_clean and "wifi" in label_clean):
        mapping["m2_wifi"] = num
    elif "trusted platform module" in label_clean or "tpm" in label_clean:
        mapping["tpm"] = 1 if "tpm" in value_clean or value_clean not in {"0", "no"} else 0
    elif "usb port version 2" in label_clean or "usb 2" in label_clean:
        mapping["usb2"] = num
    elif "usb port version 3" in label_clean or "usb 3" in label_clean:
        mapping["usb3"] = num
    elif "usb ports type c" in label_clean or "type c" in label_clean:
        mapping["type_c"] = num
    elif "vga ports" in label_clean or label_clean == "vga":
        mapping["vga"] = num
    elif "hdmi ports" in label_clean or label_clean == "hdmi":
        mapping["hdmi"] = num
    elif "dp ports" in label_clean or label_clean == "dp":
        mapping["dp"] = num
    elif "ethernet ports" in label_clean:
        mapping["ethernet"] = num
    return mapping


def _extract_motherboard_features_from_text(text):
    t = _match_clean(text)
    features = {
        "pcie_x1": 0,
        "pcie_x4": 0,
        "pcie_x16": 0,
        "m2_ssd": 0,
        "m2_wifi": 0,
        "tpm": 0,
        "usb2": 0,
        "usb3": 0,
        "type_c": 0,
        "vga": 0,
        "hdmi": 0,
        "dp": 0,
        "ethernet": 0,
    }

    patterns = [
        ("pcie_x16", r"pci\s*x\s*16\s*(?:-|:)?\s*(\d+)"),
        ("pcie_x16", r"pci16\s*\*?\s*(\d+)"),
        ("pcie_x1", r"pci\s*x\s*1(?!\d)\s*(?:-|:)?\s*(\d+)"),
        ("pcie_x1", r"pci1(?!\d)\s*\*?\s*(\d+)"),
        ("pcie_x4", r"pci\s*x\s*4\s*(?:-|:)?\s*(\d+)"),
        ("pcie_x4", r"pci\s*4\s*x\s*(\d+)"),
        ("pcie_x4", r"pci4\s*\*?\s*(\d+)"),
        ("m2_ssd", r"m2\s*(\d+)"),
        ("usb2", r"(\d+)\s*usb\s*2"),
        ("usb3", r"(\d+)\s*usb\s*3"),
        ("type_c", r"type\s*c\s*(\d+)"),
    ]
    for key, pattern in patterns:
        m = re.search(pattern, t)
        if m:
            features[key] = int(m.group(1))

    if "m2 wifi" in t or "wifi" in t:
        features["m2_wifi"] = max(features["m2_wifi"], 1)
    if "tpm" in t:
        features["tpm"] = 1
    if "type c" in t or "typec" in t:
        features["type_c"] = max(features["type_c"], 1)
    if "vga" in t:
        features["vga"] = 1
    if "hdmi" in t:
        features["hdmi"] = 1
    if re.search(r"\bdp\b", t) or "display port" in t:
        features["dp"] = 1
    if "ethernet" in t or "gigabit" in t or "lan" in t:
        features["ethernet"] = 1
    return features


def _extract_motherboard_features_from_catalogue(product, catalogue_keys):
    features = {
        "pcie_x1": 0,
        "pcie_x4": 0,
        "pcie_x16": 0,
        "m2_ssd": 0,
        "m2_wifi": 0,
        "tpm": 0,
        "usb2": 0,
        "usb3": 0,
        "type_c": 0,
        "vga": 0,
        "hdmi": 0,
        "dp": 0,
        "ethernet": 0,
    }
    for label, value in _catalogue_values_for_keys(product, catalogue_keys):
        extracted = _extract_feature_from_label_value(label, value)
        for k, v in extracted.items():
            features[k] = v
    return features


def _motherboard_match_50_percent(bid_value, product, catalogue_keys):
    if _match_is_blank(bid_value):
        return None, "", "", 0
    bid_features = _extract_motherboard_features_from_text(bid_value)
    cat_features = _extract_motherboard_features_from_catalogue(product, catalogue_keys)
    required_motherboard_keys = {"pcie_x1", "pcie_x4", "pcie_x16", "m2_ssd", "m2_wifi", "tpm"}

    checked = 0
    matched = 0
    details = []
    for key, bid_val in bid_features.items():
        if key not in required_motherboard_keys:
            continue
        if bid_val == 0:
            continue
        checked += 1
        cat_val = cat_features.get(key, 0)
        ok = bid_val == cat_val
        if ok:
            matched += 1
        details.append(f"{key}: bid={bid_val}, catalogue={cat_val}, {'OK' if ok else 'NO'}")

    if checked == 0:
        return False, "Motherboard + Ports", "No bid motherboard features", 0
    percent = round((matched / checked) * 100, 2)
    return matched >= 1, "Motherboard + Ports Flexible Rule", " | ".join(details), percent


def _monitor_size_match(bid_value, product, catalogue_keys):
    if _match_is_blank(bid_value):
        return None
    bid_nums = _numbers_from_text(bid_value)
    if not bid_nums:
        return None
    bid_size = float(bid_nums[0])
    screen_values = []
    for key, val in _catalogue_values_for_keys(product, catalogue_keys):
        if "screen size" in _match_clean(key):
            screen_values.append(str(val))
    if not screen_values:
        return None
    for screen_value in screen_values:
        nums = [float(x) for x in _numbers_from_text(screen_value)]
        if not nums:
            continue
        inch_nums = [n for n in nums if n <= 35]
        if not inch_nums:
            inch_nums = nums
        min_size = min(inch_nums)
        max_size = max(inch_nums)
        if (min_size - 1) <= bid_size <= (max_size + 1):
            return True, "Monitor Screen Size", screen_value, 2800
    return False, "Monitor Screen Size", " | ".join(screen_values), 0


def _cabinet_match(bid_value, product, catalogue_keys):
    if _match_is_blank(bid_value):
        return None
    pairs = _catalogue_values_for_keys(product, catalogue_keys)
    combined = " ".join([_match_clean(v) for _, v in pairs])
    b = _match_clean(bid_value)
    if b == "sff" and ("sff" in combined or "7 to 13" in combined):
        return True, "Cabinet Form Factor", combined, 2500
    if "tower" in b and "tower" in combined:
        return True, "Cabinet Form Factor", combined, 2500
    for key, val in pairs:
        if _specs_match(bid_value, val):
            return True, key, val, 1500
    if _is_zero_like(bid_value) and not pairs:
        return True, "Cabinet Form Factor", "Catalogue value blank; bid zero-like", 1000
    return False, "Cabinet Form Factor", combined, 0


def _keyboard_match(bid_value, product, catalogue_keys):
    if _match_is_blank(bid_value):
        return None
    b = _match_clean(bid_value)
    pairs = _catalogue_values_for_keys(product, catalogue_keys)
    combined = " ".join([_match_clean(v) for _, v in pairs])
    if "wired" in b and "wired" in combined:
        return True, "Keyboard/Mouse Connectivity", combined, 2500
    if "wireless" in b and "wireless" in combined:
        return True, "Keyboard/Mouse Connectivity", combined, 2500
    return False, "Keyboard/Mouse Connectivity", combined, 0


def _special_zero_field_match(bid_key, bid_value, product, catalogue_keys):
    if not _is_zero_like(bid_value):
        return None
    pairs = _catalogue_values_for_keys(product, catalogue_keys)

    # Bid me None hai aur catalogue me field available nahi hai — optional zero-like fields ko fail na karo.
    if not pairs and bid_key in {"hdd", "dvd", "wifi"}:
        return True, bid_key, "Catalogue value blank; bid value is None", 1000

    if bid_key == "hdd":
        for key, val in pairs:
            if _is_zero_like(val) or "ssd only" in _match_clean(val):
                return True, key, val, 3000
    if bid_key == "dvd":
        for key, val in pairs:
            cv = _match_clean(val)
            if _is_zero_like(val) or "no optical drive" in _raw_text(val) or cv == "0":
                return True, key, val, 3000
    if bid_key == "wifi":
        # DesktopConfig me WiFi None means separate WiFi card nahi. Catalogue me M.2 WiFi slot 1 bhi acceptable hai.
        for key, val in pairs:
            nums = _numbers_from_text(val)
            if nums and int(float(nums[0])) >= 1:
                return True, key, val, 2500
            if _is_zero_like(val):
                return True, key, val, 2500
    return False, "", "", 0


def _best_catalogue_match(bid_key, bid_value, product, catalogue_keys):
    if _match_is_blank(bid_value):
        return None, "", "", -1

    if bid_key == "monitor":
        monitor_match = _monitor_size_match(bid_value, product, catalogue_keys)
        if monitor_match is not None:
            return monitor_match
    if bid_key == "motherboard":
        return _motherboard_match_50_percent(bid_value, product, catalogue_keys)
    if bid_key == "cabinet":
        return _cabinet_match(bid_value, product, catalogue_keys)
    if bid_key == "keyboard":
        return _keyboard_match(bid_value, product, catalogue_keys)

    special = _special_zero_field_match(bid_key, bid_value, product, catalogue_keys)
    if special is not None:
        return special

    direct_map = {
        "processor": product.processor or "",
        "ram": product.ram or "",
        "ssd": product.storage or "",
        "hdd": product.storage or "",
        "os": product.os or "",
    }

    candidates = []
    direct_value = direct_map.get(bid_key, "")
    if direct_value:
        candidates.append((f"{bid_key} (catalogue summary)", str(direct_value)))
    if bid_key == "processor" and product.description:
        candidates.append(("Description of Stores", str(product.description)))
    candidates.extend(_catalogue_values_for_keys(product, catalogue_keys))

    if not candidates:
        return False, "", "", -1

    best_key = ""
    best_value = ""
    best_score = -1
    for key_label, value in candidates:
        score = _values_overlap_score(bid_value, value)
        if score > best_score:
            best_score = score
            best_key = key_label
            best_value = value

    matched = best_score >= 100
    return matched, best_key, best_value, best_score


def _body_json(request):
    try:
        if request.body:
            data = json.loads(request.body)
            return data if isinstance(data, dict) else {}
    except Exception:
        return {}
    return {}


def _value_from_body_or_bid(body, bid, *keys):
    for key in keys:
        val = body.get(key)
        if val not in (None, ""):
            return str(val).strip()
    for key in keys:
        if hasattr(bid, key):
            val = getattr(bid, key)
            if val not in (None, ""):
                return str(val).strip()
    return ""


@csrf_exempt
@require_http_methods(["POST"])
def match_catalogue_models(request, bid_id):
    try:
        bid = DesktopBid.objects.get(id=bid_id)
    except DesktopBid.DoesNotExist:
        return JsonResponse({"error": "Bid not found"}, status=404)

    body = _body_json(request)

    bid_specs = {
        "processor": _value_from_body_or_bid(body, bid, "processor"),
        "ram": _value_from_body_or_bid(body, bid, "ram"),
        "hdd": _value_from_body_or_bid(body, bid, "hdd"),
        # SSD2 intentionally ignored. Sirf SSD1 / ssd match hoga.
        "ssd": _value_from_body_or_bid(body, bid, "ssd", "ssd1"),
        "os": _value_from_body_or_bid(body, bid, "os"),
        "dvd": _value_from_body_or_bid(body, bid, "dvd"),
        "wifi": _value_from_body_or_bid(body, bid, "wifi"),
        "motherboard": _value_from_body_or_bid(body, bid, "motherboard"),
        "monitor": _value_from_body_or_bid(body, bid, "monitor"),
        "cabinet": _value_from_body_or_bid(body, bid, "cabinet"),
        "keyboard": _value_from_body_or_bid(body, bid, "keyboard"),
        "warranty": _value_from_body_or_bid(body, bid, "warranty"),
    }

    results = []
    debug_all = []

    for product in CatalogueProduct.objects.all():
        matched_count = 0
        checked_count = 0
        total_score = 0
        details = []

        for bid_key, catalogue_keys in _CATALOGUE_FIELD_MAP.items():
            bid_value = bid_specs.get(bid_key, "")
            if _match_is_blank(bid_value):
                continue

            matched, best_key, best_value, best_score = _best_catalogue_match(
                bid_key, bid_value, product, catalogue_keys
            )
            checked_count += 1

            if matched:
                matched_count += 1
                total_score += max(float(best_score or 0), 0)
            else:
                total_score += max(float(best_score or 0), 0) * 0.25

            details.append({
                "field": bid_key,
                "bid_value": bid_value,
                "matched": bool(matched),
                "catalogue_key": best_key,
                "catalogue_value": best_value,
                "score": best_score,
            })

        if checked_count == 0:
            continue

        is_perfect = checked_count >= MIN_STRONG_MATCH_FIELDS and matched_count == checked_count

        result = {
            "model_no": product.model_no or "",
            "product_id": product.id,
            "category": product.category or "",
            "match_count": matched_count,
            "total_checked": checked_count,
            "total_score": round(total_score, 2),
            "is_perfect": is_perfect,
            "debug_details": details,
        }
        results.append(result)
        debug_all.append(result)

    perfect_results = [r for r in results if r["is_perfect"]]

    if not perfect_results:
        # Best failed item bhi bhej rahe hain taaki pata chale kaunsa field fail ho raha hai.
        debug_all.sort(key=lambda x: (-x["match_count"], -x["total_score"], x["model_no"]))
        best_failed = debug_all[0] if debug_all else None
        return JsonResponse({
            "match": None,
            "matches": [],
            "total_found": 0,
            "has_perfect_match": False,
            "message": "Exact matching model nahi mila.",
            "bid_specs_used": bid_specs,
            "best_failed_match": best_failed,
        }, status=200)

    perfect_results.sort(key=lambda x: (-x["match_count"], -x["total_score"], x["model_no"]))
    best = perfect_results[0]

    best_public = {
        "model_no": best["model_no"],
        "product_id": best["product_id"],
        "category": best["category"],
    }

    return JsonResponse({
        "match": best_public,
        "matches": [best_public],
        "total_found": 1,
        "has_perfect_match": True,
        "message": "Exact matching model found.",
        "bid_specs_used": bid_specs,
    }, status=200)


PROJECT_START_YEAR = 2026
def _get_year(request):
    try:
        return int(request.GET.get("year", timezone.now().year))
    except:
        return timezone.now().year

def _get_status_label(bid):
    if bid.review_status in ["reviewed", "approved"]:
        return "reviewed"
    if bid.review_status == "re-analyze":
        return "re-analyze"
    return "pending"

def _get_analyser_base_queryset(year=None):
    qs = DesktopBid.objects.filter(status="complete")
    if year:
        qs = qs.filter(created_at__year=year)

    return qs

@csrf_exempt
@require_http_methods(["GET"])
def desktop_dashboard_years(request):
    try:
        current_year = timezone.now().year
        end_year = max(current_year + 5, PROJECT_START_YEAR + 5)
        years = list(range(PROJECT_START_YEAR, end_year + 1))

        return JsonResponse(years, safe=False, status=200)

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

@csrf_exempt
@require_http_methods(["GET"])
def desktop_monthly_performance(request):
    try:
        year = _get_year(request)
        months = [
            "Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
        ]

        result = []

        for index, month_name in enumerate(months, start=1):
            result.append({
                "month": month_name,
                "monthNumber": index,
                "total": 0,
                "pending": 0,
                "reviewed": 0,
                "reAnalyze": 0,
            })

        bids = _get_analyser_base_queryset(year)

        for bid in bids:
            if not bid.created_at:
                continue

            month_index = bid.created_at.month - 1
            status_label = _get_status_label(bid)

            result[month_index]["total"] += 1

            if status_label == "pending":
                result[month_index]["pending"] += 1
            elif status_label == "reviewed":
                result[month_index]["reviewed"] += 1
            elif status_label == "re-analyze":
                result[month_index]["reAnalyze"] += 1

        return JsonResponse(result, safe=False, status=200)

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

@csrf_exempt
@require_http_methods(["GET"])
def desktop_daily_activity(request):
    try:
        today = timezone.localdate()
        sunday = today - timedelta(days=(today.weekday() + 1) % 7)
        days = []
        current_day = sunday

        while current_day <= today:
            days.append(current_day)
            current_day += timedelta(days=1)

        result = []

        for d in days:
            result.append({
                "date": d.strftime("%Y-%m-%d"),
                "day": d.strftime("%A"),
                "shortDay": d.strftime("%a"),
                "total": 0,
                "pending": 0,
                "reviewed": 0,
                "reAnalyze": 0,
            })

        bids = DesktopBid.objects.filter(
            status="complete",
            created_at__date__gte=sunday,
            created_at__date__lte=today,
        )

        date_map = {item["date"]: item for item in result}

        for bid in bids:
            if not bid.created_at:
                continue

            bid_date = timezone.localtime(bid.created_at).date().strftime("%Y-%m-%d")

            if bid_date not in date_map:
                continue

            status_label = _get_status_label(bid)

            date_map[bid_date]["total"] += 1

            if status_label == "pending":
                date_map[bid_date]["pending"] += 1
            elif status_label == "reviewed":
                date_map[bid_date]["reviewed"] += 1
            elif status_label == "re-analyze":
                date_map[bid_date]["reAnalyze"] += 1

        return JsonResponse(result, safe=False, status=200)

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

@csrf_exempt
@require_http_methods(["GET"])
def desktop_re_analyze_count(request):
    try:
        year = request.GET.get("year")
        qs = DesktopBid.objects.filter(
            status="complete",
            review_status="re-analyze",
        )

        if year:
            qs = qs.filter(created_at__year=int(year))

        return JsonResponse({"count": qs.count()}, status=200)

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


PROJECT_START_YEAR = 2026
def _get_year(request):
    try:
        return int(request.GET.get("year", timezone.now().year))
    except Exception:
        return timezone.now().year

def _get_admin_status_label(bid):
    """ Admin side ke liye status label:
    - review_status = "reviewed" → admin ke liye "pending" (abhi review karna hai)
    - review_status = "approved" → admin ne approve kiya
    - review_status = "re-analyze" → admin ne wapas bheja
    """
    if bid.review_status == "approved":
        return "approved"
    if bid.review_status == "re-analyze":
        return "re-analyze"
    # reviewed → admin ke liye pending
    return "pending"

def _get_admin_base_queryset(year=None):
    """ Admin ko sirf wo bids dikhni chahiye jo analyser ne final submit kar di hain.
    status="complete" AND review_status IN ("reviewed", "approved", "re-analyze")
    """
    qs = DesktopBid.objects.filter(
        status="complete",
        review_status__in=["reviewed", "approved", "re-analyze"],
    )
    if year:
        qs = qs.filter(created_at__year=year)
    return qs


# ═══════════════════════════════════════════════════════════
# ADMIN — AVAILABLE YEARS
# URL: /api/admin/desktop-bids/dashboard-years/
# ═══════════════════════════════════════════════════════════
@csrf_exempt
@require_http_methods(["GET"])
def admin_desktop_dashboard_years(request):
    try:
        current_year = timezone.now().year
        end_year = max(current_year + 5, PROJECT_START_YEAR + 5)
        years = list(range(PROJECT_START_YEAR, end_year + 1))
        return JsonResponse(years, safe=False, status=200)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


# ═══════════════════════════════════════════════════════════
# ADMIN — MONTHLY PERFORMANCE
# URL: /api/admin/desktop-bids/monthly-performance/?year=2026
# Admin-specific columns:
# pending = review_status="reviewed" (analyser submitted, admin hasn't acted yet)
# approved = review_status="approved"
# reAnalyze = review_status="re-analyze"
# ═══════════════════════════════════════════════════════════
@csrf_exempt
@require_http_methods(["GET"])
def admin_desktop_monthly_performance(request):
    try:
        year = _get_year(request)
        analyser = request.GET.get("analyser")  # analyser filter
        months = [
            "Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
        ]

        result = []
        for index, month_name in enumerate(months, start=1):
            result.append({
                "month": month_name,
                "monthNumber": index,
                "total": 0,
                "pending": 0,
                "approved": 0,
                "rejected": 0,
            })

        bids = _get_admin_base_queryset(year)
        if analyser:
            bids = bids.filter(analyser_username=analyser)

        for bid in bids:
            if not bid.created_at:
                continue

            month_index = bid.created_at.month - 1
            label = _get_admin_status_label(bid)

            result[month_index]["total"] += 1

            if label == "pending":
                result[month_index]["pending"] += 1
            elif label == "approved":
                result[month_index]["approved"] += 1
            elif label == "re-analyze":
                result[month_index]["rejected"] += 1

        return JsonResponse(result, safe=False, status=200)

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


# ═══════════════════════════════════════════════════════════
# ADMIN — DAILY ACTIVITY (current week: Sun → today)
# URL: /api/admin/desktop-bids/daily-activity/
# ═══════════════════════════════════════════════════════════
@csrf_exempt
@require_http_methods(["GET"])
def admin_desktop_daily_activity(request):
    try:
        today = timezone.localdate()
        sunday = today - timedelta(days=(today.weekday() + 1) % 7)
        days = []
        current_day = sunday
        while current_day <= today:
            days.append(current_day)
            current_day += timedelta(days=1)

        result = []
        for d in days:
            result.append({
                "date": d.strftime("%Y-%m-%d"),
                "day": d.strftime("%A"),
                "shortDay": d.strftime("%a"),
                "total": 0,
                "pending": 0,
                "approved": 0,
                "rejected": 0,
            })

        analyser = request.GET.get("analyser")  # analyser filter

        bids_qs = DesktopBid.objects.filter(
            status="complete",
            review_status__in=["reviewed", "approved", "re-analyze"],
            created_at__date__gte=sunday,
            created_at__date__lte=today,
        )
        if analyser:
            bids_qs = bids_qs.filter(analyser_username=analyser)

        date_map = {item["date"]: item for item in result}

        for bid in bids_qs:
            if not bid.created_at:
                continue

            bid_date = timezone.localtime(bid.created_at).date().strftime("%Y-%m-%d")
            if bid_date not in date_map:
                continue

            label = _get_admin_status_label(bid)
            date_map[bid_date]["total"] += 1

            if label == "pending":
                date_map[bid_date]["pending"] += 1
            elif label == "approved":
                date_map[bid_date]["approved"] += 1
            elif label == "re-analyze":
                date_map[bid_date]["rejected"] += 1

        return JsonResponse(result, safe=False, status=200)

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


# ═══════════════════════════════════════════════════════════
# ADMIN — STATS COUNTS
# URL: /api/admin/desktop-bids/stats/
# Ek hi API call mein saare counts:
# pending = analyser submitted, admin ne abhi review nahi kiya
# approved = admin approved
# reAnalyze = admin ne re-analyze bheja
# total = upar teeno ka sum
# ═══════════════════════════════════════════════════════════
@csrf_exempt
@require_http_methods(["GET"])
def admin_desktop_stats(request):
    try:
        year = request.GET.get("year")
        analyser = request.GET.get("analyser")  # analyser filter
        base_qs = DesktopBid.objects.filter(status="complete")
        if year:
            base_qs = base_qs.filter(created_at__year=int(year))
        if analyser:
            base_qs = base_qs.filter(analyser_username=analyser)

        pending = base_qs.filter(review_status="reviewed").count()
        approved = base_qs.filter(review_status="approved").count()
        re_analyze = base_qs.filter(review_status="re-analyze").count()

        return JsonResponse({
            "pending": pending,
            "approved": approved,
            "reAnalyze": re_analyze,
            "total": pending + approved + re_analyze,
        }, status=200)

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)