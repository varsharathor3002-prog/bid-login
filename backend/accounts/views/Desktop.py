from django.http import JsonResponse
from django.http.multipartparser import MultiPartParser
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.hashers import make_password, check_password
from django.conf import settings
from django.core import signing
from django.db import IntegrityError, transaction
import json
from django.utils import timezone
from datetime import timedelta
from django.views.decorators.http import require_http_methods
from django.test import RequestFactory
from ..models import User, DesktopBid, CatalogueProduct
from ..restricted_pincodes import is_restricted_pincode, restriction_message
import re
import os
import shutil
from collections import OrderedDict
import tempfile
from pathlib import Path

try:
    import fitz
except ImportError:
    fitz = None

try:
    from PyPDF2 import PdfReader
except Exception:
    PdfReader = None

@csrf_exempt
def register(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            username = (data.get("username") or "").strip()
            email = (data.get("email") or "").strip().lower()
            password = data.get("password")

            if not username or not email or not password:
                return JsonResponse({"error": "All fields required"}, status=400)

            if User.objects.filter(email__iexact=email).exists():
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

@csrf_exempt
def register_analyser(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            username = (data.get("username") or "").strip()
            email = (data.get("email") or "").strip().lower()
            password = data.get("password")

            if not username or not email or not password:
                return JsonResponse({"error": "All fields required"}, status=400)

            if User.objects.filter(email__iexact=email).exists():
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


@csrf_exempt
def admin_list(request):
    if request.method == "GET":
        admins = User.objects.filter(role="admin")
        data = [{"id": admin.id, "username": admin.username, "email": admin.email} for admin in admins]
        return JsonResponse(data, safe=False)
    return JsonResponse({"error": "Use GET method"}, status=405)


@csrf_exempt
def register_admin(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            username = (data.get("username") or "").strip()
            email = (data.get("email") or "").strip().lower()
            password = data.get("password")
            if not username or not email or not password:
                return JsonResponse({"error": "All fields are required."}, status=400)
            if User.objects.filter(email__iexact=email).exists():
                return JsonResponse({"error": "Email already exists."}, status=400)
            User.objects.create(
                username=username,
                email=email,
                password=make_password(password),
                role="admin",
            )
            return JsonResponse({"message": "Admin registered successfully."})
        except (json.JSONDecodeError, TypeError):
            return JsonResponse({"error": "Invalid request data."}, status=400)
    return JsonResponse({"error": "Use POST method"}, status=405)


@csrf_exempt
def delete_admin(request, id):
    if request.method == "DELETE":
        admin = User.objects.filter(id=id, role="admin").first()
        if not admin:
            return JsonResponse({"error": "Admin not found."}, status=404)
        admin.delete()
        return JsonResponse({"message": "Admin deleted successfully."})
    return JsonResponse({"error": "Use DELETE method"}, status=405)

@csrf_exempt
def login(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            email = (data.get("email") or "").strip().lower()
            password = data.get("password")
            role = data.get("role")

            if not email or not password:
                return JsonResponse({"error": "Email and Password required"}, status=400)

            user = User.objects.filter(email__iexact=email).first()
            if not user:
                return JsonResponse({"error": "Email not found"}, status=404)

            if role and user.role != role:
                return JsonResponse({"error": "Invalid role selected"}, status=400)

            if check_password(password, user.password):
                return JsonResponse({
                    "message": "Login successful ✅",
                    "username": user.username,
                    "email": user.email,
                    "role": user.role,
                    "user_id": user.id,
                    "token": signing.dumps(
                        {"user_id": user.id, "role": user.role},
                        salt="gem-api-auth",
                        compress=True,
                    ),
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

    # These are the exact motherboard options offered by the Desktop
    # configurator. Keep slot counts deterministic even when punctuation in
    # the saved option (PCI16*2, PCI X 16-1, M.2 -1, etc.) varies.
    known_slot_profiles = {
        "b650": {"pcie_x1": 0, "pcie_x4": 2, "pcie_x16": 2, "m2_ssd": 0, "m2_wifi": 0},
        "a520": {"pcie_x1": 0, "pcie_x4": 1, "pcie_x16": 1, "m2_ssd": 0, "m2_wifi": 0},
        "h810": {"pcie_x1": 1, "pcie_x4": 0, "pcie_x16": 1, "m2_ssd": 1, "m2_wifi": 0},
        "h610": {"pcie_x1": 0, "pcie_x4": 1, "pcie_x16": 1, "m2_ssd": 1, "m2_wifi": 0},
        "q670": {"pcie_x1": 0, "pcie_x4": 2, "pcie_x16": 1, "m2_ssd": 2, "m2_wifi": 0},
    }
    for chipset, profile in known_slot_profiles.items():
        if re.search(rf"\b{chipset}\b", t):
            features.update(profile)
            features["tpm"] = 1
            break

    return features

@csrf_exempt
@require_http_methods(["POST"])
def generate_certificates(request, bid_id):
    if not fitz:
        return JsonResponse({"error": "PyMuPDF is not installed."}, status=500)
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
        "manufacturer_auth":    (2, 4),
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

    STATIC_DOCUMENTS = {
        "experience_certificate": "experience_certificate.pdf",
        "past_performance": "past_performance.pdf",
        "oem_annual_turnover": "oem_annual_turnover.pdf",
    }
    DYNAMIC_STANDALONE_DOCUMENTS = {"atc_acceptance_letter"}

    APPROVED_DOWNLOADS = {
        "approved_atc_documents",
        "approved_price_paper",
        "approved_all_documents",
    }
    if (
        not doc_type
        or doc_type not in CERT_PAGE_RANGES
        and doc_type not in STATIC_DOCUMENTS
        and doc_type not in DYNAMIC_STANDALONE_DOCUMENTS
        and doc_type not in APPROVED_DOWNLOADS
    ):
        return JsonResponse({"error": f"Invalid doc_type: '{doc_type}'"}, status=400)

    if doc_type in APPROVED_DOWNLOADS and bid.review_status != "approved":
        return JsonResponse({"error": "Only approved bids can be downloaded"}, status=403)

    if doc_type == "atc_acceptance_letter":
        source_path = os.path.join(
            settings.MEDIA_ROOT,
            "templates",
            "static_documents",
            "atc_acceptance_letter.pdf",
        )
        if not os.path.exists(source_path):
            return JsonResponse({"error": "ATC Acceptance Letter template not found"}, status=404)

        document = fitz.open(source_path)
        page = document[0]
        dynamic_rect = fitz.Rect(65, 96, 535, 235)
        page.add_redact_annot(dynamic_rect, fill=(1, 1, 1))
        page.apply_redactions()

        bid_date = str(bid.date or "")
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", bid_date):
            year, month, day = bid_date.split("-")
            bid_date = f"{day}-{month}-{year}"

        recipient_lines = [
            "To,",
            str(bid.dept_name or "").strip(),
            str(bid.organization or "").strip(),
        ]
        address = str(bid.address or "").strip()
        if address:
            recipient_lines.extend(
                line.strip() for line in re.split(r"[\r\n]+", address) if line.strip()
            )
        recipient_lines.extend([
            "",
            f"Bid No:- {str(bid.bid_no or '').strip()}",
            f"Dated:- {bid_date}",
        ])
        page.insert_textbox(
            fitz.Rect(72, 102, 525, 235),
            "\n".join(recipient_lines),
            fontsize=10.5,
            fontname="hebo",
            lineheight=1.28,
            align=0,
        )

        output_dir = os.path.join(settings.MEDIA_ROOT, "generated")
        os.makedirs(output_dir, exist_ok=True)
        output_filename = f"bid_{bid_id}_atc_acceptance_letter.pdf"
        document.save(os.path.join(output_dir, output_filename))
        document.close()
        return JsonResponse({
            "success": True,
            "pdf_url": request.build_absolute_uri(f"/media/generated/{output_filename}"),
        })

    if doc_type == "approved_price_paper":
        try:
            final_price = float(str(bid.total_price or "").replace(",", "").strip())
        except (TypeError, ValueError):
            final_price = 0
        if final_price <= 0:
            return JsonResponse(
                {"error": "A valid final approved price is required."},
                status=400,
            )

        price_doc = fitz.open()
        page = price_doc.new_page(width=595, height=842)
        template_path = os.path.join(settings.MEDIA_ROOT, "templates", "documents.pdf")
        signature_image = None
        if os.path.exists(template_path):
            template_doc = fitz.open(template_path)
            source_page = template_doc[5] if len(template_doc) > 5 else template_doc[0]
            header = source_page.get_pixmap(
                matrix=fitz.Matrix(2, 2),
                clip=fitz.Rect(0, 0, source_page.rect.width, 112),
                alpha=False,
            ).tobytes("png")
            page.insert_image(fitz.Rect(18, 12, 577, 112), stream=header, keep_proportion=False)
            signature_images = source_page.get_images(full=True)
            if len(signature_images) > 1:
                signature_image = template_doc.extract_image(signature_images[1][0]).get("image")
            template_doc.close()

        page.insert_textbox(
            fitz.Rect(45, 135, 550, 165),
            "APPROVED DETAILS FOR BIDDING",
            fontsize=14,
            fontname="hebo",
            align=1,
        )
        x_positions = [48, 390, 547]
        y, row_height = 190, 28
        for column, heading in enumerate(("APPROVED BID DETAIL", "VALUE")):
            rect = fitz.Rect(x_positions[column], y, x_positions[column + 1], y + row_height)
            page.draw_rect(rect, color=(0.3, 0.3, 0.3), fill=(0.9, 0.93, 0.96), width=0.7)
            page.insert_textbox(rect + (4, 6, -4, -3), heading, fontsize=9, fontname="hebo", align=column)
        y += row_height
        for label, value in (
            ("Bid No.", str(bid.bid_no or "")),
            ("Model No.", str(bid.model_number or "")),
            ("Final Price", f"Rs. {final_price:,.2f}"),
        ):
            for column, text in enumerate((label, value)):
                rect = fitz.Rect(x_positions[column], y, x_positions[column + 1], y + row_height)
                page.draw_rect(rect, color=(0.55, 0.55, 0.55), width=0.5)
                page.insert_textbox(
                    rect + (4, 7, -4, -3),
                    text,
                    fontsize=9.5,
                    fontname="hebo" if column == 0 else "helv",
                    align=2 if column else 0,
                )
            y += row_height

        sign_x, sign_y = 72, 430
        page.draw_line(
            fitz.Point(sign_x, sign_y - 12),
            fitz.Point(345, sign_y - 12),
            color=(0.75, 0.79, 0.84),
            width=0.8,
        )
        page.insert_textbox(
            fitz.Rect(sign_x, sign_y, 550, sign_y + 28),
            "Auth. Signatory\nFor Laps N Tabs Technology Pvt. Ltd.",
            fontsize=9,
            fontname="hebo",
            lineheight=1.15,
        )
        if signature_image:
            page.insert_image(
                fitz.Rect(sign_x, sign_y + 30, sign_x + 145, sign_y + 70),
                stream=signature_image,
                keep_proportion=False,
            )
        page.insert_textbox(
            fitz.Rect(sign_x, sign_y + 74, 550, sign_y + 132),
            "Name:- Devank Rastogi\nDesignation:- Director\n"
            "Email:- lapsntabs123@gmail.com\nContact No.:- 9918200166",
            fontsize=9,
            fontname="hebo",
            lineheight=1.15,
        )
        output_dir = os.path.join(settings.MEDIA_ROOT, "generated")
        os.makedirs(output_dir, exist_ok=True)
        output_filename = f"bid_{bid_id}_price_approved.pdf"
        price_doc.save(os.path.join(output_dir, output_filename))
        price_doc.close()
        return JsonResponse({
            "success": True,
            "pdf_url": request.build_absolute_uri(f"/media/generated/{output_filename}"),
        })

    if doc_type == "approved_all_documents":
        non_atc_documents = [
            ("manufacturer_auth", "MAF CERTIFICATE"),
            ("experience_certificate", "EXPERIENCE CERTIFICATE"),
            ("past_performance", "PAST PERFORMANCE"),
            ("oem_annual_turnover", "OEM ANNUAL TURNOVER"),
            ("make_in_india", "MAKE IN INDIA"),
            ("atc_acceptance_letter", "ATC ACCEPTANCE LETTER"),
        ]
        atc_labels = {
            "warranty": "WARRANTY",
            "bidder_financial": "BIDDER FINANCIAL UNDERSTANDINGS",
            "non_obsolete": "NON OBSOLETE",
            "data_sheet": "DATA SHEET",
            "non_malicious": "NON MALICIOUS CODE",
            "non_return_hdd": "NON RETURN OF HARD DISK",
            "technical_compliance": "TECHNICAL COMPLIANCE",
            "non_blacklisting": "NON BLACKLISTING",
            "service_support": "SERVICE SUPPORT CONSIGNEE LOCATION",
            "ipv6": "IPV6",
            "preloaded_os": "PRELOADED OPERATING SYSTEM",
        }
        selected_atc_ids = list(dict.fromkeys(
            child_id for child_id in (bid.selected_general_docs or [])
            if child_id in atc_labels
        ))
        grouped_documents = [
            ("NON-ATC DOCUMENTS", non_atc_documents),
            ("ATC DOCUMENTS", [(child_id, atc_labels[child_id]) for child_id in selected_atc_ids]),
        ]

        output_dir = os.path.join(settings.MEDIA_ROOT, "generated")
        os.makedirs(output_dir, exist_ok=True)
        factory = RequestFactory()
        generated_groups = []
        for section, documents in grouped_documents:
            generated_docs = []
            for child_id, label in documents:
                child_request = factory.post(
                    f"/api/desktop-bids/{bid_id}/generate-docs/",
                    data=json.dumps({"doc_type": child_id}),
                    content_type="application/json",
                    HTTP_HOST=request.get_host(),
                )
                child_response = generate_certificates(child_request, bid_id)
                if child_response.status_code != 200:
                    return child_response
                child_path = os.path.join(output_dir, f"bid_{bid_id}_{child_id}.pdf")
                if os.path.exists(child_path):
                    generated_docs.append((label, fitz.open(child_path)))
            if generated_docs:
                generated_groups.append((section, generated_docs))

        if not generated_groups:
            return JsonResponse({"error": "No approved documents available"}, status=400)

        index_groups, page_number = [], 1
        for section, generated_docs in generated_groups:
            rows = []
            for label, child_doc in generated_docs:
                start = page_number
                end = start + len(child_doc) - 1
                rows.append((label, start, end))
                page_number = end + 1
            index_groups.append((section, rows))

        bundle = fitz.open()
        index_page = bundle.new_page(width=595, height=842)
        index_page.insert_textbox(
            fitz.Rect(45, 60, 550, 100),
            "Index of all approved documents",
            fontsize=17,
            fontname="hebo",
            align=1,
        )
        index_page.insert_text((48, 127), f"Bid Number: {bid.bid_no}", fontsize=12, fontname="hebo")
        columns, y, row_height = [48, 92, 380, 462, 547], 152, 32

        headings = ("S.NO.", "DOCUMENTS", "PAGE FROM", "PAGE TO")
        for column, heading in enumerate(headings):
            rect = fitz.Rect(columns[column], y, columns[column + 1], y + row_height)
            index_page.draw_rect(rect, color=(0.45, 0.45, 0.45), fill=(0.92, 0.94, 0.96), width=0.6)
            index_page.insert_textbox(rect + (4, 9, -4, -3), heading, fontsize=9.2, fontname="hebo", align=1 if column != 1 else 0)
        y += row_height

        serial_number = 1
        for section, rows in index_groups:
            section_rect = fitz.Rect(columns[0], y, columns[-1], y + row_height)
            index_page.draw_rect(section_rect, color=(0.35, 0.35, 0.35), fill=(0.85, 0.88, 0.92), width=0.7)
            index_page.insert_textbox(section_rect + (5, 9, -5, -3), section, fontsize=9.5, fontname="hebo", align=0)
            y += row_height
            for label, start, end in rows:
                values = (str(serial_number), label, str(start), str(end))
                for column, value in enumerate(values):
                    rect = fitz.Rect(columns[column], y, columns[column + 1], y + row_height)
                    index_page.draw_rect(rect, color=(0.55, 0.55, 0.55), width=0.5)
                    index_page.insert_textbox(rect + (4, 9, -4, -3), value, fontsize=9.2, fontname="hebo", align=1 if column != 1 else 0)
                serial_number += 1
                y += row_height

        for _, generated_docs in generated_groups:
            for _, child_doc in generated_docs:
                bundle.insert_pdf(child_doc)
                child_doc.close()
        for page_index in range(1, len(bundle)):
            page = bundle[page_index]
            for block in page.get_text("dict").get("blocks", []):
                if block.get("type") != 0:
                    continue
                for line in block.get("lines", []):
                    text = " ".join(span.get("text", "") for span in line.get("spans", [])).strip()
                    if line["bbox"][1] > page.rect.height - 60 and re.fullmatch(r"(?:Page\s*)?\d+", text, re.IGNORECASE):
                        rect = fitz.Rect(line["bbox"])
                        page.add_redact_annot(rect + (-3, -2, 3, 2), fill=(1, 1, 1))
            page.apply_redactions()
            page.insert_textbox(
                fitz.Rect(page.rect.width - 60, page.rect.height - 28, page.rect.width - 18, page.rect.height - 8),
                str(page_index),
                fontsize=9,
                fontname="hebo",
                align=2,
            )

        output_filename = f"bid_{bid_id}_all_approved_documents.pdf"
        bundle.save(os.path.join(output_dir, output_filename))
        bundle.close()
        return JsonResponse({
            "success": True,
            "pdf_url": request.build_absolute_uri(f"/media/generated/{output_filename}"),
        })

    if doc_type == "approved_atc_documents":
        separate_ids = {
            "manufacturer_auth",
            "experience_certificate",
            "past_performance",
            "oem_annual_turnover",
            "make_in_india",
        }
        labels = {
            "warranty": "WARRANTY",
            "bidder_financial": "BIDDER FINANCIAL UNDERSTANDINGS",
            "non_obsolete": "NON OBSOLETE",
            "data_sheet": "DATA SHEET",
            "non_malicious": "NON MALICIOUS CODE",
            "non_return_hdd": "NON RETURN OF HARD DISK",
            "technical_compliance": "TECHNICAL COMPLIANCE",
            "non_blacklisting": "NON BLACKLISTING",
            "service_support": "SERVICE SUPPORT CONSIGNEE LOCATION",
            "ipv6": "IPV6",
            "preloaded_os": "PRELOADED OPERATING SYSTEM",
        }
        selected_ids = list(dict.fromkeys(
            doc_id for doc_id in (bid.selected_general_docs or [])
            if doc_id in labels and doc_id not in separate_ids
        ))
        if not selected_ids:
            return JsonResponse({"error": "No ATC-related documents selected"}, status=400)

        output_dir = os.path.join(settings.MEDIA_ROOT, "generated")
        os.makedirs(output_dir, exist_ok=True)
        factory = RequestFactory()
        generated_docs = []
        for child_id in selected_ids:
            child_request = factory.post(
                f"/api/desktop-bids/{bid_id}/generate-docs/",
                data=json.dumps({"doc_type": child_id}),
                content_type="application/json",
                HTTP_HOST=request.get_host(),
            )
            child_response = generate_certificates(child_request, bid_id)
            if child_response.status_code != 200:
                return child_response
            child_path = os.path.join(output_dir, f"bid_{bid_id}_{child_id}.pdf")
            if os.path.exists(child_path):
                generated_docs.append((labels[child_id], fitz.open(child_path)))

        page_ranges, page_number = [], 1
        for label, child_doc in generated_docs:
            start = page_number
            end = start + len(child_doc) - 1
            page_ranges.append((label, start, end))
            page_number = end + 1

        bundle = fitz.open()
        index_page = bundle.new_page(width=595, height=842)
        index_page.insert_textbox(
            fitz.Rect(45, 60, 550, 100),
            "Index of documents file with ATC",
            fontsize=17,
            fontname="hebo",
            align=1,
        )
        index_page.insert_text((48, 127), f"Bid Number: {bid.bid_no}", fontsize=12, fontname="hebo")
        columns, y, row_height = [48, 92, 380, 462, 547], 152, 32
        for row_index, values in enumerate(
            [("S.NO.", "DOCUMENTS", "PAGE FROM", "PAGE TO")]
            + [(str(i), label, str(start), str(end)) for i, (label, start, end) in enumerate(page_ranges, 1)]
        ):
            for column, value in enumerate(values):
                rect = fitz.Rect(columns[column], y, columns[column + 1], y + row_height)
                index_page.draw_rect(
                    rect,
                    color=(0.45, 0.45, 0.45),
                    fill=(0.92, 0.94, 0.96) if row_index == 0 else None,
                    width=0.6,
                )
                index_page.insert_textbox(
                    rect + (4, 9, -4, -3),
                    value,
                    fontsize=9.2,
                    fontname="hebo",
                    align=1 if column != 1 else 0,
                )
            y += row_height

        for _, child_doc in generated_docs:
            bundle.insert_pdf(child_doc)
            child_doc.close()
        for page_index in range(1, len(bundle)):
            page = bundle[page_index]
            for block in page.get_text("dict").get("blocks", []):
                if block.get("type") != 0:
                    continue
                for line in block.get("lines", []):
                    text = " ".join(span.get("text", "") for span in line.get("spans", [])).strip()
                    if line["bbox"][1] > page.rect.height - 60 and re.fullmatch(r"(?:Page\s*)?\d+", text, re.IGNORECASE):
                        rect = fitz.Rect(line["bbox"])
                        page.add_redact_annot(rect + (-3, -2, 3, 2), fill=(1, 1, 1))
            page.apply_redactions()
            page.insert_textbox(fitz.Rect(page.rect.width - 60, page.rect.height - 28, page.rect.width - 18, page.rect.height - 8), str(page_index), fontsize=9, fontname="hebo", align=2)

        output_filename = f"bid_{bid_id}_approved_atc_documents.pdf"
        bundle.save(os.path.join(output_dir, output_filename))
        bundle.close()
        return JsonResponse({
            "success": True,
            "pdf_url": request.build_absolute_uri(f"/media/generated/{output_filename}"),
        })

    if doc_type in STATIC_DOCUMENTS:
        source_path = os.path.join(
            settings.MEDIA_ROOT,
            "templates",
            "static_documents",
            STATIC_DOCUMENTS[doc_type],
        )
        if not os.path.exists(source_path):
            return JsonResponse({"error": "Static document template not found"}, status=404)

        output_dir = os.path.join(settings.MEDIA_ROOT, "generated")
        os.makedirs(output_dir, exist_ok=True)
        output_filename = f"bid_{bid_id}_{doc_type}.pdf"
        output_path = os.path.join(output_dir, output_filename)
        shutil.copyfile(source_path, output_path)

        return JsonResponse({
            "success": True,
            "pdf_url": request.build_absolute_uri(f"/media/generated/{output_filename}"),
            "message": f"{doc_type} document copied successfully",
        }, status=200)

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
        if value not in (None, ""):
            return value
        return _catalogue_spec(*labels)

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
        # Keep the original table grid visible by redacting only inside the
        # cell instead of erasing its border lines.
        erase_area = fitz.Rect(
            area.x0 + 1.5,
            area.y0 + 1.5,
            area.x1 - 1.5,
            area.y1 - 1.5,
        )
        page.add_redact_annot(erase_area, fill=(1, 1, 1))
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
        allowed_processors_display = (
            "Intel Core i3: 12100, 14100\n"
            "Intel Core i5: 12400, 14400\n"
            "Intel Core i7: 12700, 14700\n"
            "Intel Core i9: 14900\n"
            "Intel Ultra 5: 225, 245K | Ultra 7: 265K\n"
            "AMD Ryzen 3: 4300G, 5300G\n"
            "AMD Ryzen 5: 5600G, 8500G\n"
            "AMD Ryzen 7: 5700G | Ryzen 9: 9300G\n"
            "12th Gen Composite: i5, i7 Or higher"
        )

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
        allowed_replacements = [
            (
                (183, 176, 313, 269),
                "Desktop Computer with Table Mount Monitor System with Compatible Chipset as per Processor make with Minimum 6 USB Port",
                8.0,
            ),
            ((183, 273, 313, 389), allowed_processors_display, 7.2),
            ((183, 523, 313, 596), "Windows 11 Home\nWindows 11 Professional\nDOS | Linux", 9.0),
            ((183, 598, 313, 641), "DDR4 | DDR5 Or higher", 9.0),
            ((183, 641, 313, 681), "8 | 16 | 32 | 64 GB Or higher", 9.0),
        ]
        for rect, value, fontsize in allowed_replacements:
            _replace_technical_cell(page, rect, value, fontsize=fontsize)

        for rect, value, fontsize in replacements:
            _replace_technical_cell(page, rect, value, fontsize=fontsize)

    def _fill_desktop_technical_compliance_page(page, page_index):
        specs = _form_specs()

        def _capacity(value):
            numbers = re.findall(r"\d+(?:\.\d+)?", str(value or ""))
            if not numbers:
                return "0"
            number = float(numbers[0])
            if re.search(r"TB", str(value), re.IGNORECASE):
                number *= 1024
            return str(int(number)) if number.is_integer() else str(number)

        if page_index == 0:
            base_processors = [
                "Intel Core i3 12100", "Intel Core i3 14100",
                "Intel Core i5 12400", "Intel Core i5 14400",
                "Intel Core i7 12700", "12th Gen Composite i5",
                "12th Gen Composite i7", "AMD Ryzen 3 4300G",
                "AMD Ryzen 3 5300G", "AMD Ryzen 5 5600G",
                "AMD Ryzen 7 5700G", "AMD Ryzen 5 8500G",
                "AMD Ryzen 9 9300G",
            ]
            higher_processors = [
                "Intel Core i7 13700", "Intel Core i7 13700K",
                "Intel Core i7 14700", "Intel Core i7 14700K",
                "Intel Core i9 12900", "Intel Core i9 12900K",
                "Intel Core i9 13900", "Intel Core i9 13900K",
                "Intel Core i9 14900", "Intel Core i9 14900K",
                "Intel Core Ultra 5 225", "Intel Core Ultra 5 225T",
                "Intel Core Ultra 5 235", "Intel Core Ultra 5 235T",
                "Intel Core Ultra 5 245", "Intel Core Ultra 5 245K",
                "Intel Core Ultra 5 245T", "Intel Core Ultra 7 265",
                "Intel Core Ultra 7 265K", "Intel Core Ultra 7 265T",
                "Intel Core Ultra 9 285",
            ]
            processor = specs["processor"]
            normalized_processor = re.sub(r"[^a-z0-9]", "", processor.lower())
            normalized_base = {
                re.sub(r"[^a-z0-9]", "", value.lower()) for value in base_processors
            }
            is_base_processor = normalized_processor in normalized_base

            _replace_technical_cell(
                page, (273, 269, 397, 303),
                ", ".join(base_processors) + ", NA for Higher Processor Or higher",
                fontsize=4.0,
            )
            _replace_technical_cell(
                page, (273, 307, 397, 534),
                ", ".join(higher_processors) + " Or higher",
                fontsize=6.2,
            )

            primary_storage = specs["ssd1"] or specs["hdd"]
            replacements = [
                ((400, 178, 502, 265), "Desktop Computer with Table Mount Monitor System with Compatible Chipset as per Processor make with Minimum 6 USB Port", 7.4),
                ((400, 269, 502, 303), processor if is_base_processor else "NA for Higher Processor", 7.5),
                ((400, 307, 502, 534), "NA" if is_base_processor else processor, 8.0),
                ((400, 538, 502, 559), specs["pcie_x16"] or "1", 8.0),
                ((400, 563, 502, 583), specs["tpm"] or "Discrete TPM 2.0", 7.5),
                ((400, 587, 502, 622), specs["graphics_memory"] or "0", 8.0),
                ((400, 626, 502, 648), specs["os"], 7.5),
                ((400, 652, 502, 699), specs["ram_size_gb"], 8.0),
                ((400, 703, 502, 725), _capacity(primary_storage), 8.0),
            ]
        else:
            secondary_storage = specs["ssd2"] or specs["hdd"]
            has_secondary = bool(
                secondary_storage
                and str(secondary_storage).strip().lower() not in {"none", "no", "0"}
            )
            monitor_text = str(specs["monitor"] or "")
            monitor_numbers = re.findall(r"\d+(?:\.\d+)?", monitor_text)
            monitor_inches = float(monitor_numbers[0]) if monitor_numbers else 0
            screen_range = (
                '58.1 - 63 (22.87" - 24.8")'
                if monitor_inches >= 22.87
                else '53.1 - 58 (20.91" - 22.83")'
            )
            warranty_numbers = re.findall(r"\d+(?:\.\d+)?", str(specs["warranty"] or ""))
            warranty_years = warranty_numbers[0] if warranty_numbers else specs["warranty"]

            replacements = [
                ((400, 83, 502, 118), specs["storage_type"] if has_secondary else "No Secondary Storage", 7.2),
                ((400, 122, 502, 147), _capacity(secondary_storage) if has_secondary else "0", 8.0),
                ((400, 151, 502, 174), specs["monitor_available"] or "Yes as per IS 13252 (Part 1)", 7.0),
                ((400, 178, 502, 200), specs["panel_type"] or "Vertical Alignment (VA)", 7.0),
                ((400, 204, 502, 227), screen_range, 7.0),
                ((400, 231, 502, 253), specs["max_resolution"] or "1920 x 1080 (Full HD)", 7.0),
                ((400, 257, 502, 279), warranty_years, 8.0),
            ]

        for rect, value, fontsize in replacements:
            _replace_technical_cell(page, rect, value, fontsize=fontsize)

        if page_index == 0 and bid_no:
            tender_areas = page.search_for("GEM/2026/B/7577756")
            for area in tender_areas:
                replace_area = fitz.Rect(area.x0 - 2, area.y0 - 2, area.x1 + 4, area.y1 + 3)
                page.add_redact_annot(replace_area, fill=(1, 1, 1))
            if tender_areas:
                page.apply_redactions()
                page.insert_text(
                    (tender_areas[0].x0, tender_areas[0].y1 - 2),
                    bid_no,
                    fontsize=11,
                    fontname="hebo",
                    color=(0, 0, 0),
                )

    def _fill_storage_warranty_compliance_page(page):
        specs = _form_specs()
        heading = "Technical Compliance Certificate"
        heading_width = fitz.get_text_length(heading, fontname="hebo", fontsize=14)
        page.insert_text(
            ((page.rect.width - heading_width) / 2, 150),
            heading,
            fontsize=14,
            fontname="hebo",
            color=(0, 0, 0),
        )

        columns = [52, 115, 220, 395, 543]
        header_top, header_bottom = 178, 208
        headers = ["Specification", "Title", "Allowed Values", "Offered"]
        for index, header in enumerate(headers):
            rect = fitz.Rect(columns[index], header_top, columns[index + 1], header_bottom)
            page.draw_rect(rect, color=(0.35, 0.35, 0.35), fill=(0.92, 0.94, 0.97), width=0.7)
            page.insert_textbox(
                rect + (5, 8, -4, -3),
                header,
                fontsize=8.5,
                fontname="hebo",
                color=(0, 0, 0),
            )

        storage_offered = ", ".join(
            value for value in [specs["hdd"], specs["ssd1"], specs["ssd2"]] if value
        ) or "None"
        rows = [
            (
                208, 302,
                "STORAGE",
                "Storage Configuration",
                "HDD: 1 TB, 2 TB\nSSD SATA/NVMe: 128 GB, 256 GB, 512 GB, 1 TB",
                storage_offered,
            ),
            (
                302, 362,
                "WARRANTY",
                "On Site OEM Warranty\n(In year)",
                "1, 2, 3, 4, 5, 6, 7 Years Or higher",
                specs["warranty"],
            ),
        ]
        for top, bottom, specification, title, allowed, offered in rows:
            values = [specification, title, allowed, offered]
            for index, value in enumerate(values):
                rect = fitz.Rect(columns[index], top, columns[index + 1], bottom)
                page.draw_rect(rect, color=(0.45, 0.45, 0.45), width=0.65)
                page.insert_textbox(
                    rect + (5, 8, -5, -5),
                    str(value or ""),
                    fontsize=8.5 if index != 2 else 8.2,
                    fontname="hebo" if index == 0 else "helv",
                    color=(0, 0, 0),
                    align=0,
                )

    def _fill_main_technical_compliance_page(page):
        specs = _form_specs()
        heading = "Technical Compliance Certificate"
        heading_width = fitz.get_text_length(heading, fontname="hebo", fontsize=14)
        page.insert_text(
            ((page.rect.width - heading_width) / 2, 122),
            heading,
            fontsize=14,
            fontname="hebo",
            color=(0, 0, 0),
        )
        if bid_no:
            bid_text = f"Bid No: {bid_no}"
            bid_width = fitz.get_text_length(bid_text, fontname="hebo", fontsize=9)
            page.insert_text(
                ((page.rect.width - bid_width) / 2, 143),
                bid_text,
                fontsize=9,
                fontname="hebo",
                color=(0.2, 0.2, 0.2),
            )

        columns = [52, 115, 220, 395, 543]
        header_top, header_bottom = 160, 190
        headers = ["Specification", "Title", "Allowed Values", "Offered"]
        for index, header in enumerate(headers):
            rect = fitz.Rect(columns[index], header_top, columns[index + 1], header_bottom)
            page.draw_rect(rect, color=(0.35, 0.35, 0.35), fill=(0.92, 0.94, 0.97), width=0.7)
            page.insert_textbox(
                rect + (5, 8, -4, -3),
                header,
                fontsize=8.5,
                fontname="hebo",
                color=(0, 0, 0),
            )

        processor_allowed = (
            "Intel Core i3: 12100, 14100\n"
            "Intel Core i5: 12400, 14400\n"
            "Intel Core i7: 12700, 14700\n"
            "Intel Core i9: 14900\n"
            "Intel Ultra 5: 225, 245K | Ultra 7: 265K\n"
            "AMD Ryzen 3: 4300G, 5300G\n"
            "AMD Ryzen 5: 5600G, 8500G\n"
            "AMD Ryzen 7: 5700G | Ryzen 9: 9300G\n"
            "12th Gen Composite: i5, i7 Or higher"
        )
        description_allowed = (
            "Desktop Computer with Table Mount Monitor System with Compatible "
            "Chipset as per Processor make with Minimum 6 USB Port"
        )
        rows = [
            (190, 280, "Description of Store", description_allowed, specs["description"], 8.0),
            (280, 420, "Processor Number", processor_allowed, specs["processor"], 7.2),
            (420, 468, "Mouse Connectivity", "Wired | Wireless Or higher", specs["mouse_connectivity"], 8.5),
            (468, 516, "Keyboard Connectivity", "Wired | Wireless Or higher", specs["keyboard_connectivity"], 8.5),
            (516, 560, "Graphics Type", "Integrated", specs["graphics_type"], 8.5),
            (
                560, 628,
                "Operating System\n(Factory Preloaded with Certification)",
                "Windows 11 Home\nWindows 11 Professional\nDOS | Linux",
                specs["os"],
                8.5,
            ),
            (628, 674, "Type of RAM", "DDR4 | DDR5 Or higher", specs["ram_type"], 8.5),
            (674, 720, "RAM Size (GB)", "8 | 16 | 32 | 64 GB Or higher", specs["ram_size_gb"], 8.5),
        ]
        groups = [
            ("DESCRIPTION", 190, 420),
            ("INPUT DEVICES", 420, 516),
            ("GRAPHICS", 516, 560),
            ("OPERATING\nSYSTEM", 560, 628),
            ("MEMORY", 628, 720),
        ]

        for group, top, bottom in groups:
            rect = fitz.Rect(columns[0], top, columns[1], bottom)
            page.draw_rect(rect, color=(0.45, 0.45, 0.45), width=0.65)
            page.insert_textbox(
                rect + (5, 8, -5, -5),
                group,
                fontsize=6.8,
                fontname="hebo",
                color=(0, 0, 0),
            )

        for top, bottom, title, allowed, offered, allowed_fontsize in rows:
            values = [title, allowed, offered]
            for index, value in enumerate(values, start=1):
                rect = fitz.Rect(columns[index], top, columns[index + 1], bottom)
                page.draw_rect(rect, color=(0.45, 0.45, 0.45), width=0.65)
                page.insert_textbox(
                    rect + (5, 8, -5, -5),
                    str(value or ""),
                    fontsize=allowed_fontsize if index == 2 else 8.3,
                    fontname="helv",
                    color=(0, 0, 0),
                    align=0,
                )

    def _fill_generated_data_sheet_page(page, page_index):
        specs = _form_specs()
        heading = "Desktop Product Data Sheet"
        heading_width = fitz.get_text_length(heading, fontname="hebo", fontsize=14)
        page.insert_text(
            ((page.rect.width - heading_width) / 2, 122),
            heading,
            fontsize=14,
            fontname="hebo",
            color=(0, 0, 0),
        )
        if page_index == 0:
            sections = [
                ("PRODUCT DETAILS", [
                    ("Model Number", specs["model_number"]),
                    ("Brand", "acxxel"),
                ]),
                ("PROCESSOR", [
                    ("Processor Number", specs["processor"]),
                ]),
                ("MOTHERBOARD", [
                    ("Chipset / Motherboard", specs["motherboard"]),
                    ("Expansion Slots (PCIe x 1)", specs["pcie_x1"]),
                    ("Expansion Slots (PCIe x 4)", specs["pcie_x4"]),
                    ("Expansion Slots (PCIe x 16)", specs["pcie_x16"]),
                    ("M.2 Slot for SSD", specs["m2_ssd"]),
                    ("M.2 Slot for WiFi", specs["m2_wifi"]),
                ]),
                ("OPERATING SYSTEM & MEMORY", [
                    ("Factory Pre-loaded Operating System", specs["os"]),
                    ("Type of RAM", specs["ram_type"]),
                    ("RAM Size", specs["ram_size"]),
                ]),
                ("CONNECTIVITY & PORTS", [
                    ("WiFi / Bluetooth", specs["wifi"]),
                    ("USB 2.0 Ports", specs["usb2"]),
                    ("USB 3.0 Ports", specs["usb3"]),
                    ("VGA Ports", specs["vga"]),
                    ("HDMI Ports", specs["hdmi"]),
                ]),
            ]
        else:
            sections = [
                ("STORAGE", [
                    ("Hard Disk Drive", specs["hdd"]),
                    ("Solid State Drive 1", specs["ssd1"]),
                    ("Solid State Drive 2", specs["ssd2"]),
                ]),
                ("CABINET", [
                    ("Cabinet Form Factor", specs["cabinet"]),
                ]),
                ("MONITOR", [
                    ("Availability of Monitor", specs["monitor_available"]),
                    ("Monitor", specs["monitor"]),
                    ("Speaker", specs["speaker"]),
                ]),
                ("INPUT DEVICES", [
                    ("Keyboard & Mouse", specs["keyboard"]),
                ]),
                ("ADDITIONAL DETAILS", [
                    ("Optional Ports", specs["optional_ports"]),
                    ("On Site OEM Warranty", specs["warranty"]),
                ]),
            ]

        left, split, right = 52, 255, 543
        y = 160
        section_height = 24
        row_height = 22
        for section_title, rows in sections:
            section_rect = fitz.Rect(left, y, right, y + section_height)
            page.draw_rect(
                section_rect,
                color=(0.35, 0.35, 0.35),
                fill=(0.9, 0.9, 0.9),
                width=0.7,
            )
            page.insert_textbox(
                section_rect + (7, 6, -5, -3),
                section_title,
                fontsize=8.5,
                fontname="hebo",
                color=(0, 0, 0),
            )
            y += section_height

            for label, value in rows:
                label_rect = fitz.Rect(left, y, split, y + row_height)
                value_rect = fitz.Rect(split, y, right, y + row_height)
                page.draw_rect(label_rect, color=(0.55, 0.55, 0.55), fill=(0.97, 0.97, 0.97), width=0.55)
                page.draw_rect(value_rect, color=(0.55, 0.55, 0.55), width=0.55)
                page.insert_textbox(
                    label_rect + (7, 5, -5, -1),
                    label,
                    fontsize=7.6,
                    fontname="hebo",
                    color=(0.15, 0.15, 0.15),
                )
                page.insert_textbox(
                    value_rect + (7, 5, -5, -1),
                    str(value).strip() if value not in (None, "") else "Not Specified",
                    fontsize=7.8,
                    fontname="helv",
                    color=(0, 0, 0),
                )
                y += row_height
            y += 3
        return y

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
            "This is to certify that Laps N Tabs Technology Pvt. Ltd. is the OEM of acxxel "
            f"Desktop Brand and will provide comprehensive warranty during entire standard "
            f"warranty period i.e. {normalized_warranty} for quoted acxxel Desktop "
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

    def _replace_service_support_heading(page):
        old_text = "ACXXEL SERVICE PARTNERS"
        new_text = "List Of acxxel Service Center In Major City"
        areas = page.search_for(old_text)
        if not areas:
            return

        for area in areas:
            page.add_redact_annot(
                fitz.Rect(area.x0 - 2, area.y0 - 1, area.x1 + 2, area.y1 - 0.8),
                fill=(1, 1, 0),
            )
        page.apply_redactions()

        for area in areas:
            page.insert_textbox(
                fitz.Rect(92, area.y0 - 1, page.rect.width - 92, area.y1 + 6),
                new_text,
                fontsize=11,
                fontname="hebo",
                color=(0, 0, 0),
                align=1,
            )

    def _remove_commas_from_service_contact_numbers(page):
        page_text = page.get_text("text")
        formatted_numbers = set(re.findall(r"\b\d{1,2}(?:,\d{3}){3}\b", page_text))

        for formatted_number in formatted_numbers:
            clean_number = formatted_number.replace(",", "")
            areas = page.search_for(formatted_number)
            for area in areas:
                page.add_redact_annot(
                    fitz.Rect(area.x0 - 1, area.y0 - 1, area.x1 + 1, area.y1 + 1),
                    fill=(1, 1, 1),
                )
            if areas:
                page.apply_redactions()
            for area in areas:
                page.insert_text(
                    (area.x0, area.y1 - 2),
                    clean_number,
                    fontsize=10,
                    fontname="hebo",
                    color=(0, 0, 0),
                )

    def _add_service_support_table_note(page):
        prefix = "Note: For other locations, please email us at "
        email_text = "support@acxxel.com"
        middle = " or visit our website "
        website_text = "acxxel.com"
        suffix = "."
        note = f"{prefix}{email_text}{middle}{website_text}{suffix}"
        if note in page.get_text("text").replace("\n", " "):
            return
        font_name, font_size = "hebo", 11
        note_x, note_y = 42, 520
        prefix_width = fitz.get_text_length(prefix, fontname=font_name, fontsize=font_size)
        email_width = fitz.get_text_length(email_text, fontname=font_name, fontsize=font_size)
        middle_width = fitz.get_text_length(middle, fontname=font_name, fontsize=font_size)
        website_width = fitz.get_text_length(website_text, fontname=font_name, fontsize=font_size)

        email_x = note_x + prefix_width
        middle_x = email_x + email_width
        website_x = middle_x + middle_width

        page.insert_text((note_x, note_y), prefix, fontsize=font_size, fontname=font_name, color=(0, 0, 0))
        page.insert_text((email_x, note_y), email_text, fontsize=font_size, fontname=font_name, color=(0, 0, 1))
        page.insert_text((middle_x, note_y), middle, fontsize=font_size, fontname=font_name, color=(0, 0, 0))
        page.insert_text((website_x, note_y), f"{website_text}{suffix}", fontsize=font_size, fontname=font_name, color=(0, 0, 1))

        page.insert_link({
            "kind": fitz.LINK_URI,
            "from": fitz.Rect(email_x, note_y - 12, email_x + email_width, note_y + 3),
            "uri": "mailto:support@acxxel.com",
        })
        page.insert_link({
            "kind": fitz.LINK_URI,
            "from": fitz.Rect(website_x, note_y - 12, website_x + website_width, note_y + 3),
            "uri": "https://acxxel.com",
        })

    def _replace_service_support_clause_heading(page):
        old_text = "Service & Support"
        new_text = (
            "As per the Buyer ATC 'Service and Support' clause in the availability guidance, "
            "the authorized service center is as follows"
        )
        areas = page.search_for(old_text)
        if not areas:
            return

        for area in areas:
            page.add_redact_annot(
                fitz.Rect(area.x0 - 2, area.y0 - 2, page.rect.width - 45, area.y1 + 3),
                fill=(1, 1, 1),
            )
        page.apply_redactions()

        first_area = areas[0]
        clause_areas = page.search_for("Availability of Service Centres")
        text_x = clause_areas[0].x0 if clause_areas else 72
        text_right = page.rect.width - text_x
        page.insert_textbox(
            fitz.Rect(text_x, first_area.y0 - 2, text_right, first_area.y1 + 38),
            new_text,
            fontsize=11,
            fontname="hebo",
            color=(0, 0, 0),
            align=0,
            lineheight=1.1,
        )

    def _replace_presented_with_represented(page):
        areas = page.search_for("presented")
        for area in areas:
            page.add_redact_annot(
                fitz.Rect(area.x0 - 1, area.y0 - 1, area.x1 + 1, area.y1 + 1),
                fill=(1, 1, 1),
            )
        if areas:
            page.apply_redactions()
        for area in areas:
            page.insert_text(
                (area.x0, area.y1 - 2),
                "represented",
                fontsize=11,
                fontname="hebo",
                color=(0, 0, 0),
            )

    def _replace_service_support_confirmation(page):
        # Keep the original template intact and replace only the undertaking
        # paragraph in its existing location.
        page.add_redact_annot(
            fitz.Rect(68, 404, page.rect.width - 42, 526),
            fill=(1, 1, 1),
        )
        page.apply_redactions()
        page.insert_textbox(
            fitz.Rect(72, 407, page.rect.width - 52, 522),
            "The product offered in the bid will be serviced on-site at the location of the buyer. "
            "The above clause is not applicable to this bid. We also undertake that once the order "
            "is released, we shall appoint a service center within the prescribed time, in case the "
            "location of the buyer is not already covered by an existing service center.",
            fontsize=12,
            fontname="hebo",
            color=(0, 0, 0),
            align=0,
            lineheight=1.2,
        )

    def _render_service_support_clause_page(page):
        page.add_redact_annot(
            fitz.Rect(38, 112, page.rect.width - 38, page.rect.height - 24),
            fill=(1, 1, 1),
        )
        page.apply_redactions()

        recipient_lines = ["To,"]
        if dept_name:
            recipient_lines.append(dept_name)
        if organization:
            recipient_lines.append(organization)
        if full_address:
            recipient_lines.append(full_address)
        if bid_no:
            recipient_lines.append(f"Bid No: {bid_no}")
        page.insert_textbox(
            fitz.Rect(62, 138, page.rect.width - 62, 215),
            "\n".join(recipient_lines),
            fontsize=10,
            fontname="hebo",
            color=(0.1, 0.1, 0.1),
            lineheight=1.15,
        )

        reference_rect = fitz.Rect(62, 224, page.rect.width - 62, 292)
        page.draw_rect(
            reference_rect,
            color=(0.45, 0.52, 0.62),
            fill=(0.94, 0.96, 0.98),
            width=0.8,
        )
        page.insert_text(
            (74, 244),
            "SERVICE CENTRE AVAILABILITY",
            fontsize=9.5,
            fontname="hebo",
            color=(0.12, 0.2, 0.32),
        )
        page.insert_textbox(
            fitz.Rect(74, 252, page.rect.width - 74, 285),
            "As per the Buyer ATC 'Service and Support' clause in the availability guidance, "
            "the authorized service center is as follows.",
            fontsize=8.8,
            fontname="helv",
            color=(0.12, 0.12, 0.12),
            lineheight=1.2,
        )

        clause = (
            "Availability of Service Centres: Bidder/OEM must have a Functional Service Centre "
            "in the State of each Consignee's Location in case of carry-in warranty. "
            "(Not applicable in case of goods having on-site warranty.) If service center is not "
            "already there at the time of bidding, successful bidder/OEM shall establish one "
            "within 30 days of award of contract. Payment shall be released only after submission "
            "of documentary evidence of having Functional Service Centre."
        )
        clause_rect = fitz.Rect(62, 308, page.rect.width - 62, 447)
        page.draw_rect(clause_rect, color=(0.65, 0.65, 0.65), width=0.7)
        page.insert_text(
            (74, 329),
            "BUYER ATC CLAUSE",
            fontsize=9.2,
            fontname="hebo",
            color=(0.18, 0.18, 0.18),
        )
        page.insert_textbox(
            fitz.Rect(74, 340, page.rect.width - 74, 438),
            clause,
            fontsize=8.7,
            fontname="helv",
            color=(0.08, 0.08, 0.08),
            lineheight=1.25,
        )

        confirmation_rect = fitz.Rect(62, 466, page.rect.width - 62, 570)
        page.draw_rect(
            confirmation_rect,
            color=(0.35, 0.55, 0.42),
            fill=(0.95, 0.98, 0.95),
            width=0.8,
        )
        page.insert_text(
            (74, 487),
            "OEM CONFIRMATION",
            fontsize=9.2,
            fontname="hebo",
            color=(0.12, 0.32, 0.18),
        )
        page.insert_textbox(
            fitz.Rect(74, 498, page.rect.width - 74, 562),
            "The product offered in the bid will be serviced on-site at the location of the buyer. "
            "The above clause is not applicable to this bid. We also undertake that once the order "
            "is released, we shall appoint a service center within the prescribed time, in case the "
            "location of the buyer is not already covered by an existing service center.",
            fontsize=12,
            fontname="hebo",
            color=(0.08, 0.08, 0.08),
            lineheight=1.2,
        )

        _add_authorized_signatory(page, y=594, compact=True)

    def _remove_to_whomsoever_line(page, include_bid_no=False):
        blocks = page.get_text("dict").get("blocks", [])

        heading_bbox = None
        next_line_bbox = None
        page_already_has_to_block = False
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
            if heading_bbox is None and re.search(
                r'TO\s+WHOM\s*S\s*O\s*E?\s*VER\s+IT\s+MAY\s+CONCERN', normalized
            ):
                heading_bbox = bbox
                if i + 1 < len(all_lines):
                    next_line_bbox = all_lines[i + 1][0]

            if line_text.strip().rstrip(", ").strip().upper() == "TO":
                page_already_has_to_block = True

        if heading_bbox is None:
            return

        erase_rect = fitz.Rect(
            heading_bbox.x0 - 4, heading_bbox.y0 - 3,
            page.rect.width - 36, heading_bbox.y1 + 3,
        )
        page.add_redact_annot(erase_rect, fill=(1, 1, 1))
        page.apply_redactions()

        if page_already_has_to_block:
            if include_bid_no and bid_no:
                address_tokens = [
                    str(value or "").strip().lower()
                    for value in [dept_name, organization, full_address]
                    if str(value or "").strip()
                ]
                address_lines = [
                    bbox
                    for bbox, line_text in all_lines
                    if any(
                        token == line_text.strip().lower()
                        or token.startswith(line_text.strip().lower())
                        or line_text.strip().lower() in token
                        for token in address_tokens
                        if line_text.strip()
                    )
                ]
                if address_lines:
                    last_line = max(address_lines, key=lambda rect: rect.y1)
                    insert_x = last_line.x0
                    insert_y = last_line.y1 + 13
                else:
                    insert_x, insert_y = 72, 226
                page.insert_text(
                    (insert_x, insert_y),
                    f"Bid No: {bid_no}",
                    fontsize=11,
                    fontname="hebo",
                    color=(0, 0, 0),
                )
            return

        if not page_already_has_to_block:

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
            if include_bid_no and bid_no:
                block_lines.append(f"Bid No: {bid_no}")

            line_height = 14
            gap_before_content = 24
            block_height = line_height * len(block_lines)

            if next_line_bbox is not None:
                block_bottom_y = next_line_bbox.y0 - gap_before_content
                insert_y = block_bottom_y - block_height + line_height
                insert_y = max(insert_y, heading_bbox.y0)
            else:
                insert_y = heading_bbox.y0
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
        signature_image = None
        if len(doc) > 5:
            signature_images = doc[5].get_images(full=True)
            if len(signature_images) > 1:
                signature_image = doc.extract_image(signature_images[1][0]).get("image")

        def _add_authorized_signatory(page, y=685, compact=False):
            x = 58
            header_height = 20 if compact else 24
            signature_top = 19 if compact else 23
            signature_bottom = 50 if compact else 62
            signature_width = 132 if compact else 145
            details_top = 51 if compact else 63
            details_bottom = 91 if compact else 112
            font_size = 7.5 if compact else 8.2
            page.insert_textbox(
                fitz.Rect(x, y, page.rect.width - 45, y + header_height),
                "Auth. Signatory\nFor Laps N Tabs Technology Pvt. Ltd.",
                fontsize=font_size,
                fontname="hebo",
                lineheight=1.05,
            )
            if signature_image:
                page.insert_image(
                    fitz.Rect(x, y + signature_top, x + signature_width, y + signature_bottom),
                    stream=signature_image,
                    keep_proportion=False,
                )
            page.insert_textbox(
                fitz.Rect(x, y + details_top, page.rect.width - 45, min(page.rect.height - 5, y + details_bottom)),
                "Name:- Devank Rastogi\nDesignation:- Director\n"
                "Email:- lapsntabs123@gmail.com\nContact No.:- 9918200166",
                fontsize=font_size,
                fontname="hebo",
                lineheight=1.0 if compact else 1.05,
            )
        page_from, page_to = CERT_PAGE_RANGES[doc_type]

        if doc_type in {"technical_compliance", "data_sheet"}:
            source_page = doc[page_from - 1]
            header_source_page = (
                doc[CERT_PAGE_RANGES["technical_compliance"][0] - 1]
                if doc_type == "data_sheet"
                else source_page
            )
            header_image = header_source_page.get_pixmap(
                matrix=fitz.Matrix(2, 2),
                clip=fitz.Rect(18, 12, header_source_page.rect.width - 18, 80),
                alpha=False,
            ).tobytes("png")
            new_doc = fitz.open()
            for _ in range(2):
                generated_page = new_doc.new_page(width=source_page.rect.width, height=source_page.rect.height)
                generated_page.insert_image(
                    fitz.Rect(18, 12, generated_page.rect.width - 18, 80),
                    stream=header_image,
                    keep_proportion=False,
                )
        else:
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

        def _lowercase_acxxel(page):
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

        for page_index, page in enumerate(new_doc):
            original_page_number = page_from + page_index
            # The Trade Mark Certificate (page 4 in the master template) is a
            # legal source document and must remain byte-for-byte visually
            # unchanged inside the MAF output.
            if doc_type == "manufacturer_auth" and original_page_number == 4:
                continue
            suppress_tender_on_page = original_page_number in suppress_tender_page_numbers
            page_text_raw = page.get_text("text")
            if doc_type == "service_support":
                _remove_to_whomsoever_line(
                    page,
                    include_bid_no=original_page_number == 30,
                )
                _remove_commas_from_service_contact_numbers(page)
                if original_page_number == 26:
                    _replace_service_support_heading(page)
                if original_page_number == 25:
                    _replace_service_support_consignee_contact(page)
                if original_page_number == 29:
                    _add_service_support_table_note(page)
                if original_page_number == 30:
                    _replace_service_support_clause_heading(page)
                    _replace_presented_with_represented(page)
                    _replace_service_support_confirmation(page)
                page_text_raw = page.get_text("text")

            if doc_type in {"manufacturer_auth", "service_support"}:
                _lowercase_acxxel(page)
                page_text_raw = page.get_text("text")

            if suppress_tender_on_page:
                _remove_tender_no_date_lines(page)
                page_text_raw = page.get_text("text")
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
                if page_index == 0:
                    _fill_main_technical_compliance_page(page)
                else:
                    _fill_storage_warranty_compliance_page(page)
                    _add_authorized_signatory(page, y=400)
                continue

            if doc_type == "data_sheet":
                content_bottom = _fill_generated_data_sheet_page(page, page_index)
                if page_index == len(new_doc) - 1:
                    _add_authorized_signatory(page, y=min(content_bottom + 8, 720), compact=True)
                continue
            if doc_type == "warranty":

                page_text_now = page.get_text("text")

                warranty_phrase_pattern = r'For\s+warranty\s+confirmation\s+visit[^\n]*'
                for m in re.finditer(warranty_phrase_pattern, page_text_now, re.IGNORECASE):
                    areas = page.search_for(m.group(0))
                    if areas:
                        for area in areas:
                            expand_rect = fitz.Rect(area.x0 - 2, area.y0 - 2, page.rect.width - 36, area.y1 + 2)
                            page.add_redact_annot(expand_rect, fill=(1, 1, 1))
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

                if model_number:
                    formatted_model = _format_model_number(model_number)

                    placeholder_patterns = [
                        r'he haaaaa+',
                        r'AXL-[A-Z0-9]+',
                        r'ACXXEL[^\s]+',
                        r'ACXOEL[^\s]+',
                        r'Model\s*No\.?\s*[:\s]*[^\n]+',
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

                                for area in areas:
                                    mid_y = (area.y0 + area.y1) / 2 + 4
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
                        ("acxxel DESKTOP ", True),
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

            page_has_tender_no = bool(
    re.search(r'(tender|bid)\s*no\.?\s*:', page_text_raw, re.IGNORECASE)
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

            if suppress_tender_on_page:
                needs_fallback = False
            elif page_has_tender_no:
                needs_fallback = False
            else:
                needs_fallback = True

            if "To," not in page_text_raw:
                if needs_fallback and (bid_no or bid_date_formatted):
                    tender_text = f"Bid No: {bid_no if bid_no else ''} Dated: {bid_date_formatted if bid_date_formatted else ''}"
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

                if needs_fallback and (bid_no or bid_date_formatted):
                    tender_text = f"Bid No: {bid_no if bid_no else ''} Dated: {bid_date_formatted if bid_date_formatted else ''}"

                    if write_x is not None and write_y is not None:
                        tender_x = write_x
                        tender_y = write_y + 45
                    else:
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

            merged_docs = list(dict.fromkeys(old_docs + analyser_docs))
            merged_labels = list(dict.fromkeys(old_labels + analyser_labels))

            bid.selected_general_docs = merged_docs
            bid.selected_general_doc_labels = merged_labels

            if analyser_username:
                bid.analyser_username = analyser_username

            bid.status = "complete"
            bid.review_status = "reviewed"
            message = "Analyser documents saved. Bid submitted to Admin."

        else:
            general_docs = _parse_json_list(selected_general_docs_raw)
            general_labels = _parse_json_list(selected_general_labels_raw)

            bid.selected_general_docs = general_docs
            bid.selected_general_doc_labels = general_labels

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

GEM_SECTIONS = [
    {"title": "PROCESSOR", "fields": ["Description of Stores", "Computer Type", "Processor Number"]},
    {"title": "MOTHERBOARD", "fields": ["Motherboard / Chipset", "Expansion Slots (PCIe x 1)", "Expansion Slots (PCIe x 4)", "Expansion Slots (PCIe x 16)", "Expansion Slots (M Dot 2) for SSD", "Expansion Slots (M Dot 2) for WiFi", "Trusted Platform Module"]},
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
    "Motherboard / Chipset": ["Motherboard / Chipset", "Motherboard", "Chipset"],
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
    if isinstance(extra_specs, dict) and extra_specs.get("Motherboard"):
        motherboard_text = str(extra_specs.get("Motherboard") or "")
        features = _extract_motherboard_features_from_text(motherboard_text)
        dimm_match = re.search(
            r"\b(\d+)\s*DIMM\b", motherboard_text, re.IGNORECASE
        )
        chipset_match = re.search(
            r"\b([A-Z]\d{3,4}[A-Z]?)\b", motherboard_text, re.IGNORECASE
        )

        def feature_text(key):
            value = features.get(key, 0)
            return str(value) if value else ""

        # Bid-created products keep the selected motherboard as raw text.
        # Expand it into the same standard fields used by imported catalogues.
        extra_specs = dict(extra_specs)
        extra_specs.update({
            "Motherboard / Chipset": (
                chipset_match.group(1).upper() if chipset_match else motherboard_text
            ),
            "Expansion Slots (PCIe x 1)": feature_text("pcie_x1"),
            "Expansion Slots (PCIe x 4)": feature_text("pcie_x4"),
            "Expansion Slots (PCIe x 16)": feature_text("pcie_x16"),
            "Expansion Slots (M Dot 2) for SSD": feature_text("m2_ssd"),
            "Expansion Slots (M Dot 2) for WiFi": feature_text("m2_wifi"),
            "Trusted Platform Module": "Yes" if features.get("tpm") else "",
            "Number of USB Type A Port (Version 2 Point 0)": feature_text("usb2"),
            "Number of USB Type A Port (Version 3 point 2 Gen 1)": feature_text("usb3"),
            "Number of USB Ports Type C": feature_text("type_c"),
            "Number of VGA Ports": feature_text("vga"),
            "Number of HDMI Ports": feature_text("hdmi"),
            "Number of DP Ports": feature_text("dp"),
            "Number of Ethernet Ports": feature_text("ethernet"),
            "Total Numbers of DIMM Slots Available": (
                dimm_match.group(1) if dimm_match else ""
            ),
        })
    extra_specs = _normalize_extra_specs(extra_specs)
    return {
        "id": product.id, "model_no": product.model_no or "",
        "processor": product.processor or "", "ram": product.ram or "",
        "storage": product.storage or "", "os": product.os or "",
        "category": product.category or "", "description": product.description or "",
        "extra_specs": extra_specs, "image": _file_url(request, product.image),
        "created_at": product.created_at.strftime("%Y-%m-%d") if product.created_at else "",
    }

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
        if not model_no: return JsonResponse({"error": "The model number could not be extracted from the PDF."}, status=400)
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

def _bid_data(bid, request, status_label=None):
    catalogue_product = CatalogueProduct.objects.filter(
        model_no__iexact=bid.model_number or ""
    ).first()
    catalogue_specs = _catalogue_extra_specs(catalogue_product) if catalogue_product else {}
    is_new_product = catalogue_specs.get("_source") == "desktop_bid"
    return {
        "id": bid.id, "user_name": bid.user.username if bid.user else "Unknown",
        "submitted_by": bid.user.username if bid.user else "Unknown",
        "bid_no": bid.bid_no, "dept_name": bid.dept_name, "qty": bid.qty,
        "organization": bid.organization or "", "address": bid.address or "",
        "pincode": bid.pincode or "",
        "atc": bid.atc or "",
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
        "gem_status": bid.gem_status or "not_started",
        "gem_account": bid.gem_account or "",
        "gem_product_id": bid.gem_product_id or "",
        "gem_product_url": bid.gem_product_url or "",
        "gem_error": bid.gem_error or "",
        "gem_uploaded_at": bid.gem_uploaded_at.isoformat() if bid.gem_uploaded_at else "",
        "model": bid.model_number or "", "model_number": bid.model_number or "",
        "is_new_product": is_new_product,
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
        "local_content": bid.local_content or "",
        "freightInstallation_price": bid.freightInstallation_price or 0, "freight_price": bid.freightInstallation_price or 0,
        "hddreturnable": bid.hddreturnable or "", "hddreturnable_price": bid.hddreturnable_price or 0,
        "total_price": bid.total_price or 0,

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

def _pincode_restriction_error(data):
    """Returns a 400 JsonResponse if the buyer or installation pincode is
    restricted (no supply available), else None."""
    for field, label in (("pincode", "Buyer"),):
        value = str(data.get(field) or "").strip()
        if value and is_restricted_pincode(value):
            return JsonResponse({
                "error": f"{label} Pincode: {restriction_message(value)}",
            }, status=400)
    return None


@csrf_exempt
@require_http_methods(["POST"])
def create_desktop_bid(request):
    try:
        data = request.POST
        user_id = data.get("user_id")
        if not user_id:
            return JsonResponse({"error": "User ID required"}, status=400)

        restriction_error = _pincode_restriction_error(data)
        if restriction_error:
            return restriction_error

        try:
            qty = int(data.get("qty", 0) or 0)
        except (TypeError, ValueError):
            return JsonResponse({"error": "Quantity must be a valid number"}, status=400)

        try:
            with transaction.atomic():
                # Lock the user row so simultaneous Step 1 requests cannot create
                # multiple incomplete bids for the same user.
                user = User.objects.select_for_update().get(id=user_id)
                incomplete_bids = DesktopBid.objects.filter(
                    user=user,
                    status__in=("draft", "configured"),
                ).order_by("-updated_at", "-id")
                bid = incomplete_bids.first()
                reused = bid is not None

                if reused:
                    bid.bid_no = data.get("bid_no", "")
                    bid.dept_name = data.get("dept_name", "")
                    bid.organization = data.get("organization", "")
                    bid.qty = qty
                    bid.address = data.get("address", "")
                    bid.pincode = data.get("pincode", "")
                    bid.atc = data.get("atc", "")
                    bid.save(update_fields=[
                        "bid_no", "dept_name", "organization", "qty",
                        "address", "pincode", "atc", "updated_at",
                    ])
                    incomplete_bids.exclude(id=bid.id).delete()
                else:
                    bid = DesktopBid.objects.create(
                        user=user,
                        bid_no=data.get("bid_no", ""),
                        dept_name=data.get("dept_name", ""),
                        organization=data.get("organization", ""),
                        qty=qty,
                        address=data.get("address", ""),
                        pincode=data.get("pincode", ""),
                        atc=data.get("atc", ""),

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
        except User.DoesNotExist:
            return JsonResponse({"error": "User not found"}, status=404)

        return JsonResponse({
            "message": "Desktop Bid Resumed Successfully" if reused else "Desktop Bid Created Successfully",
            "bid_id": bid.id,
            "user": user.username,
            "status": bid.status,
            "review_status": bid.review_status,
            "reused": reused,
        }, status=200 if reused else 201)

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

@csrf_exempt
@require_http_methods(["POST"])
def update_desktop_bid(request, bid_id):
    try:
        bid = DesktopBid.objects.get(id=bid_id)
        data = json.loads(request.body)
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

        if bid.freightInstallation == "No":
            bid.freightInstallation_price = 0
        else:
            freight_price = data.get("freightInstallation_price")
            if freight_price and freight_price != "price":
                bid.freightInstallation_price = safe_float(freight_price, bid.freightInstallation_price)

        bid.hddreturnable = data.get("hddreturnable", bid.hddreturnable)

        if data.get("hddreturnable_price"):
            bid.hddreturnable_price = safe_float(data.get("hddreturnable_price"), bid.hddreturnable_price)

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

@csrf_exempt
@require_http_methods(["POST"])
def save_model_number(request, bid_id):
    try:
        data = json.loads(request.body)
        model_number = _get_model_number_from_data(data)

        if not model_number:
            return JsonResponse({"error": "Model number required"}, status=400)

        model_number = model_number.strip().upper()

        with transaction.atomic():
            bid = DesktopBid.objects.select_for_update().get(id=bid_id)
            catalogue_product = CatalogueProduct.objects.filter(
                model_no__iexact=model_number
            ).first()
            catalogue_created = False

            storage_parts = [
                value
                for value in [bid.ssd1, bid.ssd2, bid.hdd]
                if str(value or "").strip()
            ]
            storage = " + ".join(str(value).strip() for value in storage_parts)

            ram_text = str(bid.ram or "").strip()
            ram_type_match = re.search(
                r"\bDDR\s*([345])\b(?:\s*\d+)?", ram_text, re.IGNORECASE
            )
            ram_size_match = re.search(r"\b(\d+)\s*GB\b", ram_text, re.IGNORECASE)
            ram_type = (
                re.sub(r"\s+", " ", ram_type_match.group(0)).replace("DDR ", "DDR")
                if ram_type_match
                else ""
            )
            ram_size = ram_size_match.group(1) if ram_size_match else ram_text

            hdd_capacity = _storage_to_gb(bid.hdd)
            ssd_capacity = _storage_to_gb(bid.ssd1 or bid.ssd2)
            motherboard_features = _extract_motherboard_features_from_text(
                bid.motherboard or ""
            )
            dimm_match = re.search(
                r"\b(\d+)\s*DIMM\b", str(bid.motherboard or ""), re.IGNORECASE
            )
            chipset_match = re.search(
                r"\b([A-Z]\d{3,4}[A-Z]?)\b",
                str(bid.motherboard or ""),
                re.IGNORECASE,
            )
            monitor_text = str(bid.monitor or "")
            monitor_ports = []
            if re.search(r"\bDP\b|display\s*port", monitor_text, re.IGNORECASE):
                monitor_ports.append("DP")
            if re.search(r"\bVGA\b", monitor_text, re.IGNORECASE):
                monitor_ports.append("VGA")
            if re.search(r"\bHDMI\b", monitor_text, re.IGNORECASE):
                monitor_ports.append("HDMI")

            def feature_value(key):
                value = motherboard_features.get(key, 0)
                return str(value) if value else ""

            extra_specs = {
                "_source": "desktop_bid",
                "Computer Type": "Desktop",
                "Processor Number": bid.processor or "",
                "Motherboard / Chipset": (
                    chipset_match.group(1).upper()
                    if chipset_match
                    else str(bid.motherboard or "")
                ),
                "RAM Size (Memory Card/Module) (in GB) (Capacity tobe installed in the System)": ram_size,
                "Type of RAM": ram_type,
                "Total Numbers of DIMM Slots Available": dimm_match.group(1) if dimm_match else "",
                "HDD - Storage Capacity (in GB)": str(hdd_capacity) if hdd_capacity is not None else "",
                "SSD - Storage Capacity (in GB)": str(ssd_capacity) if ssd_capacity is not None else "",
                "Type of Storage Installed with the System": storage,
                "Factory Pre-loaded Operating System by DesktopOEM": bid.os or "",
                "Optical Drive": bid.dvd or "",
                "Motherboard": bid.motherboard or "",
                "Expansion Slots (PCIe x 1)": feature_value("pcie_x1"),
                "Expansion Slots (PCIe x 4)": feature_value("pcie_x4"),
                "Expansion Slots (PCIe x 16)": feature_value("pcie_x16"),
                "Expansion Slots (M Dot 2) for SSD": feature_value("m2_ssd"),
                "Expansion Slots (M Dot 2) for WiFi": feature_value("m2_wifi"),
                "Trusted Platform Module": "Yes" if motherboard_features.get("tpm") else "",
                "Number of USB Type A Port (Version 2 Point 0)": feature_value("usb2"),
                "Number of USB Type A Port (Version 3 point 2 Gen 1)": feature_value("usb3"),
                "Number of USB Ports Type C": feature_value("type_c"),
                "Number of VGA Ports": feature_value("vga"),
                "Number of HDMI Ports": feature_value("hdmi"),
                "Number of DP Ports": feature_value("dp"),
                "Number of Ethernet Ports": feature_value("ethernet"),
                "Availibility of Monitor": "Yes" if monitor_text.strip() else "No",
                "Screen Size (in CMs)": monitor_text,
                "Monitor Port": ", ".join(monitor_ports),
                "Cabinet Form Factor": bid.cabinet or "",
                "Keyboard Connectivity": bid.keyboard or "",
                "Mouse Connectivity": bid.keyboard or "",
                "Type of Keyboard": bid.keyboard or "",
                "On Site OEM Warranty (in Year)": bid.warranty or "",
            }

            if catalogue_product is None:
                try:
                    # The nested atomic block is a savepoint. If two requests
                    # create the same canonical model simultaneously, the
                    # unique constraint wins and we reuse that single row.
                    with transaction.atomic():
                        catalogue_product = CatalogueProduct.objects.create(
                            model_no=model_number,
                            processor=bid.processor or "",
                            ram=bid.ram or "",
                            storage=storage,
                            os=bid.os or "",
                            category="Desktop",
                            description=bid.pro_descp or "Desktop Computer",
                            extra_specs=extra_specs,
                        )
                    catalogue_created = True
                except IntegrityError:
                    catalogue_product = CatalogueProduct.objects.get(
                        model_no__iexact=model_number
                    )
            else:
                existing_specs = _catalogue_extra_specs(catalogue_product)
                if (
                    existing_specs.get("_source") == "desktop_bid"
                    or "Motherboard" in existing_specs
                ):
                    existing_specs.update(extra_specs)
                    catalogue_product.processor = bid.processor or ""
                    catalogue_product.ram = ram_text
                    catalogue_product.storage = storage
                    catalogue_product.os = bid.os or ""
                    catalogue_product.category = "Desktop"
                    catalogue_product.extra_specs = existing_specs
                    catalogue_product.save(update_fields=[
                        "processor", "ram", "storage", "os", "category",
                        "extra_specs", "updated_at",
                    ])

            bid.model_number = catalogue_product.model_no

            if bid.status not in ["complete", "approved"]:
                bid.status = "configured"
                bid.review_status = "pending"

            bid.save()

        return JsonResponse({
            "success": True,
            "bid_id": bid.id,
            "model_number": bid.model_number,
            "model": bid.model_number,
            "product_id": catalogue_product.id,
            "source": "catalogue",
            "catalogue_created": catalogue_created,
            "status": bid.status,
            "review_status": bid.review_status,
        }, status=200)

    except DesktopBid.DoesNotExist:
        return JsonResponse({"error": "Bid not found"}, status=404)

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

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
                bids = DesktopBid.objects.filter(
                    status="complete",
                    review_status__in=["reviewed", "approved"],
                ).order_by("-created_at")
            else:
                bids = DesktopBid.objects.filter(
                    status="complete",
                    review_status=status_filter,
                ).order_by("-created_at")

        result = [_bid_data(bid, request, status_label=status_filter) for bid in bids]
        return JsonResponse(result, safe=False, status=200)

    except Exception as e:
        print("ERROR:", str(e))
        return JsonResponse({"error": str(e)}, status=400)

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

@csrf_exempt
@require_http_methods(["PATCH"])
def review_desktop_bid(request, bid_id):
    try:
        bid = DesktopBid.objects.get(id=bid_id)
        data = json.loads(request.body)
        restriction_error = _pincode_restriction_error(data)
        if restriction_error:
            return restriction_error
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

        restriction_error = _pincode_restriction_error(data)
        if restriction_error:
            return restriction_error

        action = data.get("status", "")
        if action not in ("approved", "re-analyze"):
            return JsonResponse({"error": "Invalid status."}, status=400)

        if action == "approved":
            local_content = str(data.get("local_content") or "").strip().rstrip("%")
            if not local_content:
                return JsonResponse({"error": "Local Content (%) is mandatory."}, status=400)
            try:
                local_content_number = float(local_content)
            except (TypeError, ValueError):
                return JsonResponse({"error": "Local Content must be a valid number."}, status=400)
            if local_content_number < 0 or local_content_number > 100:
                return JsonResponse({"error": "Local Content must be between 0 and 100."}, status=400)

            if (
                str(data.get("hddreturnable") or bid.hddreturnable or "").strip().lower() == "yes"
                and safe_float(data.get("hddreturnable_price"), 0) <= 0
            ):
                return JsonResponse({
                    "error": "HDD Return Option price is mandatory when the option is Yes."
                }, status=400)

            approved_price = safe_float(data.get("total_price"), 0)
            if approved_price <= 0:
                return JsonResponse({
                    "error": "Bid Approved Price is mandatory and must be greater than 0."
                }, status=400)

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
        if "local_content" in data:
            bid.local_content = str(data.get("local_content") or "").strip().rstrip("%")
        bid.freightInstallation = data.get("freightInstallation", bid.freightInstallation)
        if bid.freightInstallation == "No":
            bid.freightInstallation_price = 0
        else:
            bid.freightInstallation_price = safe_float(data.get("freightInstallation_price"), bid.freightInstallation_price)
        bid.hddreturnable = data.get("hddreturnable", bid.hddreturnable)
        bid.hddreturnable_price = safe_float(data.get("hddreturnable_price"), bid.hddreturnable_price)
        bid.total_price = safe_float(data.get("total_price"), bid.total_price)

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


GEM_UPLOAD_STATUSES = {
    "not_started", "queued", "login_required", "filling", "submitted",
    "published", "rejected", "failed",
}

def _gem_accounts():
    account_file = Path(settings.BASE_DIR) / "gem_accounts.json"
    try:
        data = json.loads(account_file.read_text(encoding="utf-8"))
        accounts = data.get("accounts", [])
        return accounts if isinstance(accounts, list) else []
    except (OSError, ValueError, TypeError):
        return []


@csrf_exempt
@require_http_methods(["GET"])
def list_desktop_gem_accounts(request):
    return JsonResponse([
        {
            "id": str(account.get("id") or ""),
            "label": str(account.get("label") or account.get("username") or ""),
            "username": str(account.get("username") or ""),
        }
        for account in _gem_accounts()
        if account.get("id") and account.get("username")
    ], safe=False)


def _desktop_gem_payload(bid, request, account):
    model_number = str(bid.model_number or "").upper()
    local_content = str(bid.local_content or "").strip().rstrip("%")
    processor_text = str(bid.processor or "")
    keyboard_mouse_text = str(bid.keyboard or "").strip()
    if re.search(r"\bwireless\b", keyboard_mouse_text, re.IGNORECASE):
        gem_keyboard_mouse_connectivity = "Wireless"
    elif re.search(r"\bwired\b|\busb\b", keyboard_mouse_text, re.IGNORECASE):
        gem_keyboard_mouse_connectivity = "USB Wired"
    else:
        gem_keyboard_mouse_connectivity = ""
    cabinet_text = str(bid.cabinet or "").strip()
    is_tower_cabinet = bool(re.search(r"\btower\b", cabinet_text, re.IGNORECASE))
    is_sff_cabinet = bool(re.search(
        r"\b(?:sff|ssf|small\s+form\s+factor)\b",
        cabinet_text,
        re.IGNORECASE,
    ))
    gem_cabinet = (
        "Tower (More than 13 to 26 Liters)"
        if is_tower_cabinet
        else "SMALL FORM FACTOR (7 to 13 Liters)" if is_sff_cabinet else ""
    )
    cabinet_bays = (
        ("1", "0", "2", "1")
        if is_tower_cabinet
        else ("1", "0", "1", "0") if is_sff_cabinet else ("", "", "", "")
    )
    graphics_model = (
        "Intel AMD"
        if re.search(r"\b(?:amd|ryzen)\b", processor_text, re.IGNORECASE)
        else "Intel HD 60"
    )
    if model_number.startswith("ACL-1060DS-25DE-"):
        gem_computer_type = "Entry Level"
        gem_category = {
            "key": "entry_level",
            "label": "Entry and Mid Level Desktop Computer",
            "slug": "computers-entry-level-computer-cpu",
        }
    elif model_number.startswith("ACL-1077DS-25DE-"):
        gem_computer_type = "Mid Level"
        gem_category = {
            "key": "mid_level",
            "label": "Entry and Mid Level Desktop Computer",
            "slug": "computers-mid-level-computer-cpu",
        }
    elif model_number.startswith("ACL-1082DS-25DE-"):
        gem_computer_type = "High End"
        gem_category = {
            "key": "high_end",
            "label": "High End Desktop Computer",
            "slug": "computers-high-end-computer-cpu",
        }
    else:
        gem_computer_type = None
        gem_category = {
            "key": "entry_level",
            "label": "Entry and Mid Level Desktop Computer",
            "slug": "computers-entry-level-computer-cpu",
        }

    catalogue_product = CatalogueProduct.objects.filter(
        model_no__iexact=bid.model_number or ""
    ).first()
    catalogue_specs = (
        _catalogue_extra_specs(catalogue_product)
        if catalogue_product
        else {}
    )
    exact_gem_specs = {
        "Description of Stores": (
            catalogue_specs.get("Description of Stores") or "Desktop Computer"
        ),
        "Computer Type": (
            gem_computer_type
            or catalogue_specs.get("Computer Type")
            or "Desktop"
        ),
        "Processor Number": (
            catalogue_specs.get("Processor Number") or bid.processor or ""
        ),
        "Factory Pre-loaded Operating System by Desktop OEM": (
            catalogue_specs.get("Factory Pre-loaded Operating System by Desktop OEM")
            or catalogue_specs.get("Factory Pre-loaded Operating System by DesktopOEM")
            or bid.os
            or ""
        ),
        "RAM Size (Memory Card/Module) (in GB) (Capacity to be installed in the System)": (
            catalogue_specs.get(
                "RAM Size (Memory Card/Module) (in GB) (Capacity to be installed in the System)"
            )
            or catalogue_specs.get(
                "RAM Size (Memory Card/Module) (in GB) (Capacity tobe installed in the System)"
            )
            or bid.ram
            or ""
        ),
        "Type of Storage Installed with the System": (
            catalogue_specs.get("Type of Storage Installed with the System")
            or " + ".join(filter(None, [bid.ssd1, bid.ssd2, bid.hdd]))
        ),
        "SSD - Storage Capacity (in GB)": (
            catalogue_specs.get("SSD - Storage Capacity (in GB)")
            or str(_storage_to_gb(bid.ssd1 or bid.ssd2) or "")
        ),
        "HDD - Storage Capacity (in GB)": (
            catalogue_specs.get("HDD - Storage Capacity (in GB)")
            or str(_storage_to_gb(bid.hdd) or "")
        ),
        "Availibility of Monitor": (
            catalogue_specs.get("Availibility of Monitor")
            or ("Yes" if str(bid.monitor or "").strip() else "No")
        ),
        "Screen Size (in CMs)": (
            catalogue_specs.get("Screen Size (in CMs)") or bid.monitor or ""
        ),
        "On Site OEM Warranty (in Year)": (
            catalogue_specs.get("On Site OEM Warranty (in Year)")
            or bid.warranty
            or ""
        ),
    }
    motherboard_text = bid.motherboard or catalogue_specs.get("Motherboard") or ""
    motherboard_features = _extract_motherboard_features_from_text(motherboard_text)
    motherboard_field_map = {
        "Expansion Slots (PCIe x 1)": "pcie_x1",
        "Expansion Slots (PCIe x 4)": "pcie_x4",
        "Expansion Slots (PCIe x 16)": "pcie_x16",
        "Expansion Slots (M Dot 2) for SSD": "m2_ssd",
        "Expansion Slots (M Dot 2) for WiFi": "m2_wifi",
    }
    for label, feature_key in motherboard_field_map.items():
        exact_gem_specs[label] = str(motherboard_features.get(feature_key, 0))
    exact_gem_specs["Trusted Platform Module"] = (
        "No TPM 2.0"
    )
    exact_gem_specs.update({
        "Graphics Type": "Integrated",
        "Graphic Card Make and Model - Must declare": graphics_model,
        "Size of Memory in Case of Dedicated Graphic Card (GB)": "0",
        "Size of Memory in Case of Dedicated Graphic Card(GB)": "0",
        "Recovery Media for OS": "On line/cloud",
        "Type of RAM": "DDR4",
        "Memory Expandable Up To (in GB)": "64",
        "Total Numbers of DIMM Slots Available": "2",
        "Number of DIMM Slots Populated with Memory Card/Module": "1",
        "Cabinet Form Factor": gem_cabinet,
        "Number of Internal Bays Available, Size 2 Point 5 Inch": cabinet_bays[0],
        "Number of Internal Bay Populated, Size 2 Point 5 Inch": cabinet_bays[1],
        "Number of Internal Bays Available, Size 3 Point 5 inch": cabinet_bays[2],
        "Number of Internal Bay Populated, Size 3 Point 5 inch": cabinet_bays[3],
        "Bays for Optical Drive": "0",
        "Optical Drive": "No Optical Drive",
        "Audio Interface Type": "true",
        "Type of Ethernet Ports": "__FIRST_NON_PLACEHOLDER__",
        "Number of Ethernet Ports": "__FIRST_NON_PLACEHOLDER__",
        "Availibility of RoHS Certificate": "__FIRST_NON_PLACEHOLDER__",
        "Availability of Certification for Environmental Management System with Manufacturer": "__FIRST_NON_PLACEHOLDER__",
        "Compliance of Information Security, Cybersecurity and Privacy Protection-Information Security Management Systems Requirements": "__FIRST_NON_PLACEHOLDER__",
        "Availability of EPR Registration in Respect of the Manufacturer as per e-Waste Rules as Amended Up To Date": "__FIRST_NON_PLACEHOLDER__",
        "Agreed to Provide a copy of EPR Registration Certificate to Buyer on Demand": "__FIRST_NON_PLACEHOLDER__",
        "Minimum Operating Temperature (in Degree Celsius)": "-5",
        "Maximum Operating Temperature (in Degree Celsius)": "35",
        "Operating Humidity(RH) (in Percentage)": "10 to 90",
        "Power Supply Capacity- Maximum (in Watt)": "200",
        "Minimum Power Efficiency Range (%)": "80-84",
        "Mouse Connectivity": gem_keyboard_mouse_connectivity,
        "Keyboard Connectivity": gem_keyboard_mouse_connectivity,
        "Type of Keyboard": "Standard",
        "Number of USB Ports Type C": "0",
        "Number of VGA Ports": "1",
        "Number of HDMI Ports": "1",
        "Number of DP Ports": "0",
        "Panel Type": "In Plane Switching (IPS)",
        "Display Technology": "LED Backlit LCD",
        "Maximum Resolution (Pixels)": "1920 x 1080 (Full HD)",
        "Image Aspect Ratio": "16:9",
        "Brightness (in Nits)": "200 to 250",
        "Refresh Rate (in Hz)": "60 to 70",
        "Monitor Port": "HDMI, VGA",
        "Integrated Webcam with Mic": "No",
        "Power Supply for Monitor": "External Power Adapter",
        "Speaker": "No",
    })

    document_types = [
        "approved_atc_documents",
        "approved_price_paper",
        "approved_all_documents",
    ]
    documents = [
        {
            "type": doc_type,
            "url": request.build_absolute_uri(
                f"/api/desktop-bids/{bid.id}/generate-docs/"
            ),
        }
        for doc_type in document_types
    ]
    return {
        "workflow": "desktop_gem_upload",
        "gem_account": {
            "id": str(account.get("id") or ""),
            "username": str(account.get("username") or ""),
            "password": str(account.get("password") or ""),
        },
        "bid_id": bid.id,
        "callback_url": request.build_absolute_uri(
            f"/api/desktop-bids/{bid.id}/gem-status/"
        ),
        "model_number": bid.model_number or "",
        "brand": "ACXXEL",
        "category": gem_category,
        "quantity": bid.qty,
        "price": bid.total_price,
        "bid_number": bid.bid_no,
        "department": bid.dept_name,
        "organization": bid.organization or "",
        "delivery_address": bid.address or "",
        "pincode": bid.pincode or "",
        "local_content": local_content,
        "specifications": {
            **catalogue_specs,
            **exact_gem_specs,
            "Processor": bid.processor or "",
            "RAM": bid.ram or "",
            "HDD": bid.hdd or "",
            "SSD": " + ".join(filter(None, [bid.ssd1, bid.ssd2])),
            "Operating System": bid.os or "",
            "Optical Drive": exact_gem_specs["Optical Drive"],
            "WiFi / Bluetooth": bid.wifi or "",
            "Monitor": bid.monitor or "",
            "Cabinet": bid.cabinet or "",
            "Keyboard / Mouse": bid.keyboard or "",
            "On Site OEM Warranty": bid.warranty or "",
            "Motherboard": bid.motherboard or "",
            "Optional Ports": bid.optional_ports or "",
        },
        "documents": documents,
        "images": [
            request.build_absolute_uri(catalogue_product.image.url)
            for _ in [0]
            if catalogue_product and catalogue_product.image
        ],
    }


@csrf_exempt
@require_http_methods(["POST"])
def start_desktop_gem_upload(request, bid_id):
    try:
        bid = DesktopBid.objects.get(id=bid_id)
        if bid.review_status != "approved":
            return JsonResponse(
                {"error": "Admin approval is required before GeM upload."},
                status=409,
            )
        if not bid.model_number:
            return JsonResponse(
                {"error": "Select or create a model before GeM upload."},
                status=409,
            )
        data = _body_json(request)
        account_id = str(data.get("gem_account") or "").strip()
        account = next(
            (item for item in _gem_accounts() if str(item.get("id")) == account_id),
            None,
        )
        if not account:
            return JsonResponse({"error": "Please select a valid GeM account."}, status=400)
        bid.gem_account = account_id
        bid.gem_status = "queued"
        bid.gem_error = ""
        bid.save(update_fields=["gem_account", "gem_status", "gem_error", "updated_at"])
        return JsonResponse({
            "success": True,
            "gem_status": bid.gem_status,
            "payload": _desktop_gem_payload(bid, request, account),
        })
    except DesktopBid.DoesNotExist:
        return JsonResponse({"error": "Bid not found"}, status=404)


@csrf_exempt
@require_http_methods(["PATCH", "POST"])
def update_desktop_gem_status(request, bid_id):
    try:
        bid = DesktopBid.objects.get(id=bid_id)
        data = _body_json(request)
        status_value = str(data.get("status") or "").strip().lower()
        if status_value not in GEM_UPLOAD_STATUSES:
            return JsonResponse({"error": "Invalid GeM status."}, status=400)

        bid.gem_status = status_value
        bid.gem_product_id = str(data.get("product_id") or bid.gem_product_id or "").strip()
        bid.gem_product_url = str(data.get("product_url") or bid.gem_product_url or "").strip()
        bid.gem_error = str(data.get("error") or "").strip()
        if status_value in {"submitted", "published"}:
            bid.gem_uploaded_at = timezone.now()
        bid.save(update_fields=[
            "gem_status", "gem_product_id", "gem_product_url", "gem_error",
            "gem_uploaded_at", "updated_at",
        ])
        return JsonResponse({"success": True, "gem_status": bid.gem_status})
    except DesktopBid.DoesNotExist:
        return JsonResponse({"error": "Bid not found"}, status=404)

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

    if not features["pcie_x1"] and re.search(r"\bpci1\b", t):
        features["pcie_x1"] = 1
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

    known_slot_profiles = {
        "b650": {"pcie_x1": 0, "pcie_x4": 2, "pcie_x16": 2, "m2_ssd": 0, "m2_wifi": 0},
        "a520": {"pcie_x1": 0, "pcie_x4": 1, "pcie_x16": 1, "m2_ssd": 0, "m2_wifi": 0},
        "h810": {"pcie_x1": 1, "pcie_x4": 0, "pcie_x16": 1, "m2_ssd": 1, "m2_wifi": 0},
        "h610": {"pcie_x1": 0, "pcie_x4": 1, "pcie_x16": 1, "m2_ssd": 1, "m2_wifi": 0},
        "q670": {"pcie_x1": 0, "pcie_x4": 2, "pcie_x16": 1, "m2_ssd": 2, "m2_wifi": 0},
    }
    for chipset, profile in known_slot_profiles.items():
        if re.search(rf"\b{chipset}\b", t):
            features.update(profile)
            features["tpm"] = 1
            break

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
    motherboard_text = _catalogue_extra_specs(product).get("Motherboard", "")
    if motherboard_text:
        for key, value in _extract_motherboard_features_from_text(
            motherboard_text
        ).items():
            features[key] = max(features[key], value)
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

_BID_DIRECT_FIELD_MAP = {
    "processor": "processor",
    "ram": "ram",
    "hdd": "hdd",
    "ssd": "ssd1",
    "os": "os",
    "dvd": "dvd",
    "wifi": "wifi",
    "motherboard": "motherboard",
    "monitor": "monitor",
    "cabinet": "cabinet",
    "keyboard": "keyboard",
    "warranty": "warranty",
}

def _best_bid_match(bid_key, bid_value, other_bid):
    """Compare current bid's spec value against another already-saved bid's
    direct fields (used for finding a duplicate/matching model number
    among bids, same way we do for CatalogueProduct)."""
    if _match_is_blank(bid_value):
        return None, "", "", -1

    field_name = _BID_DIRECT_FIELD_MAP.get(bid_key)
    if not field_name:
        return False, "", "", -1

    other_value = getattr(other_bid, field_name, "") or ""
    if bid_key == "ssd" and _match_is_blank(other_value):
        other_value = getattr(other_bid, "ssd2", "") or ""

    if _match_is_blank(other_value):
        return False, "", "", -1

    score = _values_overlap_score(bid_value, other_value)
    matched = score >= 100
    return matched, field_name, other_value, score

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
            "bid_id": None,
            "source": "catalogue",
            "category": product.category or "",
            "match_count": matched_count,
            "total_checked": checked_count,
            "total_score": round(total_score, 2),
            "is_perfect": is_perfect,
            "debug_details": details,
        }
        results.append(result)
        debug_all.append(result)

    other_bids_qs = (
        DesktopBid.objects.exclude(id=bid.id)
        .exclude(model_number__isnull=True)
        .exclude(model_number="")
    )

    for other_bid in other_bids_qs:
        matched_count = 0
        checked_count = 0
        total_score = 0
        details = []

        for bid_key in _CATALOGUE_FIELD_MAP.keys():
            bid_value = bid_specs.get(bid_key, "")
            if _match_is_blank(bid_value):
                continue

            matched, best_key, best_value, best_score = _best_bid_match(
                bid_key, bid_value, other_bid
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
            "model_no": other_bid.model_number or "",
            "product_id": None,
            "bid_id": other_bid.id,
            "source": "bid",
            "category": "",
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
        debug_all.sort(key=lambda x: (-x["match_count"], -x["total_score"], x["model_no"]))
        best_failed = debug_all[0] if debug_all else None
        return JsonResponse({
            "match": None,
            "matches": [],
            "total_found": 0,
            "has_perfect_match": False,
            "message": "No exact matching model was found.",
            "bid_specs_used": bid_specs,
            "best_failed_match": best_failed,
        }, status=200)

    perfect_results.sort(key=lambda x: (-x["match_count"], -x["total_score"], x["model_no"]))
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
            updated_at__date__gte=sunday,
            updated_at__date__lte=today,
        )

        date_map = {item["date"]: item for item in result}

        for bid in bids:
            if not bid.updated_at:
                continue

            bid_date = timezone.localtime(bid.updated_at).date().strftime("%Y-%m-%d")

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

@csrf_exempt
@require_http_methods(["GET"])
def admin_desktop_monthly_performance(request):
    try:
        year = _get_year(request)
        analyser = request.GET.get("analyser")
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

        analyser = request.GET.get("analyser")

        bids_qs = DesktopBid.objects.filter(
            status="complete",
            review_status__in=["reviewed", "approved", "re-analyze"],
            updated_at__date__gte=sunday,
            updated_at__date__lte=today,
        )
        if analyser:
            bids_qs = bids_qs.filter(analyser_username=analyser)

        date_map = {item["date"]: item for item in result}

        for bid in bids_qs:
            if not bid.updated_at:
                continue

            bid_date = timezone.localtime(bid.updated_at).date().strftime("%Y-%m-%d")
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

@csrf_exempt
@require_http_methods(["GET"])
def admin_desktop_stats(request):
    try:
        year = request.GET.get("year")
        analyser = request.GET.get("analyser")
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
