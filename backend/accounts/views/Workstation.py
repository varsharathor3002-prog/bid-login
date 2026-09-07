import json
import os
import re
import time
from datetime import datetime
import pandas as pd
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.test import RequestFactory
from ..models import User, WorkstationBid, CatalogueProduct
from .bid_cleanup import delete_bid_with_related_data

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
    _catalogue_extra_specs,
)


def _workstation_catalogue_path():
    return os.path.join(settings.BASE_DIR, "worksation.xlsx")


def _ws_clean(value):
    if value is None:
        return ""
    text = str(value).strip()
    return "" if text.lower() in {"nan", "none", "null"} else text


def _load_workstation_catalogue():
    path = _workstation_catalogue_path()
    if not os.path.exists(path):
        return []
    try:
        import pandas as pd
        df = pd.read_excel(path).fillna("")
    except Exception:
        return []

    products = []
    for index, row in df.iterrows():
        model_no = _ws_clean(row.get("Model Number"))
        if not model_no:
            continue
        ssd = _ws_clean(row.get(" SSD") or row.get("SSD"))
        hdd = _ws_clean(row.get(" HDD") or row.get("HDD"))
        product = {
            "id": f"workstation-{index + 1}",
            "model_no": model_no,
            "category": "Workstation",
            "processor": _ws_clean(row.get("Processor")),
            "motherboard": _ws_clean(row.get("Motherboard") or row.get("Mother Board") or row.get("Motherboard Model")),
            "ram": _ws_clean(row.get("RAM")),
            "storage": ", ".join(value for value in [ssd, hdd] if value),
            "ssd": ssd,
            "hdd": hdd,
            "graphics": _ws_clean(row.get("Graphics Card")),
            "os": _ws_clean(row.get("Operating System")),
            "monitor": _ws_clean(row.get("Monitor Size ")),
            "power_supply": _ws_clean(row.get("Power Supply")),
        }
        product["description"] = " | ".join(
            value for value in [
                product["processor"],
                product["motherboard"],
                product["ram"],
                product["storage"],
                product["graphics"],
                product["os"],
                product["monitor"],
                product["power_supply"],
            ] if value
        )
        product["extra_specs"] = {
            "Processor Number": product["processor"],
            "Motherboard": product["motherboard"],
            "RAM": product["ram"],
            "SSD": product["ssd"],
            "HDD": product["hdd"],
            "Graphic Card Make and Model": product["graphics"],
            "Factory Pre-loaded Operating System": product["os"],
            "Screen Size": product["monitor"],
            "Power Supply": product["power_supply"],
        }
        products.append(product)
    return products


def _ws_storage_gb(value):
    # worksation.xlsx / the SSD-SSD dropdown both use 1TB == 1024GB (the
    # dropdown's own "1024 GB (1TB) Sata SSD" label says so) — but the
    # shared Desktop._storage_to_gb helper (used by _values_overlap_score's
    # storage-equality bonus) treats "1 TB" as a decimal 1000, so a bid built
    # from the "M.2 SSD NVME 1024GB" option (no "TB" in the text at all)
    # would never register as equal to the catalogue's "1TB M.2 SSD" (1024
    # != 1000) and silently drop that field out of a Find Model match.
    text = re.sub(r"[^a-z0-9. ]+", " ", str(value or "").lower())
    if not text.strip():
        return None
    m_tb = re.search(r"(\d+(?:\.\d+)?)\s*tb", text)
    if m_tb:
        return int(float(m_tb.group(1)) * 1024)
    m_gb = re.search(r"(\d+(?:\.\d+)?)\s*gb", text)
    if m_gb:
        return int(float(m_gb.group(1)))
    return None


def _workstation_catalogue_match_value(bid_value, catalogue_value, field_name=""):
    absent_values = {"", "-", "none", "no", "n/a", "na", "not applicable", "not required"}
    bid_absent = str(bid_value or "").strip().lower() in absent_values
    catalogue_absent = str(catalogue_value or "").strip().lower() in absent_values
    if bid_absent and catalogue_absent:
        return True, 2500
    if bid_absent or catalogue_absent:
        return False, 0
    bid_normalized = re.sub(r"[^a-z0-9]+", "", str(bid_value).lower())
    catalogue_normalized = re.sub(r"[^a-z0-9]+", "", str(catalogue_value).lower())
    if bid_normalized and bid_normalized == catalogue_normalized:
        return True, 2500
    if field_name == "monitor":
        bid_numbers = [float(value) for value in re.findall(r"\d+(?:\.\d+)?", str(bid_value))]
        catalogue_numbers = [float(value) for value in re.findall(r"\d+(?:\.\d+)?", str(catalogue_value))]
        if bid_numbers and len(catalogue_numbers) >= 2:
            selected_size = bid_numbers[0]
            lower_size, upper_size = catalogue_numbers[0], catalogue_numbers[1]
            if lower_size <= selected_size <= upper_size:
                return True, 2500
    if field_name in ("ssd", "hdd"):
        bid_gb = _ws_storage_gb(bid_value)
        catalogue_gb = _ws_storage_gb(catalogue_value)
        if bid_gb is not None and catalogue_gb is not None and bid_gb == catalogue_gb:
            return True, 2200
    score = _values_overlap_score(bid_value, catalogue_value)
    return score >= 100, score


# ────────────────────────────────────────────
# STEP 1 — Create Workstation Bid
# ────────────────────────────────────────────

@csrf_exempt
@require_http_methods(["POST"])
def create_workstation_bid(request):
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

        bid = WorkstationBid.objects.create(
            user          = user,
            bid_no        = data.get("bid_no", ""),
            dept_name     = data.get("dept_name", ""),
            organization  = data.get("organization", ""),
            qty           = int(data.get("qty", 0) or 0),
            address       = data.get("address", ""),
            pincode       = data.get("pincode", ""),
            atc           = data.get("atc", ""),
            status        = "draft",
            review_status = "pending",
            processor     = "",
            ram           = "",
            os            = "",
            monitor       = "",
            cabinet       = "",
            warranty      = "",
            motherboard   = "",
            date          = "2000-01-01",
            selected_general_docs       = [],
            selected_general_doc_labels = [],
        )

        return JsonResponse({
            "message"      : "Workstation Bid Created Successfully",
            "bid_id"       : bid.id,
            "user"         : user.username,
            "status"       : bid.status,
            "review_status": bid.review_status,
        }, status=201)

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return JsonResponse({"error": str(e)}, status=400)


# ────────────────────────────────────────────
# STEP 2 — Update Workstation Specs
# ────────────────────────────────────────────

@csrf_exempt
@require_http_methods(["POST"])
def update_workstation_bid(request, bid_id):
    try:
        try:
            bid = WorkstationBid.objects.get(id=bid_id)
        except WorkstationBid.DoesNotExist:
            return JsonResponse({"error": f"Bid ID {bid_id} not found"}, status=404)

        data = json.loads(request.body)

        # ── Processor ──────────────────────────────────────────
        bid.processor         = data.get("processor",       bid.processor or "")
        bid.processor_price   = float(data.get("processor_price", 0) or 0)
        bid.pro_descp         = data.get("pro_descp",       bid.pro_descp or "")
        bid.pro_descp_price   = float(data.get("pro_descp_price", 0) or 0)

        # ── Motherboard ────────────────────────────────────────
        bid.motherboard             = data.get("motherboard",       bid.motherboard or "")
        bid.motherboard_price       = float(data.get("motherboard_price", 0) or 0)
        bid.motherboard_descp       = data.get("motherboard_descp", bid.motherboard_descp or "")
        bid.motherboard_descp_price = float(data.get("motherboard_descp_price", 0) or 0)

        # ── RAM ────────────────────────────────────────────────
        bid.ram       = data.get("ram",       bid.ram or "")
        bid.ram_price = float(data.get("ram_price", 0) or 0)

        # ── Storage ────────────────────────────────────────────
        bid.ssd1       = data.get("ssd",       data.get("ssd1",       bid.ssd1 or ""))
        bid.ssd1_price = float(data.get("ssd_price", data.get("ssd1_price", 0)) or 0)
        bid.ssd2       = data.get("ssd2",      bid.ssd2 or "")
        bid.ssd2_price = float(data.get("ssd2_price", 0) or 0)
        bid.hdd        = data.get("hdd",       bid.hdd or "")
        bid.hdd_price  = float(data.get("hdd_price", 0) or 0)

        # ── Graphics Card ──────────────────────────────────────
        bid.graphic_card         = data.get("graphics",       data.get("graphic_card",       bid.graphic_card or ""))
        bid.graphic_card_price   = float(data.get("graphics_price", data.get("graphic_card_price", 0)) or 0)
        bid.graphics_description = data.get("gp",             bid.graphics_description or "")

        # ── OS ─────────────────────────────────────────────────
        bid.os       = data.get("os",       bid.os or "")
        bid.os_price = float(data.get("os_price", 0) or 0)

        # ── Peripherals ────────────────────────────────────────
        bid.monitor       = data.get("monitor",  bid.monitor or "")
        bid.monitor_price = float(data.get("monitor_price", 0) or 0)

        bid.cabinet       = data.get("cabinet",  bid.cabinet or "")
        bid.cabinet_price = float(data.get("cabinet_price", 0) or 0)

        bid.keyboard       = data.get("keyboard", bid.keyboard or "")
        bid.keyboard_price = float(data.get("keyboard_price", 0) or 0)

        bid.power_supply       = data.get("power_supply", bid.power_supply or "")
        bid.power_supply_price = float(data.get("power_supply_price", 0) or 0)

        # ── Connectivity ───────────────────────────────────────
        bid.dvd       = data.get("dvd",  bid.dvd or "")
        bid.dvd_price = float(data.get("dvd_price", 0) or 0)

        bid.wifi       = data.get("wifi", bid.wifi or "")
        bid.wifi_price = float(data.get("wifi_price", 0) or 0)

        # ── Software ───────────────────────────────────────────
        bid.additional_software = data.get("software1", bid.additional_software or "")

        # ── Warranty & Services ────────────────────────────────
        bid.warranty       = data.get("warranty", bid.warranty or "")
        bid.warranty_price = float(data.get("warranty_price", 0) or 0)

        bid.freightInstallation       = data.get("freightInstallation",       bid.freightInstallation or "Yes")
        bid.freightInstallation_price = float(data.get("freightInstallation_price", 1000) or 1000)

        # ── HDD Non-Return ─────────────────────────────────────
        bid.hdd_non_return       = data.get("hddreturnable",       bid.hdd_non_return or "No")
        bid.hdd_non_return_price = float(data.get("hddreturnable_price", 0) or 0)

        # ── Extra Requirements ─────────────────────────────────
        bid.extra_requirements = data.get("extra_requirements", bid.extra_requirements or "")

        # ── Financials ─────────────────────────────────────────
        bid.date = data.get("date") or None
        bid.epbg = float(data.get("epbg", 0) or 0)

        bid.status = "configured"
        bid.save()

        return JsonResponse({
            "message": "Workstation Specs Saved Successfully",
            "bid_id" : bid.id,
            "status" : bid.status,
        }, status=200)

    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON body"}, status=400)
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return JsonResponse({"error": str(e)}, status=400)
def _workstation_bid_data(bid, request, status_label=None):
    user_name = bid.user.username if bid.user else ""
    price_fields = (
        "processor_price", "pro_descp_price", "motherboard_price",
        "motherboard_descp_price", "ram_price", "ssd1_price", "ssd2_price",
        "hdd_price", "graphic_card_price", "cabinet_price", "keyboard_price",
        "power_supply_price", "monitor_price", "os_price", "wifi_price",
        "dvd_price", "warranty_price", "freightInstallation_price",
        "hdd_non_return_price", "extra_requirements_price",
    )
    calculated_price = sum(float(getattr(bid, field, 0) or 0) for field in price_fields)
    approved_price = bid.final_amount or bid.total_price or calculated_price
    catalogue_product = CatalogueProduct.objects.filter(model_no__iexact=bid.model_number or "").first()
    catalogue_specs = _catalogue_extra_specs(catalogue_product) if catalogue_product else {}
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
        "submitted_by": user_name,
        "user_name": user_name,
        "status": status_label or bid.review_status,
        "review_status": bid.review_status,
        "created_at": bid.created_at.isoformat() if bid.created_at else "",
        "updated_at": bid.updated_at.isoformat() if bid.updated_at else "",
        "atc_special_document": _file_url(request, bid.atc_special_document),
        "selected_general_docs": bid.selected_general_docs or [],
        "selected_general_doc_labels": bid.selected_general_doc_labels or [],
        "processor": bid.processor or "",
        "processor_price": bid.processor_price,
        "pro_descp": bid.pro_descp or "",
        "pro_descp_price": bid.pro_descp_price,
        "motherboard": bid.motherboard or "",
        "motherboard_price": bid.motherboard_price,
        "motherboard_descp": bid.motherboard_descp or "",
        "motherboard_descp_price": bid.motherboard_descp_price,
        "ram": bid.ram or "",
        "ram_price": bid.ram_price,
        "hdd": bid.hdd or "",
        "hdd_price": bid.hdd_price,
        "ssd1": bid.ssd1 or "",
        "ssd": bid.ssd1 or "",
        "ssd1_price": bid.ssd1_price,
        "ssd_price": bid.ssd1_price,
        "ssd2": bid.ssd2 or "",
        "ssd2_price": bid.ssd2_price,
        "graphics": bid.graphic_card or "",
        "graphic_card": bid.graphic_card or "",
        "graphics_price": bid.graphic_card_price,
        "graphic_card_price": bid.graphic_card_price,
        "gp": bid.graphics_description or "",
        "graphics_description": bid.graphics_description or "",
        "os": bid.os or "",
        "os_price": bid.os_price,
        "dvd": bid.dvd or "",
        "dvd_price": bid.dvd_price,
        "wifi": bid.wifi or "",
        "wifi_price": bid.wifi_price,
        "monitor": bid.monitor or "",
        "monitor_price": bid.monitor_price,
        "cabinet": bid.cabinet or "",
        "cabinet_price": bid.cabinet_price,
        "keyboard": bid.keyboard or "",
        "keyboard_price": bid.keyboard_price,
        "power_supply": bid.power_supply or "",
        "power_supply_price": bid.power_supply_price,
        "warranty": bid.warranty or "",
        "warranty_price": bid.warranty_price,
        "software1": bid.additional_software or "",
        "additional_software": bid.additional_software or "",
        "date": bid.date.isoformat() if bid.date else "",
        "epbg": bid.epbg,
        "freightInstallation": bid.freightInstallation or "Yes",
        "freightInstallation_price": bid.freightInstallation_price,
        "hddreturnable": bid.hdd_non_return or "No",
        "hddreturnable_price": bid.hdd_non_return_price,
        "hdd_non_return": bid.hdd_non_return or "No",
        "hdd_non_return_price": bid.hdd_non_return_price,
        "extra_requirements": bid.extra_requirements or "",
        "extra_requirements_price": bid.extra_requirements_price,
        "optional_ports": bid.optional_ports or "",
        "model_number": bid.model_number or "",
        "is_new_product": catalogue_specs.get("_source") == "workstation_bid",
        "analyser_note": bid.analyser_note or "",
        "analyser_username": bid.analyser_username or "",
        "analyser_display_name": bid.analyser_username or user_name,
        "admin_note": bid.admin_note or "",
        "admin_username": bid.admin_username or "",
        "total_price": bid.total_price or calculated_price,
        "final_amount": approved_price,
    }


def _apply_workstation_payload(bid, data):
    bid.bid_no = data.get("bid_no", bid.bid_no)
    bid.dept_name = data.get("dept_name", bid.dept_name)
    bid.organization = data.get("organization", bid.organization)
    bid.address = data.get("address", bid.address)
    bid.pincode = data.get("pincode", bid.pincode)
    bid.atc = data.get("atc", bid.atc)
    if data.get("qty"):
        bid.qty = int(data.get("qty"))
    bid.model_number = data.get("model_number") or data.get("model") or bid.model_number
    bid.processor = data.get("processor", bid.processor)
    bid.processor_price = safe_float(data.get("processor_price"), bid.processor_price)
    bid.pro_descp = data.get("pro_descp", bid.pro_descp)
    bid.pro_descp_price = safe_float(data.get("pro_descp_price"), bid.pro_descp_price)
    bid.motherboard = data.get("motherboard", bid.motherboard)
    bid.motherboard_price = safe_float(data.get("motherboard_price"), bid.motherboard_price)
    bid.motherboard_descp = data.get("motherboard_descp", bid.motherboard_descp)
    bid.motherboard_descp_price = safe_float(data.get("motherboard_descp_price"), bid.motherboard_descp_price)
    bid.ram = data.get("ram", bid.ram)
    bid.ram_price = safe_float(data.get("ram_price"), bid.ram_price)
    bid.hdd = data.get("hdd", bid.hdd)
    bid.hdd_price = safe_float(data.get("hdd_price"), bid.hdd_price)
    bid.ssd1 = data.get("ssd1") or data.get("ssd") or bid.ssd1
    bid.ssd1_price = safe_float(data.get("ssd1_price") or data.get("ssd_price"), bid.ssd1_price)
    bid.ssd2 = data.get("ssd2", bid.ssd2)
    bid.ssd2_price = safe_float(data.get("ssd2_price"), bid.ssd2_price)
    bid.graphic_card = data.get("graphic_card") or data.get("graphics") or bid.graphic_card
    bid.graphic_card_price = safe_float(data.get("graphic_card_price") or data.get("graphics_price"), bid.graphic_card_price)
    bid.graphics_description = data.get("graphics_description") or data.get("gp") or bid.graphics_description
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
    bid.power_supply = data.get("power_supply", bid.power_supply)
    bid.power_supply_price = safe_float(data.get("power_supply_price"), bid.power_supply_price)
    bid.warranty = data.get("warranty", bid.warranty)
    bid.warranty_price = safe_float(data.get("warranty_price"), bid.warranty_price)
    bid.additional_software = data.get("additional_software") or data.get("software1") or bid.additional_software
    if data.get("date"):
        bid.date = data.get("date")
    bid.epbg = safe_float(data.get("epbg"), bid.epbg)
    bid.freightInstallation = data.get("freightInstallation", bid.freightInstallation)
    bid.freightInstallation_price = safe_float(data.get("freightInstallation_price"), bid.freightInstallation_price)
    bid.hdd_non_return = data.get("hdd_non_return") or data.get("hddreturnable") or bid.hdd_non_return
    bid.hdd_non_return_price = safe_float(data.get("hdd_non_return_price") or data.get("hddreturnable_price"), bid.hdd_non_return_price)
    bid.extra_requirements = data.get("extra_requirements", bid.extra_requirements)
    bid.extra_requirements_price = safe_float(data.get("extra_requirements_price"), bid.extra_requirements_price)
    bid.optional_ports = data.get("optional_ports", bid.optional_ports) or ""
    bid.analyser_note = data.get("analyser_note") or data.get("remark") or bid.analyser_note


@csrf_exempt
@require_http_methods(["POST"])
def save_workstation_model_number(request, bid_id):
    try:
        bid = WorkstationBid.objects.get(id=bid_id)
        data = json.loads(request.body or "{}")
        model_number = _get_model_number_from_data(data)
        if not model_number:
            return JsonResponse({"error": "Model number required"}, status=400)

        model_number = model_number.strip().upper()
        # Create the catalogue entry from the analyser's current selections,
        # not from a potentially stale copy of the bid.
        _apply_workstation_payload(bid, data)
        catalogue_product = CatalogueProduct.objects.filter(model_no__iexact=model_number).first()
        catalogue_created = False
        if catalogue_product is None:
            storage = " + ".join(
                str(value).strip() for value in (bid.ssd1, bid.ssd2, bid.hdd)
                if str(value or "").strip()
            )
            extra_specs = {
                "_source": "workstation_bid",
                "Computer Type": "Workstation",
                "Processor": bid.processor or "",
                "Motherboard": bid.motherboard or "",
                "RAM": bid.ram or "",
                "Storage": storage,
                "Graphics Card": bid.graphic_card or "",
                "Power Supply": bid.power_supply or "",
                "Monitor": bid.monitor or "",
                "Cabinet": bid.cabinet or "",
                "Keyboard & Mouse": bid.keyboard or "",
                "Operating System": bid.os or "",
                "Warranty": bid.warranty or "",
            }
            catalogue_product = CatalogueProduct.objects.create(
                model_no=model_number,
                processor=bid.processor or "",
                ram=bid.ram or "",
                storage=storage,
                os=bid.os or "",
                category="Workstation",
                description=bid.pro_descp or "Workstation",
                extra_specs=extra_specs,
            )
            catalogue_created = True
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
            "product_id": catalogue_product.id if catalogue_product else None,
            "source": "catalogue" if catalogue_product else "bid",
            "catalogue_created": catalogue_created,
            "status": bid.status,
            "review_status": bid.review_status,
        }, status=200)
    except WorkstationBid.DoesNotExist:
        return JsonResponse({"error": "Bid not found"}, status=404)
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=400)


@csrf_exempt
@require_http_methods(["POST"])
def match_workstation_catalogue_models(request, bid_id):
    try:
        bid = WorkstationBid.objects.get(id=bid_id)
    except WorkstationBid.DoesNotExist:
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

    workstation_field_map = {
        "processor": "processor",
        "ram": "ram",
        "ssd": "ssd",
        "hdd": "hdd",
        "graphics": "graphics",
        "os": "os",
        "monitor": "monitor",
        "power_supply": "power_supply",
    }
    bid_specs["graphics"] = _value_from_body_or_bid(body, bid, "graphics", "graphic_card")
    bid_specs["power_supply"] = _value_from_body_or_bid(body, bid, "power_supply")

    results = []
    debug_all = []

    for product in _load_workstation_catalogue():
        matched_count = 0
        checked_count = 0
        total_score = 0
        details = []
        for bid_key, product_key in workstation_field_map.items():
            bid_value = bid_specs.get(bid_key, "")
            if _match_is_blank(bid_value):
                continue
            catalogue_value = product.get(product_key, "")
            matched, score = _workstation_catalogue_match_value(bid_value, catalogue_value, bid_key)
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
        is_perfect = checked_count >= 4 and matched_count == checked_count
        result = {
            "model_no": product["model_no"],
            "product_id": product["id"],
            "bid_id": None,
            "source": "workstation_excel",
            "category": product["category"],
            "match_count": matched_count,
            "total_checked": checked_count,
            "total_score": round(total_score, 2),
            "is_perfect": is_perfect,
            "debug_details": details,
        }
        results.append(result)
        debug_all.append(result)

    for product in CatalogueProduct.objects.filter(category__icontains="workstation"):
        matched_count = 0
        checked_count = 0
        total_score = 0
        details = []
        for bid_key, catalogue_keys in _CATALOGUE_FIELD_MAP.items():
            bid_value = bid_specs.get(bid_key, "")
            if _match_is_blank(bid_value):
                continue
            matched, best_key, best_value, best_score = _best_catalogue_match(bid_key, bid_value, product, catalogue_keys)
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

    other_bids_qs = WorkstationBid.objects.exclude(id=bid.id).exclude(model_number__isnull=True).exclude(model_number="")
    for other_bid in other_bids_qs:
        matched_count = 0
        checked_count = 0
        total_score = 0
        details = []
        for bid_key in _CATALOGUE_FIELD_MAP.keys():
            bid_value = bid_specs.get(bid_key, "")
            if _match_is_blank(bid_value):
                continue
            matched, best_key, best_value, best_score = _best_bid_match(bid_key, bid_value, other_bid)
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

    perfect_results = [result for result in results if result["is_perfect"]]
    if not perfect_results:
        debug_all.sort(key=lambda item: (-item["match_count"], -item["total_score"], item["model_no"]))
        return JsonResponse({
            "match": None,
            "matches": [],
            "total_found": 0,
            "has_perfect_match": False,
            "message": "No exact matching model was found.",
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
        "message": "Exact matching model found.",
        "bid_specs_used": bid_specs,
    }, status=200)


@require_http_methods(["GET"])
def list_workstation_catalogue_products(request):
    search = (request.GET.get("search") or "").strip().lower()
    products = _load_workstation_catalogue()
    known_models = {product["model_no"].strip().lower() for product in products}
    for catalogue_product in CatalogueProduct.objects.filter(category__icontains="workstation").order_by("-created_at"):
        model_key = (catalogue_product.model_no or "").strip().lower()
        if not model_key or model_key in known_models:
            continue
        extra_specs = _catalogue_extra_specs(catalogue_product)
        product = {
            "id": f"catalogue-{catalogue_product.id}",
            "catalogue_id": catalogue_product.id,
            "model_no": catalogue_product.model_no or "",
            "category": catalogue_product.category or "Workstation",
            "processor": catalogue_product.processor or extra_specs.get("Processor", ""),
            "motherboard": extra_specs.get("Motherboard", ""),
            "ram": catalogue_product.ram or extra_specs.get("RAM", ""),
            "storage": catalogue_product.storage or extra_specs.get("Storage", ""),
            "ssd": extra_specs.get("SSD", ""),
            "hdd": extra_specs.get("HDD", ""),
            "graphics": extra_specs.get("Graphics Card", ""),
            "os": catalogue_product.os or extra_specs.get("Operating System", ""),
            "monitor": extra_specs.get("Monitor", ""),
            "power_supply": extra_specs.get("Power Supply", ""),
            "description": catalogue_product.description or "Workstation",
            "extra_specs": extra_specs,
            "source": "catalogue",
        }
        products.append(product)
        known_models.add(model_key)
    if search:
        products = [
            product for product in products
            if search in product["model_no"].lower() or search in product["description"].lower()
        ]
    return JsonResponse(products, safe=False, status=200)


@require_http_methods(["GET"])
def list_workstation_bids(request):
    try:
        status_filter = request.GET.get("status", "pending")
        role = request.GET.get("role", "analyser")
        if role == "admin":
            db_status = {"pending": "reviewed", "re-analyze": "re-analyze", "approved": "approved"}.get(status_filter, "reviewed")
            bids = WorkstationBid.objects.filter(status="complete", review_status=db_status).order_by("-updated_at")
        elif status_filter == "reviewed":
            bids = WorkstationBid.objects.filter(status="complete", review_status__in=["reviewed", "approved"]).order_by("-created_at")
        else:
            bids = WorkstationBid.objects.filter(status="complete", review_status=status_filter).order_by("-created_at")
        return JsonResponse([_workstation_bid_data(bid, request, status_filter) for bid in bids], safe=False)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


@csrf_exempt
@require_http_methods(["GET"])
def get_workstation_bid(request, bid_id):
    try:
        return JsonResponse(_workstation_bid_data(WorkstationBid.objects.get(id=bid_id), request))
    except WorkstationBid.DoesNotExist:
        return JsonResponse({"error": "Bid not found"}, status=404)


@csrf_exempt
@require_http_methods(["DELETE"])
def delete_workstation_bid(request, bid_id):
    bid = WorkstationBid.objects.filter(id=bid_id).first()
    if not bid:
        return JsonResponse({"error": "Bid not found"}, status=404)
    delete_bid_with_related_data(bid, "workstation")
    return JsonResponse({"message": "Bid deleted successfully"})


@csrf_exempt
@require_http_methods(["DELETE"])
def bulk_delete_workstation_bids(request):
    try:
        raw_ids = json.loads(request.body or "{}").get("ids", [])
        if not isinstance(raw_ids, list):
            return JsonResponse({"error": "ids must be a list."}, status=400)
        bid_ids = []
        for value in raw_ids:
            try:
                bid_ids.append(int(value))
            except (TypeError, ValueError):
                continue
        bid_ids = list(dict.fromkeys(bid_ids))
        if not bid_ids:
            return JsonResponse({"error": "Select at least one bid."}, status=400)
        rows = list(WorkstationBid.objects.filter(id__in=bid_ids))
        deleted_ids = [bid.id for bid in rows]
        for bid in rows:
            delete_bid_with_related_data(bid, "workstation")
        return JsonResponse({"deleted": len(deleted_ids), "deleted_ids": deleted_ids})
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=400)


@csrf_exempt
@require_http_methods(["PATCH"])
def review_workstation_bid(request, bid_id):
    try:
        bid = WorkstationBid.objects.get(id=bid_id)
        data = json.loads(request.body)
        _apply_workstation_payload(bid, data)
        analyser_username = (data.get("analyser_username") or data.get("username") or "").strip()
        if analyser_username:
            bid.analyser_username = analyser_username
        bid.status = "complete"
        bid.review_status = "pending"
        bid.save()
        from .GemAssignments import complete_user_assignment_for_bid
        complete_user_assignment_for_bid(bid.bid_no, bid.user)
        return JsonResponse({"success": True, "bid_id": bid.id, "review_status": bid.review_status})
    except WorkstationBid.DoesNotExist:
        return JsonResponse({"error": "Bid not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


@csrf_exempt
@require_http_methods(["PATCH"])
def admin_review_workstation_bid(request, bid_id):
    try:
        bid = WorkstationBid.objects.get(id=bid_id)
        data = request.POST if request.content_type and request.content_type.startswith("multipart/form-data") else json.loads(request.body)
        action = data.get("status", "")
        if action not in ("approved", "re-analyze"):
            return JsonResponse({"error": "Invalid status."}, status=400)
        _apply_workstation_payload(bid, data)
        price_fields = (
            "processor_price", "pro_descp_price", "motherboard_price",
            "motherboard_descp_price", "ram_price", "ssd1_price", "ssd2_price",
            "hdd_price", "graphic_card_price", "cabinet_price", "keyboard_price",
            "power_supply_price", "monitor_price", "os_price", "wifi_price",
            "dvd_price", "warranty_price", "freightInstallation_price",
            "hdd_non_return_price", "extra_requirements_price",
        )
        calculated_price = sum(float(getattr(bid, field, 0) or 0) for field in price_fields)
        requested_total = safe_float(data.get("total_price"), 0)
        bid.total_price = requested_total if requested_total > 0 else calculated_price
        # Admin's approved price is the final workstation amount. Do not let a
        # stale calculated final_amount from the list payload override it.
        bid.final_amount = bid.total_price
        bid.review_status = action
        bid.admin_note = data.get("admin_note", "").strip()
        bid.admin_username = data.get("admin_username", "").strip()
        bid.save()
        return JsonResponse({"success": True, "bid_id": bid.id, "review_status": bid.review_status})
    except WorkstationBid.DoesNotExist:
        return JsonResponse({"error": "Bid not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


@csrf_exempt
@require_http_methods(["POST"])
def update_workstation_docs(request, bid_id):
    try:
        bid = WorkstationBid.objects.get(id=bid_id)
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
    except WorkstationBid.DoesNotExist:
        return JsonResponse({"error": "Bid not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


def _ws_text_width(text, fontsize, bold=False):
    try:
        return fitz.Font("hebo" if bold else "helv").text_length(text, fontsize=fontsize)
    except Exception:
        return len(text) * fontsize * 0.55


def _ws_draw_inline_paragraph(page, x, y, line_height, max_width, segments, fontsize=11):
    # Same helper AIO's document generator uses for a paragraph that mixes
    # bold and regular runs on the same wrapped lines (plain insert_textbox
    # can't vary weight mid-paragraph).
    word_tokens = []
    for text_chunk, is_bold in segments:
        for w in text_chunk.split(" "):
            if w:
                word_tokens.append((w, is_bold))
    current_line = []
    current_width = 0.0
    cur_y = y

    def render_line(line_tokens, base_y):
        cx = x
        for word, bold in line_tokens:
            page.insert_text((cx, base_y), word, fontsize=fontsize, fontname="hebo" if bold else "helv", color=(0, 0, 0))
            cx += _ws_text_width(word + "  ", fontsize, bold)

    for word, is_bold in word_tokens:
        w_width = _ws_text_width(word + "  ", fontsize, is_bold)
        if current_line and (current_width + w_width) > max_width:
            render_line(current_line, cur_y)
            cur_y += line_height
            current_line = [(word, is_bold)]
            current_width = w_width
        else:
            current_line.append((word, is_bold))
            current_width += w_width
    if current_line:
        render_line(current_line, cur_y)
    return cur_y


@csrf_exempt
@require_http_methods(["POST"])
def generate_workstation_certificates(request, bid_id):
    if not fitz:
        return JsonResponse({"error": "PyMuPDF is not installed."}, status=500)
    try:
        bid = WorkstationBid.objects.get(id=bid_id)
        body = json.loads(request.body or "{}")
        doc_type = body.get("doc_type", "")

        cert_page_ranges = {
            "manufacturer_auth": (2, 4),
            "make_in_india": (5, 5),
            "warranty": (6, 6),
            "bidder_financial": (7, 7),
            "non_obsolete": (8, 8),
            "data_sheet": (31, 32),
            "non_malicious": (16, 16),
            "non_return_hdd": (17, 17),
            "technical_compliance": (18, 18),
            "non_blacklisting": (20, 20),
            "service_support": (25, 30),
            "ipv6": (21, 21),
            "preloaded_os": (22, 22),
        }
        static_documents = {
            "experience_certificate": "workstation_experience_certificate.pdf",
            # Past Performance intentionally points at the same file as
            # Experience Certificate per explicit request.
            "past_performance": "workstation_experience_certificate.pdf",
            "oem_annual_turnover": "oem_annual_turnover.pdf",
            "atc_acceptance_letter": "atc_acceptance_letter.pdf",
        }
        def number_pages_from_one(document):
            for local_number, page in enumerate(document, 1):
                for block in page.get_text("dict").get("blocks", []):
                    if block.get("type") != 0:
                        continue
                    for line in block.get("lines", []):
                        text = " ".join(span.get("text", "") for span in line.get("spans", [])).strip()
                        if re.search(r"\bGST(?:IN)?(?:\s+(?:Number|No\.?))?\b", text, re.IGNORECASE):
                            page.add_redact_annot(fitz.Rect(line["bbox"]) + (-3, -2, 3, 2), fill=(1, 1, 1))
                            continue
                        if line["bbox"][1] > page.rect.height - 60 and re.fullmatch(r"(?:Page\s*)?\d+", text, re.IGNORECASE):
                            page.add_redact_annot(fitz.Rect(line["bbox"]) + (-3, -2, 3, 2), fill=(1, 1, 1))
                page.apply_redactions(images=0, graphics=0)
                page.insert_textbox(
                    fitz.Rect(page.rect.width - 60, page.rect.height - 28, page.rect.width - 18, page.rect.height - 8),
                    str(local_number), fontsize=9, fontname="hebo", align=2,
                )
        approved_bundles = {"approved_atc_documents", "approved_price_paper", "approved_all_documents"}
        if doc_type in approved_bundles and bid.review_status != "approved":
            return JsonResponse({"error": "Only approved bids can be downloaded"}, status=403)

        out_dir = os.path.join(settings.MEDIA_ROOT, "generated_docs")
        os.makedirs(out_dir, exist_ok=True)

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
            page.add_redact_annot(fitz.Rect(65, 96, 535, 235), fill=(1, 1, 1))
            page.apply_redactions(images=0, graphics=0)

            bid_date = str(bid.date or "")
            if re.fullmatch(r"\d{4}-\d{2}-\d{2}", bid_date):
                year, month, day = bid_date.split("-")
                bid_date = f"{day}-{month}-{year}"

            address = re.sub(
                r"\bGST(?:IN)?(?:\s+(?:Number|No\.?))?\s*:?\s*[A-Z0-9-]+\s*[,;]?",
                "",
                str(bid.address or "").strip(),
                flags=re.IGNORECASE,
            ).strip(" ,;-")
            pincode = str(bid.pincode or "").strip()
            if pincode and pincode not in address:
                address = f"{address} - {pincode}" if address else pincode

            recipient_lines = [
                "To,",
                str(bid.dept_name or "").strip(),
                str(bid.organization or "").strip(),
            ]
            recipient_lines.extend(
                line.strip() for line in re.split(r"[\r\n]+", address) if line.strip()
            )
            recipient_lines.extend([
                "",
                f"Bid No:- {str(bid.bid_no or '').strip()}            Dated:- {bid_date}",
            ])
            page.insert_textbox(
                fitz.Rect(72, 102, 525, 235),
                "\n".join(line for line in recipient_lines if line is not None),
                fontsize=10.5,
                fontname="hebo",
                lineheight=1.28,
                align=0,
            )

            filename = f"workstation_{bid.id}_atc_acceptance_letter.pdf"
            number_pages_from_one(document)
            document.save(os.path.join(out_dir, filename))
            document.close()
            return JsonResponse({
                "success": True,
                "pdf_url": request.build_absolute_uri(f"/media/generated_docs/{filename}")+f"?v={int(time.time())}",
            })

        if doc_type in static_documents:
            source_path = os.path.join(settings.MEDIA_ROOT, "templates", "static_documents", static_documents[doc_type])
            if not os.path.exists(source_path):
                return JsonResponse({"error": f"{doc_type} template not found"}, status=404)
            filename = f"workstation_{bid.id}_{doc_type}.pdf"
            output_path = os.path.join(out_dir, filename)
            static_doc = fitz.open(source_path)
            number_pages_from_one(static_doc)
            static_doc.save(output_path)
            static_doc.close()
            return JsonResponse({"success": True, "pdf_url": request.build_absolute_uri(f"/media/generated_docs/{filename}")+f"?v={int(time.time())}"})

        if doc_type == "approved_atc_documents":
            if not bid.atc_special_document:
                return JsonResponse({"error": "ATC document is not available"}, status=404)
            return JsonResponse({"success": True, "pdf_url": request.build_absolute_uri(bid.atc_special_document.url)})

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
            filename = f"workstation_{bid.id}_price_approved.pdf"
            number_pages_from_one(price_doc)
            price_doc.save(os.path.join(out_dir, filename))
            price_doc.close()
            return JsonResponse({
                "success": True,
                "pdf_url": request.build_absolute_uri(f"/media/generated_docs/{filename}")+f"?v={int(time.time())}",
            })

        if doc_type == "approved_all_documents":
            # Same index+bundle approach as AIO's generate_aio_documents
            # (_build_index_and_bundle) — a leading "Index of all approved
            # documents" page (S.No./Documents/Page From/Page To), built from
            # freshly (re)generated child certificates rather than whatever
            # stale copies happened to already sit in generated_docs/.
            doc_labels = {
                "manufacturer_auth": "MAF CERTIFICATE",
                "experience_certificate": "EXPERIENCE CERTIFICATE",
                "past_performance": "PAST PERFORMANCE",
                "oem_annual_turnover": "OEM ANNUAL TURNOVER",
                "atc_acceptance_letter": "ATC ACCEPTANCE LETTER",
                "make_in_india": "MAKE IN INDIA",
                "warranty": "WARRANTY",
                "bidder_financial": "BIDDER FINANCIAL UNDERSTANDINGS",
                "non_obsolete": "NON OBSOLETE",
                "data_sheet": "DATA SHEET",
                "non_malicious": "NON MALICIOUS CODE",
                "non_return_hdd": "NON RETURN OF HARD DISK",
                "technical_compliance": "TECHNICAL COMPLIANCE",
                "non_blacklisting": "NON BLACKLISTING",
                "service_support": "SERVICE SUPPORT",
                "ipv6": "IPV6",
                "preloaded_os": "PRELOADED OPERATING SYSTEM",
            }
            factory = RequestFactory()

            def _gen_child(child_id):
                child_request = factory.post(
                    f"/api/workstation-bids/{bid.id}/generate-docs/",
                    data=json.dumps({"doc_type": child_id}),
                    content_type="application/json",
                    HTTP_HOST=request.get_host(),
                )
                child_response = generate_workstation_certificates(child_request, bid.id)
                if child_response.status_code != 200:
                    return None
                child_path = os.path.join(out_dir, f"workstation_{bid.id}_{child_id}.pdf")
                return fitz.open(child_path) if os.path.exists(child_path) else None

            non_atc_ids = ["manufacturer_auth", "experience_certificate", "past_performance", "oem_annual_turnover", "make_in_india", "atc_acceptance_letter"]
            atc_ids = [key for key in cert_page_ranges if key not in non_atc_ids]
            selected_atc_ids = [cid for cid in (bid.selected_general_docs or []) if cid in atc_ids]
            selected_atc_ids = list(dict.fromkeys(selected_atc_ids))

            def _gen_group(child_ids):
                docs = []
                for child_id in child_ids:
                    child_doc = _gen_child(child_id)
                    if child_doc is not None:
                        docs.append((doc_labels.get(child_id, child_id.upper()), child_doc))
                return docs

            groups = []
            non_atc_generated = _gen_group(non_atc_ids)
            if non_atc_generated:
                groups.append(("NON-ATC DOCUMENTS", non_atc_generated))

            atc_generated = _gen_group(selected_atc_ids)
            if bid.atc_special_document and os.path.exists(bid.atc_special_document.path):
                try:
                    child_doc = fitz.open(bid.atc_special_document.path)
                    number_pages_from_one(child_doc)
                    atc_generated.append(("ATC SPECIAL DOCUMENT", child_doc))
                except Exception:
                    pass
            if atc_generated:
                groups.append(("ATC DOCUMENTS", atc_generated))

            if not groups:
                return JsonResponse({"error": "No approved documents are available"}, status=404)

            index_rows, page_number = [], 1
            for section, docs in groups:
                rows = []
                for label, child_doc in docs:
                    start = page_number
                    end = start + len(child_doc) - 1
                    rows.append((label, start, end))
                    page_number = end + 1
                index_rows.append((section, rows))

            bundle = fitz.open()
            index_page = bundle.new_page(width=595, height=842)
            index_page.insert_textbox(fitz.Rect(45, 60, 550, 100), "Index of all approved documents", fontsize=17, fontname="hebo", align=1)
            index_page.insert_text((48, 127), f"Bid Number: {bid.bid_no}", fontsize=12, fontname="hebo")
            columns, y, row_height = [48, 92, 380, 462, 547], 152, 32
            headings = ("S.NO.", "DOCUMENTS", "PAGE FROM", "PAGE TO")
            for col, heading in enumerate(headings):
                rect = fitz.Rect(columns[col], y, columns[col + 1], y + row_height)
                index_page.draw_rect(rect, color=(0.45, 0.45, 0.45), fill=(0.92, 0.94, 0.96), width=0.6)
                index_page.insert_textbox(rect + (4, 9, -4, -3), heading, fontsize=9.2, fontname="hebo", align=1 if col != 1 else 0)
            y += row_height

            serial = 1
            for section, rows in index_rows:
                section_rect = fitz.Rect(columns[0], y, columns[-1], y + row_height)
                index_page.draw_rect(section_rect, color=(0.35, 0.35, 0.35), fill=(0.85, 0.88, 0.92), width=0.7)
                index_page.insert_textbox(section_rect + (5, 9, -5, -3), section, fontsize=9.5, fontname="hebo", align=0)
                y += row_height
                for label, start, end in rows:
                    values = (str(serial), label, str(start), str(end))
                    for col, val in enumerate(values):
                        rect = fitz.Rect(columns[col], y, columns[col + 1], y + row_height)
                        index_page.draw_rect(rect, color=(0.55, 0.55, 0.55), width=0.5)
                        index_page.insert_textbox(rect + (4, 9, -4, -3), val, fontsize=9.2, fontname="hebo", align=1 if col != 1 else 0)
                    serial += 1
                    y += row_height

            for _, docs in groups:
                for _, child_doc in docs:
                    bundle.insert_pdf(child_doc)
                    child_doc.close()

            for pidx in range(1, len(bundle)):
                pg = bundle[pidx]
                for block in pg.get_text("dict").get("blocks", []):
                    if block.get("type") != 0:
                        continue
                    for line in block.get("lines", []):
                        text = " ".join(s.get("text", "") for s in line.get("spans", [])).strip()
                        if line["bbox"][1] > pg.rect.height - 60 and re.fullmatch(r"(?:Page\s*)?\d+", text, re.IGNORECASE):
                            pg.add_redact_annot(fitz.Rect(line["bbox"]) + (-3, -2, 3, 2), fill=(1, 1, 1))
                pg.apply_redactions()
                pg.insert_textbox(fitz.Rect(pg.rect.width - 60, pg.rect.height - 28, pg.rect.width - 18, pg.rect.height - 8), str(pidx), fontsize=9, fontname="hebo", align=2)

            filename = f"workstation_{bid.id}_approved_all_documents.pdf"
            bundle.save(os.path.join(out_dir, filename))
            bundle.close()
            return JsonResponse({"success": True, "pdf_url": request.build_absolute_uri(f"/media/generated_docs/{filename}")+f"?v={int(time.time())}"})

        if doc_type not in cert_page_ranges:
            return JsonResponse({"error": f"Invalid doc_type: '{doc_type}'"}, status=400)

        uses_workstation_spec_template = doc_type in {"data_sheet", "technical_compliance"}
        template_name = "workstation.pdf" if uses_workstation_spec_template else "documents.pdf"
        template_path = os.path.join(settings.MEDIA_ROOT, "templates", template_name)
        if not os.path.exists(template_path):
            template_path = os.path.join("media", "templates", template_name)
        if not os.path.exists(template_path):
            return JsonResponse({"error": "Template PDF not found"}, status=404)

        dept_name = (bid.dept_name or "").strip()
        organization = (bid.organization or "").strip()
        bid_no = (bid.bid_no or "").strip()
        address = (bid.address or "").strip()
        address = re.sub(
            r"\bGST(?:IN)?(?:\s+(?:Number|No\.?))?\s*:?\s*[A-Z0-9-]+\s*[,;]?",
            "",
            address,
            flags=re.IGNORECASE,
        ).strip(" ,;-")
        pincode = (bid.pincode or "").strip()
        full_address = f"{address} - {pincode}" if pincode else address
        service_recipient = [
            re.sub(r"\s+", " ", value).strip().upper()
            for value in (dept_name, organization, full_address)
        ]
        model_number = (body.get("model_number") or body.get("model") or bid.model_number or "").strip()
        warranty_text = str(body.get("warranty") or bid.warranty or "").strip()
        local_content = str(body.get("local_content") or body.get("localContent") or "").strip()
        if local_content and not local_content.endswith("%"):
            local_content = f"{local_content}%"

        bid_date_formatted = ""
        if bid.date and str(bid.date) != "2000-01-01":
            try:
                bid_date_formatted = datetime.strptime(str(bid.date), "%Y-%m-%d").strftime("%d-%m-%Y")
            except Exception:
                bid_date_formatted = str(bid.date)
        elif bid.created_at:
            try:
                bid_date_formatted = bid.created_at.strftime("%d-%m-%Y")
            except Exception:
                bid_date_formatted = str(bid.created_at.date())

        all_gem_numbers = set()
        all_dates = set()

        def clean_text(value):
            return str(value or "").strip()

        def text_width(text, fontsize, bold=False):
            try:
                return fitz.Font("hebo" if bold else "helv").text_length(str(text or ""), fontsize=fontsize)
            except Exception:
                return len(str(text or "")) * fontsize * 0.55

        def draw_inline_paragraph(page, x, y, line_height, max_width, segments, fontsize=11):
            tokens = []
            for text_chunk, is_bold in segments:
                for word in str(text_chunk or "").split(" "):
                    if word:
                        tokens.append((word, is_bold))

            line = []
            line_width = 0
            cur_y = y

            def render_line(items, base_y):
                cur_x = x
                for word, bold in items:
                    page.insert_text(
                        (cur_x, base_y),
                        word,
                        fontsize=fontsize,
                        fontname="hebo" if bold else "helv",
                        color=(0, 0, 0),
                    )
                    cur_x += text_width(word + "  ", fontsize, bold)

            for word, bold in tokens:
                width = text_width(word + "  ", fontsize, bold)
                if line and line_width + width > max_width:
                    render_line(line, cur_y)
                    cur_y += line_height
                    line = [(word, bold)]
                    line_width = width
                else:
                    line.append((word, bold))
                    line_width += width

            if line:
                render_line(line, cur_y)

        def draw_centered_heading(page, text, y, fontsize=16, color=(0, 0, 0.6)):
            width = text_width(text, fontsize, True)
            x = (page.rect.width - width) / 2
            page.insert_text((x, y), text, fontsize=fontsize, fontname="hebo", color=color)
            page.draw_line((x, y + 3), (x + width, y + 3), color=color, width=1.2)

        def normalize_warranty(value):
            match = re.search(r"\d+", str(value or ""))
            if not match:
                return str(value or "").strip()
            years = match.group(0)
            return f"{years} {'year' if years == '1' else 'years'}"

        def ram_type(value):
            match = re.search(r"\bDDR\s*([345])\b", str(value or ""), re.IGNORECASE)
            return f"DDR{match.group(1)}" if match else clean_text(value)

        def ram_size(value):
            match = re.search(r"\b(\d+)\s*GB\b", str(value or ""), re.IGNORECASE)
            return match.group(1) if match else clean_text(value)

        def yes_no(value):
            text = clean_text(value)
            if not text or re.search(r"\b(no|none|not required|n/a|0)\b", text, re.IGNORECASE):
                return "No"
            return "Yes"

        def graphics_type(value):
            text = clean_text(value)
            if not text or re.search(r"\b(no|none|integrated)\b", text, re.IGNORECASE):
                return "Integrated"
            return "Dedicated"

        def keyboard_connectivity(value):
            text = clean_text(value)
            if re.search(r"wireless", text, re.IGNORECASE):
                return "Wireless"
            if re.search(r"wired|usb", text, re.IGNORECASE):
                return "Wired"
            return text

        specs = {
            "model_number": model_number,
            "brand": "acxxel",
            "computer_type": "Workstation",
            "processor": clean_text(bid.processor),
            "motherboard": clean_text(bid.motherboard or bid.motherboard_descp),
            "pcie_x1": "",
            "pcie_x4": "",
            "pcie_x16": "",
            "m2_ssd": clean_text(bid.ssd1 or bid.ssd2),
            "m2_wifi": clean_text(bid.wifi),
            "graphics_type": graphics_type(bid.graphic_card),
            "graphics_model": clean_text(bid.graphic_card or bid.graphics_description),
            "graphics_memory": clean_text(bid.graphics_description or bid.graphic_card),
            "graphics_description": clean_text(bid.graphics_description),
            "usb2": "",
            "usb3": "",
            "vga": "",
            "hdmi": "",
            "os": clean_text(bid.os),
            "ram_type": ram_type(bid.ram),
            # Was clean_text(bid.ram) — the full descriptive RAM string (e.g.
            # "32GB Registered ECC") crammed into the Technical Compliance
            # template's narrow numeric-only "RAM Size (GB)" cell, forcing it
            # onto extra wrapped lines that bled past the row's fixed height
            # into the row above/below. ram_size() extracts just the "32".
            "ram_size": ram_size(bid.ram),
            "ram_size_gb": ram_size(bid.ram),
            "hdd_capacity": clean_text(bid.hdd),
            "ssd_capacity": clean_text(bid.ssd1),
            "ssd2": clean_text(bid.ssd2),
            "storage_type": "HDD + SSD" if bid.hdd and (bid.ssd1 or bid.ssd2) else ("SSD" if bid.ssd1 or bid.ssd2 else "HDD"),
            "cabinet": clean_text(bid.cabinet),
            "dvd": yes_no(bid.dvd),
            "wifi": clean_text(bid.wifi),
            "monitor_available": yes_no(bid.monitor),
            "monitor": clean_text(bid.monitor),
            "speaker": "Yes",
            "keyboard": clean_text(bid.keyboard),
            "mouse_connectivity": keyboard_connectivity(bid.keyboard),
            "keyboard_connectivity": keyboard_connectivity(bid.keyboard),
            "keyboard_type": clean_text(bid.keyboard),
            "power_supply": clean_text(bid.power_supply),
            "warranty": clean_text(bid.warranty),
            "warranty_text": normalize_warranty(warranty_text),
            "optional_ports": clean_text(bid.optional_ports),
            "extra_requirements": clean_text(bid.extra_requirements),
            "description": " ".join(
                value for value in [
                    model_number,
                    clean_text(bid.processor),
                    clean_text(bid.ram),
                    clean_text(bid.hdd),
                    clean_text(bid.ssd1),
                    clean_text(bid.graphic_card),
                    clean_text(bid.os),
                    clean_text(bid.warranty),
                ] if value
            ),
        }

        def redact_and_write(page, rect, text, fontsize=10, bold=False, align=0):
            text = clean_text(text)
            if not text:
                return
            area = fitz.Rect(rect)
            page.add_redact_annot(area, fill=(1, 1, 1))
            page.apply_redactions(images=0, graphics=0)
            page.insert_textbox(
                fitz.Rect(area.x0 + 3, area.y0 + 2, area.x1 - 3, area.y1 - 2),
                text,
                fontsize=fontsize,
                fontname="hebo" if bold else "helv",
                color=(0, 0, 0),
                align=align,
            )

        def replace_exact(page, old, new, fontsize=10):
            if not old or new is None:
                return False
            areas = page.search_for(old)
            if not areas:
                return False
            for area in areas:
                page.add_redact_annot(fitz.Rect(area.x0 - 2, area.y0 - 2, area.x1 + 90, area.y1 + 3), fill=(1, 1, 1))
            page.apply_redactions(images=0, graphics=0)
            if str(new):
                for area in areas:
                    page.insert_text((area.x0, area.y1 - 2), str(new), fontsize=fontsize, fontname="hebo", color=(0, 0, 0))
            return True

        def remove_urls_and_config_links(page):
            url_patterns = [
                r"https?://[^\s]+",
                r"www\.[^\s]+",
                r"[a-zA-Z0-9-]+\.html[^\s]*",
                r"[a-zA-Z0-9-]+#variant_id=[^\s]+",
                r"mkp\.gem\.gov\.in[^\s]*",
                r"\S+\.in/\S+",
                r"\S+\.com/\S+",
            ]
            page_text = page.get_text("text")
            for pattern in url_patterns:
                for match in re.findall(pattern, page_text, re.IGNORECASE):
                    replace_exact(page, match, "", fontsize=8)

            lines = []
            for block in page.get_text("dict").get("blocks", []):
                if block.get("type") != 0:
                    continue
                for line in block.get("lines", []):
                    text = " ".join(span.get("text", "") for span in line.get("spans", [])).strip()
                    if text:
                        lines.append((fitz.Rect(line["bbox"]), text))
            lines.sort(key=lambda item: item[0].y0)
            for index, (bbox, text) in enumerate(lines):
                if "config link" not in text.lower():
                    continue
                erase_rects = [bbox]
                for next_bbox, next_text in lines[index + 1:index + 8]:
                    low = next_text.lower()
                    if any(token in low for token in ["http", "www", ".com", ".in", ".html", "variant_id", "mkp"]):
                        erase_rects.append(next_bbox)
                    else:
                        break
                for rect in erase_rects:
                    page.add_redact_annot(rect, fill=(1, 1, 1))
                page.apply_redactions(images=0, graphics=0)
                break

        def remove_tender_no_date_lines(page):
            for block in page.get_text("dict").get("blocks", []):
                if block.get("type") != 0:
                    continue
                for line in block.get("lines", []):
                    text = " ".join(span.get("text", "") for span in line.get("spans", [])).strip()
                    if (
                        re.search(r"(Tender|Bid)\s*No", text, re.IGNORECASE)
                        or re.search(r"GEM/\d{4}/[A-Z]/\d+", text)
                        or re.search(r"\bDated\s*:?\s*\d{2}-\d{2}-\d{4}", text, re.IGNORECASE)
                    ):
                        bbox = fitz.Rect(line["bbox"])
                        page.add_redact_annot(fitz.Rect(bbox.x0 - 3, bbox.y0 - 3, page.rect.width - 36, bbox.y1 + 4), fill=(1, 1, 1))
            page.apply_redactions(images=0, graphics=0)

        def replace_service_support_contact(page):
            replacement = "Madhuri Pal - 9519598884"
            matches = page.search_for("Saurabh Singh - 9918200467")
            if not matches:
                return
            for area in matches:
                page.add_redact_annot(
                    fitz.Rect(area.x0 - 1, area.y0 - 1, area.x1 + 1, area.y1 + 1),
                    fill=False,
                )
            page.apply_redactions(images=0, graphics=0)
            for area in matches:
                page.insert_text(
                    (area.x0, area.y1 - 1),
                    replacement,
                    fontsize=10.2,
                    fontname="hebo",
                    color=(0.12, 0.11, 0.28),
                )

        def replace_service_support_heading(page):
            areas = page.search_for("ACXXEL SERVICE PARTNERS")
            if not areas:
                return
            drawings = page.get_drawings()
            header_rects = []
            for area in areas:
                candidates = []
                center = (area.x0 + area.x1) / 2, (area.y0 + area.y1) / 2
                for drawing in drawings:
                    rect = fitz.Rect(drawing["rect"])
                    if rect.contains(center) and rect.width > area.width + 50 and rect.height > area.height + 5:
                        candidates.append(rect)
                header_rects.append(min(candidates, key=lambda rect: rect.get_area()) if candidates else None)
            for area, header_rect in zip(areas, header_rects):
                page.add_redact_annot(
                    fitz.Rect(area.x0 - 2, area.y0 - 1, area.x1 + 2, area.y1 - 0.8),
                    fill=(1, 1, 0),
                )
            page.apply_redactions(images=0, graphics=0)
            for area, header_rect in zip(areas, header_rects):
                page.insert_textbox(
                    fitz.Rect(92, area.y0 - 1, page.rect.width - 92, area.y1 + 6),
                    "List Of acxxel Service Center In Major City",
                    fontsize=11,
                    fontname="hebo",
                    color=(0, 0, 0),
                    align=1,
                )
                if header_rect:
                    page.draw_rect(header_rect, color=(0, 0, 0), width=0.9, overlay=True)

        def add_service_support_table_note(page):
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

        def remove_to_whomsoever_line(page):
            lines = []
            for block in page.get_text("dict").get("blocks", []):
                if block.get("type") != 0:
                    continue
                for line in block.get("lines", []):
                    text = " ".join(span.get("text", "") for span in line.get("spans", [])).strip()
                    if text:
                        lines.append((fitz.Rect(line["bbox"]), text))
            lines.sort(key=lambda item: item[0].y0)

            heading = None
            next_line = None
            has_to = False
            for index, (bbox, text) in enumerate(lines):
                normalized = re.sub(r"[^A-Za-z\s]", " ", text).upper()
                normalized = re.sub(r"\s+", " ", normalized).strip()
                if heading is None and re.search(r"TO\s+WHOM\S*\s+IT\s+MAY\s+CONCERN", normalized):
                    heading = bbox
                    if index + 1 < len(lines):
                        next_line = lines[index + 1][0]
                if text.strip().rstrip(",").upper() == "TO":
                    has_to = True

            if heading is None:
                return
            page.add_redact_annot(fitz.Rect(heading.x0 - 4, heading.y0 - 3, page.rect.width - 36, heading.y1 + 3), fill=(1, 1, 1))
            page.apply_redactions(images=0, graphics=0)
            if has_to:
                return

            x = next_line.x0 if next_line else 48
            y = heading.y0
            for value in ["To,", *service_recipient]:
                if value:
                    page.insert_text((x, y), value, fontsize=11 if value == "To," else 12, fontname="hebo", color=(0, 0, 0))
                    y += 14

        def fix_service_support_page(page):
            remove_to_whomsoever_line(page)
            remove_tender_no_date_lines(page)
            replace_service_support_contact(page)
            replace_service_support_heading(page)

            # Remove the leftover heading if template spelling varies.
            for block in page.get_text("dict").get("blocks", []):
                if block.get("type") != 0:
                    continue
                for line in block.get("lines", []):
                    text = " ".join(span.get("text", "") for span in line.get("spans", [])).strip()
                    normalized = re.sub(r"[^A-Za-z\s]", " ", text).upper()
                    normalized = re.sub(r"\s+", " ", normalized).strip()
                    if re.search(r"TO\s+WHOM\S*\s+IT\s+MAY\s+CONCERN", normalized):
                        bbox = fitz.Rect(line["bbox"])
                        page.add_redact_annot(fitz.Rect(bbox.x0 - 8, bbox.y0 - 5, page.rect.width - 36, bbox.y1 + 8), fill=(1, 1, 1))
            page.apply_redactions(images=0, graphics=0)

            lines = []
            for block in page.get_text("dict").get("blocks", []):
                if block.get("type") != 0:
                    continue
                for line in block.get("lines", []):
                    text = " ".join(span.get("text", "") for span in line.get("spans", [])).strip()
                    if text:
                        lines.append((fitz.Rect(line["bbox"]), text))
            lines.sort(key=lambda item: item[0].y0)

            escalation = next((bbox for bbox, text in lines if "Escalation matrix" in text), None)
            if escalation:
                page.add_redact_annot(fitz.Rect(68, 132, page.rect.width - 36, escalation.y0 - 10), fill=(1, 1, 1))
                page.add_redact_annot(
                    fitz.Rect(escalation.x0 - 2, escalation.y0 - 2, page.rect.width - 36, escalation.y1 + 2),
                    fill=(1, 1, 1),
                )
                page.apply_redactions(images=0, graphics=0)
                y = 148
                for value in ["To,", *service_recipient]:
                    if value:
                        page.insert_text((72, y), value, fontsize=11.5, fontname="hebo", color=(0, 0, 0))
                        y += 15
                page.insert_textbox(
                    fitz.Rect(72, 213, page.rect.width - 52, 252),
                    "This is certifying that acxxel Workstation offers on-site comprehensive warranty as said in bid document.",
                    fontsize=10.8,
                    fontname="helv",
                    color=(0, 0, 0),
                    align=0,
                )
                page.insert_text(
                    (escalation.x0, escalation.y1 + 14),
                    "Escalation matrix for service support is as follows:",
                    fontsize=10.8,
                    fontname="helv",
                    color=(0, 0, 0),
                )
                return

            to_index = next((i for i, (_, text) in enumerate(lines) if text.strip().rstrip(",").lower() == "to"), None)
            if to_index is None:
                return

            stop_index = None
            for i in range(to_index + 1, len(lines)):
                text = lines[i][1]
                if re.search(r"Service\s*&\s*Support|Availability of Service|Level\s+1|Toll free|Escalation", text, re.IGNORECASE):
                    stop_index = i
                    break
            if stop_index is None:
                stop_index = min(to_index + 8, len(lines))

            erase_lines = lines[to_index + 1:stop_index]
            if erase_lines:
                x0 = min(rect.x0 for rect, _ in erase_lines)
                y0 = min(rect.y0 for rect, _ in erase_lines)
                y1 = max(rect.y1 for rect, _ in erase_lines)
                page.add_redact_annot(fitz.Rect(x0 - 2, y0 - 2, page.rect.width - 36, y1 + 4), fill=(1, 1, 1))
                page.apply_redactions(images=0, graphics=0)

                y = y0 + 11
                for value in service_recipient:
                    if value:
                        page.insert_text((x0, y), value, fontsize=11.5, fontname="hebo", color=(0, 0, 0))
                        y += 15

        def fix_service_support_page_30(page):
            page.add_redact_annot(fitz.Rect(68, 150, 360, 220), fill=(1, 1, 1))
            page.apply_redactions(images=0, graphics=0)
            y = 166
            for value in [
                "To,",
                *service_recipient,
                f"Bid No: {bid_no}" if bid_no else "",
            ]:
                if value:
                    page.insert_text((72, y), value, fontsize=11.5, fontname="hebo", color=(0, 0, 0))
                    y += 15
            # The "As per the Buyer ATC..." heading, the quoted availability
            # paragraph, the on-site closing paragraph, and the signature block
            # below it are all redrawn together by the shared
            # _fill_service_support_availability helper (see the original_page
            # == 30 branch below) — mirrors AIO's equivalent page exactly.

        def fix_manufacturer_auth_page(page):
            from .Aio import _fill_manufacturer_auth_body

            _fill_manufacturer_auth_body(page, fitz)

        def fix_non_return_hdd_page(page):
            # The template paragraph is desktop-specific; rewrite only the body,
            # leaving header, subject, and signature block intact.
            body_rect = fitz.Rect(86, 258, page.rect.width - 52, 360)
            write_x = 90
            write_y = 274
            page.add_redact_annot(body_rect, fill=(1, 1, 1))
            page.apply_redactions(images=0, graphics=0)
            page.insert_text((write_x, write_y), "Dear Sir,", fontsize=11, fontname="hebo", color=(0, 0, 0))
            paragraph = (
                "We undertake that, as per Buyer Organization's Security Policy, Faulty Hard Disk of "
                "Servers / Desktop Computers / Laptops / Workstation / Printer / Toner etc. will not be "
                "returned back to the OEM/supplier against warranty replacement."
            )
            page.insert_textbox(
                fitz.Rect(write_x, write_y + 24, page.rect.width - 52, write_y + 100),
                paragraph,
                fontsize=10.5,
                fontname="helv",
                color=(0, 0, 0),
                align=0,
                lineheight=1.15,
            )

        def fix_non_obsolete_duration(page):
            # The residual-market-life guarantee still says "3 (Three)
            # years" — bump it to "5 (Five) years" like AIO's equivalent fix.
            for area in page.search_for("3 (Three)"):
                page.add_redact_annot(fitz.Rect(area.x0 - 1, area.y0 - 1, area.x1 + 24, area.y1 + 1), fill=(1, 1, 1))
                page.apply_redactions(images=0, graphics=0)
                page.insert_text((area.x0, area.y1 - 2), "5 (Five)", fontsize=12, fontname="hebo", color=(0, 0, 0))

        def fix_preloaded_os_page(page):
            os_text = clean_text(body.get("os") or bid.os or "Windows 11 Professional")
            page.add_redact_annot(fitz.Rect(68, 336, page.rect.width - 42, 383), fill=(1, 1, 1))
            footer_lines = (
                "Please do feel free to write / call undersign for any clarification.",
                "Thank you,",
            )
            footer_positions = []
            for footer_text in footer_lines:
                matches = page.search_for(footer_text)
                if matches:
                    rect = matches[0]
                    footer_positions.append((rect, footer_text))
                    page.add_redact_annot(
                        fitz.Rect(rect.x0 - 2, rect.y0 - 2, page.rect.width - 42, rect.y1 + 2),
                        fill=(1, 1, 1),
                    )
            page.apply_redactions()
            paragraph = (
                "You may kindly take reference of the above bid for procurement of Workstation. "
                "We hereby confirm that acxxel make of Workstation quoted by the above bid is "
                f"offered with factory preloaded Microsoft {os_text} license."
            )
            page.insert_textbox(
                fitz.Rect(72, 341, page.rect.width - 52, 414),
                paragraph,
                fontsize=10.8,
                fontname="helv",
                color=(0, 0, 0),
                align=0,
            )
            for rect, footer_text in footer_positions:
                page.insert_text(
                    (rect.x0, rect.y1),
                    footer_text,
                    fontsize=10.8,
                    fontname="helv",
                    color=(0, 0, 0),
                )

        def replace_right_of_label(page, label, value, fontsize=9.5):
            value = clean_text(value)
            if not value:
                return False
            label_norm = re.sub(r"\s+", " ", label).strip().lower().rstrip(":")
            for block in page.get_text("dict").get("blocks", []):
                if block.get("type") != 0:
                    continue
                for line in block.get("lines", []):
                    text = " ".join(span.get("text", "") for span in line.get("spans", [])).strip()
                    text_norm = re.sub(r"\s+", " ", text).strip().lower().rstrip(":")
                    if text_norm == label_norm:
                        bbox = fitz.Rect(line["bbox"])
                        x0 = 253 if bbox.x0 < 260 else bbox.x1 + 8
                        redact_and_write(page, (x0, bbox.y0 - 4, page.rect.width - 38, bbox.y1 + 8), value, fontsize=fontsize, bold=True)
                        return True
            return False

        def force_tender_no_date(page):
            tender_text = f"Bid No: {bid_no}            Dated: {bid_date_formatted}".strip()
            if not tender_text:
                return
            tender_line_rects = []
            first_rect = None
            subject_rect = None
            address_rect = None
            to_rect = None
            for block in page.get_text("dict").get("blocks", []):
                if block.get("type") != 0:
                    continue
                for line in block.get("lines", []):
                    line_text = " ".join(span.get("text", "") for span in line.get("spans", [])).strip()
                    if not line_text:
                        continue
                    bbox = fitz.Rect(line["bbox"])
                    if line_text.strip().rstrip(", ").upper() == "TO":
                        to_rect = bbox
                    if subject_rect is None and re.search(r"\bSubject\b|Subject-", line_text, re.IGNORECASE):
                        subject_rect = bbox
                    if (
                        to_rect
                        and pincode
                        and pincode in line_text
                        and to_rect.y0 < bbox.y0 < to_rect.y0 + 120
                    ):
                        address_rect = bbox
                    if (
                        bbox.y0 < 300
                        and (
                            re.search(r"(Tender|Bid)\s*No", line_text, re.IGNORECASE)
                            or re.search(r"GEM/\d{4}/[A-Z]/\d+", line_text)
                            or re.search(r"\bDated\s*:?\s*\d{2}-\d{2}-\d{4}", line_text, re.IGNORECASE)
                        )
                    ):
                        # The real "Tender No: ... Dated: ..." template line always
                        # sits near the top of the page (right below the "To,"
                        # recipient block). Without this y0 cutoff, a Bid No /
                        # GeM-number mention inside a certificate's own body text
                        # further down the page (e.g. Make in India's "Quoted
                        # under GeM Bid No. - ..." sentence) gets swept up and
                        # erased here too, before the doc-specific handler ever
                        # gets to redraw it.
                        tender_line_rects.append(fitz.Rect(bbox.x0 - 2, bbox.y0 - 3, page.rect.width - 36, bbox.y1 + 4))
                        if first_rect is None:
                            first_rect = bbox

            if address_rect and subject_rect and address_rect.y0 >= subject_rect.y0:
                address_rect = None

            if tender_line_rects:
                for rect in tender_line_rects:
                    page.add_redact_annot(rect, fill=(1, 1, 1))
                page.apply_redactions()
                page.insert_text(
                    (
                        address_rect.x0 if address_rect else first_rect.x0,
                        address_rect.y1 + 14 if address_rect else first_rect.y1 - 2,
                    ),
                    tender_text,
                    fontsize=11,
                    fontname="hebo",
                    color=(0, 0, 0),
                )
                return

            old_values = set(all_gem_numbers) | set(all_dates)
            text = page.get_text("text")
            old_values.update(re.findall(r"GEM/\d{4}/[A-Z]/\d+", text))
            old_values.update(re.findall(r"\d{2}-\d{2}-\d{4}", text))
            for old in old_values:
                replace_exact(page, old, bid_no if old.startswith("GEM/") else bid_date_formatted, fontsize=10)
            if "Bid No" not in page.get_text("text") and "Tender No" not in page.get_text("text"):
                insert_x = address_rect.x0 if address_rect else 72
                insert_y = address_rect.y1 + 14 if address_rect else (subject_rect.y0 - 28 if subject_rect else 118)
                page.insert_text((insert_x, insert_y), tender_text, fontsize=11, fontname="hebo", color=(0, 0, 0))

        def force_customer_block(page):
            lines = []
            for block in page.get_text("dict").get("blocks", []):
                if block.get("type") != 0:
                    continue
                for line in block.get("lines", []):
                    text = " ".join(span.get("text", "") for span in line.get("spans", [])).strip()
                    if text:
                        lines.append((fitz.Rect(line["bbox"]), text))
            lines.sort(key=lambda item: (item[0].y0, item[0].x0))
            anchor = next((bbox for bbox, text in lines if text.strip().rstrip(",").lower() == "to"), None)
            if not anchor:
                return
            next_anchor = next((bbox for bbox, text in lines if bbox.y0 > anchor.y0 and re.search(r"(Tender|Bid)\s*No|Subject|Dear", text, re.IGNORECASE)), None)
            if next_anchor:
                page.add_redact_annot(fitz.Rect(anchor.x0, anchor.y1 + 2, page.rect.width - 36, next_anchor.y0 - 4), fill=(1, 1, 1))
                page.apply_redactions()
            y = anchor.y1 + 16
            for value in [dept_name, organization, full_address]:
                if value:
                    page.insert_text((anchor.x0, y), value, fontsize=11, fontname="hebo", color=(0, 0, 0))
                    y += 15

        def update_make_in_india(page):
            # Same approach as AIO's _fill_make_in_india_page (Aio.py) — find the
            # actual template regions (intro paragraph, table cells, model
            # caption) and edit them in place, instead of blanket-erasing the
            # whole body and redrawing a brand new table at hardcoded
            # coordinates. Reusing AIO's own generic helpers (no AIO-specific
            # wording in them) rather than duplicating them here. The "To,"
            # recipient block and the "Bid No / Dated" line are intentionally
            # left alone — force_customer_block/force_tender_no_date already
            # filled those in correctly earlier in the per-page loop above.
            from .Aio import _format_model_number, _shrink_for_cell, _get_cell_bg_color, _draw_inline_paragraph

            def _lines():
                out = []
                for block in page.get_text("dict").get("blocks", []):
                    if block.get("type") != 0:
                        continue
                    for line in block.get("lines", []):
                        text = " ".join(span.get("text", "") for span in line.get("spans", []))
                        out.append((line["bbox"], text.strip()))
                out.sort(key=lambda lx: lx[0][1])
                return out

            formatted_model = _format_model_number(model_number) or "quoted model"

            all_lines = _lines()
            intro_start = intro_end = None
            for i, (bbox, text) in enumerate(all_lines):
                if "This is to certify" in text and intro_start is None:
                    intro_start = i
                if intro_start is not None and (
                    "content details are as below" in text.lower() or "local content details" in text.lower()
                ):
                    intro_end = i
                    break

            if intro_start is not None and intro_end is not None:
                intro_lines = all_lines[intro_start:intro_end + 1]
                region_x0 = min(b[0] for b, t in intro_lines)
                region_y0 = intro_lines[0][0][1]
                region_x1 = page.rect.width - 36
                region_y1 = intro_lines[-1][0][3] + 6
                page.add_redact_annot(fitz.Rect(region_x0 - 2, region_y0 - 2, region_x1, region_y1), fill=(1, 1, 1))
                page.apply_redactions()

                segments = [
                    ("This is to certify that ", False),
                    ("acxxel WORKSTATION ", True),
                    (formatted_model + " ", True),
                    ("Quoted under ", False),
                    ("GeM Bid No. - ", True),
                    ((bid_no if bid_no else "N/A") + " ", True),
                    ("is getting manufactured in India. Local content details are as below:", False),
                ]
                _draw_inline_paragraph(page, region_x0, region_y0 + 11, 17, region_x1 - region_x0 - 4, segments, fitz, fontsize=11)

            page_text = page.get_text("text")
            for pattern in [r"https?://[^\s]+", r"www\.[^\s]+", r"[a-zA-Z0-9-]+\.html[^\s]*", r"[a-zA-Z0-9-]+#variant_id=[^\s]+", r"mkp\.gem\.gov\.in[^\s]*"]:
                for m in re.finditer(pattern, page_text, re.IGNORECASE):
                    for area in page.search_for(m.group(0)):
                        page.add_redact_annot(area, fill=(1, 1, 1))
            page.apply_redactions()

            all_lines2 = _lines()
            config_link_idx = next((i for i, (b, t) in enumerate(all_lines2) if "config link" in t.lower()), None)
            if config_link_idx is not None:
                erase_rects = [fitz.Rect(*all_lines2[config_link_idx][0])]
                for j in range(config_link_idx + 1, min(config_link_idx + 8, len(all_lines2))):
                    bbox_j, text_j = all_lines2[j]
                    if text_j and (
                        any(tok in text_j.lower() for tok in ["http", "www", ".com", ".in", ".html", "variant_id", "mkp"])
                        or re.match(r"^[a-zA-Z0-9\-_/#.:]+$", text_j)
                    ):
                        erase_rects.append(fitz.Rect(*bbox_j))
                    else:
                        break
                for rect in erase_rects:
                    page.add_redact_annot(rect, fill=(1, 1, 1))
                page.apply_redactions()

            # Position-based table fill: find each "NN%" content cell, then the
            # widest line sitting on roughly the same row to its left as the
            # description — same as AIO, avoids relying on the template's exact
            # coordinates or a naive digit-matching regex over the raw text.
            all_lines_final = _lines()
            percent_cells = [(fitz.Rect(bbox), text) for bbox, text in all_lines_final if re.fullmatch(r"\d{1,3}\s*%", text.strip())]
            for pct_rect, pct_text in percent_cells:
                row_y = (pct_rect.y0 + pct_rect.y1) / 2
                desc_candidates = [
                    (fitz.Rect(bbox), text) for bbox, text in all_lines_final
                    if abs((fitz.Rect(bbox).y0 + fitz.Rect(bbox).y1) / 2 - row_y) <= 10
                    and fitz.Rect(bbox).x1 <= pct_rect.x0
                    and not re.fullmatch(r"\d+", text.strip())
                ]
                desc_rect = max(desc_candidates, key=lambda item: item[0].x1 - item[0].x0, default=(None, None))[0]

                if formatted_model and desc_rect is not None:
                    shrunk = _shrink_for_cell(desc_rect, fitz)
                    cell_bg = _get_cell_bg_color(page, shrunk, fitz)
                    page.add_redact_annot(shrunk, fill=cell_bg)
                    page.apply_redactions()
                    page.insert_text((desc_rect.x0 + 2, (desc_rect.y0 + desc_rect.y1) / 2 + 4), formatted_model, fontsize=9, fontname="hebo", color=(0, 0, 0))
                if local_content:
                    shrunk = _shrink_for_cell(pct_rect, fitz)
                    cell_bg = _get_cell_bg_color(page, shrunk, fitz)
                    page.add_redact_annot(shrunk, fill=cell_bg)
                    page.apply_redactions()
                    lc = local_content if str(local_content).endswith("%") else f"{local_content}%"
                    page.insert_text((pct_rect.x0 + 2, (pct_rect.y0 + pct_rect.y1) / 2 + 4), lc, fontsize=9, fontname="hebo", color=(0, 0, 0))

            if formatted_model:
                for bbox, text in _lines():
                    if re.search(r"ACXXEL", text, re.IGNORECASE) and re.search(r"MODEL", text, re.IGNORECASE):
                        area = fitz.Rect(bbox)
                        page.add_redact_annot(fitz.Rect(area.x0 - 1, area.y0 - 1, page.rect.width - 36, area.y1 + 1), fill=(1, 1, 1))
                        page.apply_redactions()
                        page.insert_text((area.x0, area.y1 - 2), f"acxxel WORKSTATION MODEL {formatted_model}", fontsize=10.5, fontname="hebo", color=(0, 0, 0))

        def insert_data_sheet_value(page, rect, value):
            value = clean_text(value)
            if not value:
                return
            area = fitz.Rect(rect)
            inner = fitz.Rect(area.x0 + 3, area.y0 + 2, area.x1 - 3, area.y1 - 2)
            if inner.height <= 22:
                page.insert_text(
                    (inner.x0, inner.y0 + 10.5),
                    value,
                    fontsize=9.2,
                    fontname="hebo",
                    color=(0, 0, 0),
                )
            else:
                page.insert_textbox(
                    inner,
                    value,
                    fontsize=9.2,
                    fontname="hebo",
                    color=(0, 0, 0),
                    align=0,
                )

        def fill_data_sheet_page(page, page_index):
            if page_index == 0:
                brand_area = fitz.Rect(253, 258, 550, 281)
                page.draw_rect(brand_area, color=None, fill=(1, 1, 1), overlay=True)
                insert_data_sheet_value(page, brand_area, "acxxel")
                value_cells = {
                    "model_number": (253, 235, 550, 258),
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
                insert_data_sheet_value(page, rect, specs.get(key, ""))

        def fill_technical_compliance(page):
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
            description = specs["description"] or "Workstation"
            if model_number and model_number not in description:
                description = clean_text(f"Model {model_number} {description}")
            if specs.get("warranty_text"):
                description = re.sub(
                    r"\b\d+\s*years?\b",
                    specs["warranty_text"],
                    description,
                    flags=re.IGNORECASE,
                )

            def replace_technical_cell(rect, value, fontsize=8.5):
                value = clean_text(value)
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
                replace_technical_cell(rect, value, fontsize=fontsize)

        workstation_template_replaced = set()

        def fill_workstation_spec_template(page, technical=False):
            """Fill only the value/offered column of media/templates/workstation.pdf."""
            x_min = 410 if technical else 295
            x_max = 528 if technical else 590

            def replace_value(old, new, fontsize=9.2):
                new = clean_text(new)
                replacement_key = ("technical" if technical else "datasheet", old)
                if not new or replacement_key in workstation_template_replaced:
                    return
                matches = [area for area in page.search_for(old) if area.x0 >= x_min]
                if not matches:
                    return
                # Wrapped PDF text is returned as multiple rectangles. Clear
                # the complete value/offered cell before writing once, or old
                # continuation lines remain visible beside the new value.
                matches = sorted(matches, key=lambda item: (abs(item.x0 - (428.8 if technical else 304)), item.y0))
                anchor = matches[0]
                same_value_lines = [item for item in matches if abs(item.x0 - anchor.x0) < 8]
                y0 = min(item.y0 for item in same_value_lines) - 2
                y1 = max(item.y1 for item in same_value_lines) + 4
                cell_x0 = 424 if technical else anchor.x0 - 2
                if technical:
                    # Use the actual table row (the nearest horizontal rules)
                    # rather than the old placeholder's height.  Template
                    # placeholders are often top-aligned, whereas offered
                    # values must sit in the vertical centre of their cell.
                    cell_mid_x = (cell_x0 + x_max) / 2
                    row_rules = []
                    for drawing in page.get_drawings():
                        for item in drawing["items"]:
                            if item[0] == "l":
                                start, end = item[1], item[2]
                                if abs(start.y - end.y) < 0.1 and min(start.x, end.x) <= cell_mid_x <= max(start.x, end.x):
                                    row_rules.append(start.y)
                            elif item[0] == "re":
                                rect = item[1]
                                if rect.x0 <= cell_mid_x <= rect.x1:
                                    row_rules.extend((rect.y0, rect.y1))
                    row_rules = sorted(set(round(rule, 2) for rule in row_rules))
                    row_top = [rule for rule in row_rules if rule <= anchor.y0]
                    row_bottom = [rule for rule in row_rules if rule >= anchor.y1]
                    if row_top and row_bottom:
                        y0 = row_top[-1] + 1
                        y1 = row_bottom[0] - 1
                # Keep a thin inset when clearing Technical Compliance cells
                # so the template's vertical and horizontal table borders are
                # never painted over.
                clear_x0 = cell_x0 + 1 if technical else cell_x0
                clear_x1 = x_max - 1 if technical else x_max
                box = fitz.Rect(clear_x0, y0, clear_x1, y1)
                page.add_redact_annot(box, fill=(1, 1, 1))
                page.apply_redactions()

                text_x0 = 428.8 if technical else anchor.x0
                available_width = x_max - 2 - text_x0
                fit_fontsize = fontsize
                value_to_insert = new
                if technical:
                    # Wrap long values inside the existing cell.  Do not
                    # remove or draw over a table rule to make text fit.
                    def wrap_value(value, size):
                        lines = []
                        for paragraph in value.split("\n"):
                            line = ""
                            for word in paragraph.split():
                                candidate = f"{line} {word}".strip()
                                if line and fitz.get_text_length(candidate, fontname="hebo", fontsize=size) > available_width:
                                    lines.append(line)
                                    line = word
                                else:
                                    line = candidate
                            if line:
                                lines.append(line)
                        return lines or [value]

                    wrapped_lines = wrap_value(new, fit_fontsize)
                    line_height = fit_fontsize + 3
                    while fit_fontsize > 6.0 and len(wrapped_lines) * line_height > y1 - y0 - 6:
                        fit_fontsize -= 0.4
                        wrapped_lines = wrap_value(new, fit_fontsize)
                        line_height = fit_fontsize + 3
                    value_to_insert = "\n".join(wrapped_lines)
                    content_height = len(wrapped_lines) * line_height
                else:
                    while fit_fontsize > 7.0 and text_width(new, fit_fontsize, bold=True) > available_width:
                        fit_fontsize -= 0.4
                    fits_one_line = text_width(new, fit_fontsize, bold=True) <= available_width
                    line_height = fit_fontsize + 8
                    content_height = line_height if fits_one_line else line_height * 2
                # The original placeholder (old) may have wrapped onto two
                # lines while the new value only needs one (or vice versa).
                # The static "Compliant" label beside this cell is positioned
                # at the vertical centre of that original placeholder's span,
                # so anchoring the new value to the top of the same span (as
                # before) left short values sitting well above "Compliant"
                # whenever the old placeholder was taller. Centre the new
                # value on that same midpoint instead, so it lines up with
                # "Compliant" no matter how many lines either one needs.
                original_center = (y0 + y1) / 2
                box_top = max(y0, original_center - content_height / 2)
                box = fitz.Rect(text_x0, box_top, x_max - 2, box_top + content_height)
                page.insert_textbox(box, value_to_insert, fontsize=fit_fontsize, fontname="hebo", color=(0, 0, 0))
                workstation_template_replaced.add(replacement_key)

            replacements = [
                ("Intel Core i9-14900", specs["processor"]),
                ("Intel Core Ultra 7 265K", specs["processor"]),
                ("Intel Q Series", specs["motherboard"]),
                ("NVIDIA Geforce RTX 5070 12GB", specs["graphics_model"]),
                ("NVIDIA GeForce RTX 5070 Ti 16GB", specs["graphics_model"]),
                ("Windows 11 Professional", specs["os"]),
                ("DDR5", specs["ram_type"]),
                ("128", specs["ram_size"]),
                ("1024", specs["ssd_capacity"] or specs["ssd2"]),
                ("2000", specs["hdd_capacity"]),
                ("HDD@5400RPM", specs["hdd_capacity"]),
                ("No Wireless Connectivity", specs["wifi"] or "No Wireless Connectivity"),
                ("Wi-Fi 6 (802.11ax) + Bluetooth 5.3", specs["wifi"]),
                ("68.1 - 73 (26.81\" - 28.74\")", specs["monitor"]),
                ("60.96 CM (24.0\") [Falls in 58.1 - 63 CM range]", specs["monitor"]),
                ("700", specs["power_supply"]),
            ]
            for old, new in replacements:
                replace_value(old, new)
            if technical:
                replace_value("32", specs["ram_size"])
                if page.number == 5:
                    # These two offered cells contain heavily wrapped source
                    # text, which PyMuPDF cannot reliably match as one phrase.
                    # Clear the fixed offered cells completely and write once.
                    offered_cells = [
                        (fitz.Rect(424, 320, 528, 460), re.sub(r"\s*\+\s*", "\n", specs["wifi"] or "No Wireless Connectivity")),
                        (fitz.Rect(424, 520, 528, 600), specs["monitor"]),
                    ]
                    for area, _value in offered_cells:
                        page.add_redact_annot(
                            fitz.Rect(area.x0 + 1, area.y0 + 1, area.x1 - 1, area.y1 - 1),
                            fill=(1, 1, 1),
                        )
                    page.apply_redactions()
                    for area, value in offered_cells:
                        if clean_text(value):
                            available_width = area.width - 9
                            wrapped_lines = []
                            for paragraph in clean_text(value).split("\n"):
                                words = paragraph.split()
                                line = ""
                                for word in words:
                                    candidate = f"{line} {word}".strip()
                                    if line and fitz.get_text_length(candidate, fontname="hebo", fontsize=9.2) > available_width:
                                        wrapped_lines.append(line)
                                        line = word
                                    else:
                                        line = candidate
                                if line:
                                    wrapped_lines.append(line)
                            line_height = 11.5
                            text_height = max(line_height, len(wrapped_lines) * line_height)
                            text_top = area.y0 + max(5, (area.height - text_height) / 2)
                            page.insert_textbox(
                                fitz.Rect(area.x0 + 5, text_top, area.x1 - 4, area.y1 - 4),
                                "\n".join(wrapped_lines), fontsize=9.2, fontname="hebo", color=(0, 0, 0),
                            )
            if model_number:
                # Model number is not printed in the supplied template; add it
                # unobtrusively below the datasheet heading on its first page.
                if not technical and page.number == 0:
                    page.insert_text((304, 92), f"Model: {model_number}", fontsize=8.5, fontname="hebo", color=(0, 0, 0))

        def rewrite_warranty(page):
            formatted_model = model_number or "quoted model"
            paragraph = (
                "This is to certify that Laps N Tabs Technology Pvt. Ltd. is the OEM of acxxel "
                f"Workstation Brand and will provide comprehensive warranty during entire standard "
                f"warranty period i.e. {specs['warranty_text'] or 'standard warranty'} for quoted "
                f"acxxel Workstation {formatted_model}, if the said bid award to us."
            )
            redact_and_write(page, (82, 314, page.rect.width - 42, 374), paragraph, fontsize=10.5)
            page.add_redact_annot(fitz.Rect(58, 392, page.rect.width - 60, 452), fill=(1, 1, 1))
            page.apply_redactions()

        source_doc = fitz.open(template_path)
        signature_image = None
        if len(source_doc) > 5:
            signature_images = source_doc[5].get_images(full=True)
            if len(signature_images) > 1:
                signature_image = source_doc.extract_image(signature_images[1][0]).get("image")
        if not signature_image:
            for signature_page in source_doc:
                signature_images = signature_page.get_images(full=True)
                if len(signature_images) > 1:
                    signature_image = source_doc.extract_image(signature_images[1][0]).get("image")
                    if signature_image:
                        break

        def add_authorized_signatory(page, y=685, compact=False):
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
        if doc_type == "data_sheet" and uses_workstation_spec_template:
            page_from, page_to = (1, 7)
        elif doc_type == "technical_compliance" and uses_workstation_spec_template:
            page_from, page_to = (8, 13)
        else:
            page_from, page_to = cert_page_ranges[doc_type]
        service_signature_block = None
        service_signature_rect = None
        if doc_type == "service_support" and len(source_doc) >= 30:
            source_signature_page = source_doc[24]
            auth_areas = source_signature_page.search_for("Auth. Signatory")
            contact_areas = source_signature_page.search_for("Contact No.:- 9918200166")
            service_signature_rect = fitz.Rect(58, 540, 365, 735)
            if auth_areas and contact_areas:
                service_signature_rect = fitz.Rect(
                    max(0, auth_areas[0].x0 - 5),
                    max(0, auth_areas[0].y0 - 5),
                    min(source_signature_page.rect.width - 10, max(330, contact_areas[0].x1 + 20)),
                    min(source_signature_page.rect.height - 5, contact_areas[-1].y1 + 8),
                )
            service_signature_block = source_signature_page.get_pixmap(
                matrix=fitz.Matrix(2, 2),
                clip=service_signature_rect,
                alpha=False,
            ).tobytes("png")
        doc = fitz.open()
        doc.insert_pdf(source_doc, from_page=page_from - 1, to_page=page_to - 1)
        source_doc.close()

        for page in doc:
            page_text = page.get_text("text")
            all_gem_numbers.update(re.findall(r"(?<![A-Za-z])GEM/\d{4}/[A-Z]/\d+", page_text))
            all_dates.update(re.findall(r"\d{2}-\d{2}-\d{4}", page_text))
        if not all_gem_numbers or not all_dates:
            full_doc = fitz.open(template_path)
            for page in full_doc:
                page_text = page.get_text("text")
                all_gem_numbers.update(re.findall(r"(?<![A-Za-z])GEM/\d{4}/[A-Z]/\d+", page_text))
                all_dates.update(re.findall(r"\d{2}-\d{2}-\d{4}", page_text))
                if all_gem_numbers and all_dates:
                    break
            full_doc.close()

        def lowercase_acxxel(page, min_y=None):
            matches = []
            for word in page.get_text("words"):
                text = word[4]
                if min_y is not None and word[1] < min_y:
                    continue
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
            page.apply_redactions(images=0, graphics=0)
            for area, text in matches:
                fontsize = max(7, min(12, area.height * 0.82))
                page.insert_text(
                    (area.x0, area.y1 - 1),
                    text,
                    fontsize=fontsize,
                    fontname="hebo",
                    color=(0, 0, 0),
                )

        suppress_tender_pages = {3, 26, 27, 28, 29}
        suppress_tender_docs = {"data_sheet", "technical_compliance"}
        for page_index, page in enumerate(doc):
            original_page = page_from + page_index
            if uses_workstation_spec_template:
                fill_workstation_spec_template(page, technical=doc_type == "technical_compliance")
                continue
            if doc_type == "service_support":
                fix_service_support_page(page)
                from .Aio import _fill_service_support_escalation
                _fill_service_support_escalation(page, fitz)
                if original_page == 25:
                    from .Aio import _add_service_support_bid_date
                    _add_service_support_bid_date(page, fitz, bid_no, bid_date_formatted)
                if original_page == 29:
                    add_service_support_table_note(page)
                if original_page == 30:
                    fix_service_support_page_30(page)
                    from .Aio import _fill_service_support_availability
                    _fill_service_support_availability(page, fitz)
                    if service_signature_block and service_signature_rect:
                        # Starts at 460 (not 500) so it also wipes the bare
                        # "Auth. Signatory"/"For Laps N Tabs..." text lines
                        # _fill_service_support_availability just drew above —
                        # the pasted-in image below already carries that same
                        # label baked in, so leaving both would show it twice.
                        page.add_redact_annot(
                            fitz.Rect(55, 460, min(380, page.rect.width - 20), min(735, page.rect.height - 5)),
                            fill=(1, 1, 1),
                        )
                        page.apply_redactions()
                        target_rect = fitz.Rect(
                            service_signature_rect.x0,
                            540,
                            service_signature_rect.x1,
                            540 + service_signature_rect.height,
                        )
                        page.insert_image(
                            target_rect,
                            stream=service_signature_block,
                            keep_proportion=False,
                            overlay=True,
                        )
                    # Note: _add_service_support_last_page_bid_date is deliberately
                    # NOT called here — fix_service_support_page_30 already draws
                    # the "To,"/recipient/Bid No block for this page, and that
                    # function's dept_name-driven branch would treat it as
                    # adjacent to the "As per the Buyer ATC..." heading below and
                    # redraw over it, corrupting both.
                remove_urls_and_config_links(page)
                lowercase_acxxel(page, min_y=230)
                continue

            if (
                original_page in suppress_tender_pages
                or doc_type in suppress_tender_docs
                or (doc_type == "manufacturer_auth" and page_index > 0)
            ):
                remove_tender_no_date_lines(page)
            else:
                force_tender_no_date(page)
            if doc_type not in {"service_support", "warranty", "non_return_hdd", "non_obsolete"}:
                force_customer_block(page)
            if doc_type not in {"non_return_hdd", "warranty", "technical_compliance", "data_sheet", "make_in_india"}:
                for old, new in [
                    ("Desktop Computer", "Workstation"),
                    ("Desktop Brand", "Workstation Brand"),
                    ("ACXXEL Desktop", "acxxel Workstation"),
                    ("ACXXEL DESKTOP", "acxxel WORKSTATION"),
                ]:
                    replace_exact(page, old, new, fontsize=10)
            if model_number and doc_type not in {"non_return_hdd", "warranty", "technical_compliance", "data_sheet", "make_in_india"}:
                for pattern in [r"AXL-[A-Z0-9-]+", r"ACL-[A-Z0-9-]+", r"ACXXEL[^\s,.;]+", r"ACXOEL[^\s,.;]+"]:
                    for match in re.findall(pattern, page.get_text("text"), re.IGNORECASE):
                        replace_exact(page, match, model_number, fontsize=10)
            if doc_type == "manufacturer_auth" and original_page == 2:
                fix_manufacturer_auth_page(page)
            if doc_type == "manufacturer_auth":
                # Keep buyer/department names exactly as entered. Brand-name
                # normalization is only intended for the certificate body.
                lowercase_acxxel(page, min_y=230)
            if doc_type == "data_sheet":
                fill_data_sheet_page(page, page_index)
                if page_index == len(doc) - 1:
                    add_authorized_signatory(page)
            elif doc_type == "technical_compliance":
                fill_technical_compliance(page)
                add_authorized_signatory(page, y=690, compact=True)
            elif doc_type == "warranty":
                rewrite_warranty(page)
                remove_urls_and_config_links(page)
            elif doc_type == "make_in_india":
                update_make_in_india(page)
            elif doc_type == "non_return_hdd":
                fix_non_return_hdd_page(page)
            elif doc_type == "preloaded_os":
                fix_preloaded_os_page(page)
            elif doc_type == "non_obsolete":
                fix_non_obsolete_duration(page)
                remove_urls_and_config_links(page)
            else:
                remove_urls_and_config_links(page)

        if doc_type == "data_sheet" and uses_workstation_spec_template:
            snapshot = fitz.open(stream=doc.tobytes(), filetype="pdf")
            compact_doc = fitz.open()
            data_rows = [
                ("Model Number", specs["model_number"]),
                ("Processor", specs["processor"]),
                ("Motherboard", specs["motherboard"]),
                ("RAM", specs["ram_size"]),
                ("Primary SSD", specs["ssd_capacity"]),
                ("Secondary SSD", specs["ssd2"]),
                ("Hard Disk Drive", specs["hdd_capacity"]),
                ("Graphics Card", specs["graphics_model"]),
                ("Operating System", specs["os"]),
                ("Wi-Fi / Bluetooth", specs["wifi"]),
                ("Optional Ports", specs["optional_ports"]),
                ("DVD / Optical Drive", clean_text(bid.dvd)),
                ("Monitor / Screen Size", specs["monitor"]),
                ("Cabinet", specs["cabinet"]),
                ("Keyboard & Mouse", specs["keyboard"]),
                ("Power Supply", specs["power_supply"]),
                ("On-Site OEM Warranty", specs["warranty"] or specs["warranty_text"]),
            ]
            page_rows = (data_rows[:9], data_rows[9:])
            for page_index, rows in enumerate(page_rows):
                page = compact_doc.new_page(width=612, height=792)
                # The exact Acxxel / Laps N Tabs company header from the
                # supplied workstation PDF is retained on both pages.
                page.show_pdf_page(
                    fitz.Rect(0, 0, 612, 97), snapshot, 0,
                    clip=fitz.Rect(0, 0, 612, 97), keep_proportion=False,
                )
                page.insert_textbox(
                    fitz.Rect(34, 103, 578, 130),
                    "Datasheet of the product",
                    fontsize=14, fontname="hebo", color=(0.08, 0.08, 0.08), align=1,
                )
                page.insert_textbox(
                    fitz.Rect(34, 128, 578, 145),
                    f"Model: {specs['model_number'] or '-'}",
                    fontsize=8.5, fontname="hebo", color=(0.25, 0.25, 0.25), align=1,
                )
                y = 151
                label_width = 205
                row_height = 48
                for label, raw_value in rows:
                    value = clean_text(raw_value) or "-"
                    page.draw_rect(
                        fitz.Rect(34, y, label_width, y + row_height),
                        color=(0.55, 0.55, 0.55), fill=(0.93, 0.94, 0.96), width=0.65,
                    )
                    page.draw_rect(
                        fitz.Rect(label_width, y, 578, y + row_height),
                        color=(0.55, 0.55, 0.55), width=0.65,
                    )
                    page.insert_textbox(
                        fitz.Rect(43, y + 8, label_width - 7, y + row_height - 5),
                        label, fontsize=9, fontname="hebo", color=(0, 0, 0),
                    )
                    page.insert_textbox(
                        fitz.Rect(label_width + 9, y + 7, 570, y + row_height - 5),
                        value, fontsize=10, fontname="hebo", color=(0, 0, 0),
                    )
                    y += row_height
                if page_index == 1:
                    add_authorized_signatory(page, y=610)
            doc.close()
            snapshot.close()
            doc = compact_doc

        if doc_type == "technical_compliance" and uses_workstation_spec_template:
            # Build a clean compliance document instead of trying to edit the
            # narrow, pre-printed cells in the supplied template.  The
            # original company header is retained, while every generated
            # workstation specification is laid out in a new, expandable
            # table that never crosses a table border.
            snapshot = fitz.open(stream=doc.tobytes(), filetype="pdf")
            compliance_doc = fitz.open()
            compliance_rows = [
                ("Processor", specs["processor"]),
                (
                    "Motherboard",
                    specs["motherboard"]
                    or clean_text(bid.motherboard_descp)
                    or clean_text(bid.motherboard_type).replace("_", " "),
                ),
                ("RAM Size", clean_text(bid.ram)),
                ("Primary SSD", specs["ssd_capacity"]),
                ("Secondary SSD", specs["ssd2"]),
                ("Hard Disk Drive", specs["hdd_capacity"]),
                ("Graphics Card", specs["graphics_model"]),
                ("Operating System", specs["os"]),
                ("Wi-Fi / Bluetooth", specs["wifi"]),
                ("Bluetooth", specs["wifi"]),
                ("Monitor", specs["monitor"]),
                ("Cabinet", specs["cabinet"]),
                ("DVD / Optical Drive", specs["dvd"]),
                ("Keyboard", specs["keyboard"]),
                ("Mouse Connectivity", specs["mouse_connectivity"]),
                ("Keyboard Connectivity", specs["keyboard_connectivity"]),
                ("Power Supply", specs["power_supply"]),
                ("Optional Ports", specs["optional_ports"]),
                ("On-Site OEM Warranty", specs["warranty"] or specs["warranty_text"]),
                ("Additional Requirements", specs["extra_requirements"]),
            ]
            # Read the selectable component lists directly from the
            # Workstation configuration screen.  This keeps the compliance
            # PDF in sync with the actual Workstation config without having
            # to maintain a second set of component options in the backend.
            config_options_path = os.path.normpath(os.path.join(
                settings.BASE_DIR, "..", "frontend", "src", "pages",
                "Workstation", "User", "WorkstationConfig.jsx",
            ))
            try:
                with open(config_options_path, encoding="utf-8") as config_file:
                    config_options_source = config_file.read()
            except OSError:
                config_options_source = ""

            def config_option_names(*list_names, one_per_line=False):
                values = []
                for list_name in list_names:
                    match = re.search(
                        rf"export const {re.escape(list_name)}\s*=\s*\[(.*?)\];",
                        config_options_source,
                        re.DOTALL,
                    )
                    if match:
                        values.extend(re.findall(r'\bname:\s*"([^"]+)"', match.group(1)))
                separator = "\n" if one_per_line else ", "
                return separator.join(dict.fromkeys(values))

            configured_specs = {
                "Processor": config_option_names("INTEL_PROCESSORS", "INTEL_XEON_PROCESSORS", "AMD_THREADRIPPER_PROCESSORS", one_per_line=True),
                "Motherboard": config_option_names("INTEL_MOTHERBOARDS", "INTEL_XEON_MOTHERBOARDS", "AMD_MOTHERBOARDS"),
                "RAM Type": config_option_names("RAMS", "REGISTERED_RAMS"),
                "RAM Size": config_option_names("RAMS", "REGISTERED_RAMS"),
                "Primary SSD": config_option_names("SSDS"),
                "Secondary SSD": config_option_names("SSDS"),
                "Hard Disk Drive": config_option_names("HDDS"),
                "Graphics Card": config_option_names("GRAPHICS_CARDS", one_per_line=True),
                "Operating System": config_option_names("OS_OPTIONS"),
                "Wi-Fi / Bluetooth": config_option_names("WIFIS"),
                "Bluetooth": config_option_names("WIFIS"),
                "Monitor": config_option_names("MONITORS"),
                "Cabinet": config_option_names("CABINETS"),
                "DVD / Optical Drive": config_option_names("DVDS"),
                "Keyboard": config_option_names("KEYBOARDS"),
                "Mouse Connectivity": config_option_names("KEYBOARDS"),
                "Keyboard Connectivity": config_option_names("KEYBOARDS"),
                "Power Supply": config_option_names("POWER_SUPPLIES"),
                "On-Site OEM Warranty": config_option_names("WARRANTIES"),
            }
            # Keep the BOQ / technical requirement column visible as well as
            # the offered value.  This is the middle specification content
            # from the earlier compliance layout, now shown in a readable
            # expandable table.
            boq_requirements = {
                "Processor": (
                    "Intel Core i5-12400, Intel Core i5-12500, Intel Core i5-12600, Intel Core i5-13400, "
                    "Intel Core i5-14400, Intel Core i5 12600K, Intel Core i7-12700, Intel Core i5-14500, "
                    "Intel Core i5-13500, Intel Core i5-13600, Intel Core i5-14600, Intel Core i9-12900, "
                    "Intel Core i7-12700K, Intel Core i7-13700, Intel Core i5-13600K, Intel Core i5-14600K, "
                    "Intel Core i9 12900K, Intel Core i7-14700, Intel Core i7-13700K, Intel Core i9-13900, "
                    "Intel Core i9-14900, Intel Core i7-14700K, Intel Core i9-13900K, Intel Core i9 14900K, "
                    "Intel Xeon W-2235, Intel Xeon w3-2423, Intel Xeon w3-2425, Intel Xeon W-2255, "
                    "Intel Xeon w3-2435, Intel Xeon w3-2525, Intel Xeon w3-2535, Intel Xeon W-3245M, "
                    "Intel Xeon W 3323, Intel Xeon w5-3423, Intel Xeon w5-3525, Intel Xeon W-3265, "
                    "Intel Xeon W-3245, Intel Xeon w5-2445, Intel Xeon W-3265M, Intel Xeon w5-3433, "
                    "Intel Xeon w5-3425, Intel Xeon w5-2455X, Intel Xeon W-3335, Intel Xeon W 3275M, "
                    "Intel Xeon W-3275, Intel Xeon w5-2545, Intel Xeon w5-3555X, Intel Xeon w5-3435X, "
                    "Intel Xeon w5-3545, Intel Xeon w5-2465X, Intel Xeon w7 3445, Intel Xeon w5-2555X"
                ),
                "Motherboard": "Intel Q Series",
                "RAM Type": "DDR5",
                "RAM Size": "Required RAM capacity",
                "Primary SSD": "Minimum 1024 GB SSD",
                "Secondary SSD": "Secondary SSD capacity",
                "Hard Disk Drive": "Hard disk capacity",
                "Graphics Type": "Dedicated graphics card",
                "Graphics Card": "NVIDIA GeForce RTX 5070 Ti 16GB / NVIDIA GeForce RTX 5070 12GB",
                "Graphics Memory / Details": "Graphics memory and technical details",
                "Operating System": "Windows 11 Professional",
                "Wi-Fi / Bluetooth": "Wi-Fi 6 / Wi-Fi 7 with Bluetooth",
                "Bluetooth": "Bluetooth connectivity",
                "Monitor": "Monitor size and resolution",
                "Cabinet": "Workstation cabinet",
                "DVD / Optical Drive": "Optical drive availability",
                "Keyboard": "Workstation keyboard",
                "Mouse Connectivity": "Mouse connectivity",
                "Keyboard Connectivity": "Keyboard connectivity",
                "Power Supply": "700 W",
                "Optional Ports": "Required I/O ports",
                "On-Site OEM Warranty": "On-site OEM warranty",
                "Additional Requirements": "Other workstation requirements",
            }
            # Prefer the complete current list from WorkstationConfig.jsx.
            # Keep the small text fallback only if the configuration file is
            # unavailable on a deployment.
            boq_requirements.update({
                label: value for label, value in configured_specs.items() if value
            })

            def wrap_table_text(value, width, fontsize=8.8):
                # Explicit line breaks from the configuration option lists
                # must stay intact: one graphics card/processor per line.
                paragraphs = str(value or "-").splitlines() or ["-"]
                lines = []
                for paragraph in paragraphs:
                    words = clean_text(paragraph).split()
                    line = ""
                    for word in words:
                        candidate = f"{line} {word}".strip()
                        if line and fitz.get_text_length(candidate, fontname="hebo", fontsize=fontsize) > width:
                            lines.append(line)
                            line = word
                        else:
                            line = candidate
                    if line:
                        lines.append(line)
                return lines or ["-"]

            def new_compliance_page():
                page = compliance_doc.new_page(width=612, height=792)
                page.show_pdf_page(
                    fitz.Rect(0, 0, 612, 116), snapshot, 0,
                    clip=fitz.Rect(0, 0, 612, 116), keep_proportion=False,
                )
                page.insert_textbox(
                    fitz.Rect(34, 121, 578, 146),
                    "Technical Compliance Certificate",
                    fontsize=14, fontname="hebo", color=(0.08, 0.08, 0.08), align=1,
                )
                headers = (
                    (34, 140, "Parameter"),
                    (140, 370, "BOQ / Required Specification"),
                    (370, 510, "Offered Specification"),
                    (510, 578, "Compliance"),
                )
                for x0, x1, label in headers:
                    page.draw_rect(fitz.Rect(x0, 166, x1, 190), color=(0.45, 0.45, 0.45), fill=(0.88, 0.9, 0.94), width=0.65)
                    page.insert_textbox(fitz.Rect(x0 + 4, 172, x1 - 4, 187), label, fontsize=8, fontname="hebo", align=1)
                return page, 190

            page, y = new_compliance_page()
            for label, raw_value in compliance_rows:
                label_lines = wrap_table_text(label, 96)
                requirement_lines = wrap_table_text(boq_requirements.get(label, "-"), 220)
                value_lines = wrap_table_text(raw_value, 130)
                line_offset = 0
                longest_column = max(len(label_lines), len(requirement_lines), len(value_lines), 1)
                while line_offset < longest_column:
                    available_lines = max(1, int((748 - y - 12) // 11))
                    segment_count = min(longest_column - line_offset, available_lines)
                    row_height = max(30, segment_count * 11 + 12)
                    if y + row_height > 748:
                        page, y = new_compliance_page()
                        continue
                    # Repeat the plain field name on following rows so the
                    # list remains identifiable, but never add "(contd.)".
                    continued_label = label_lines
                    cells = (
                        (34, 140, continued_label, (0.94, 0.95, 0.97)),
                        (140, 370, requirement_lines[line_offset:line_offset + segment_count], None),
                        (370, 510, value_lines[line_offset:line_offset + segment_count], None),
                        (510, 578, ["Compliant"] if line_offset == 0 else [], None),
                    )
                    for x0, x1, lines, fill in cells:
                        page.draw_rect(fitz.Rect(x0, y, x1, y + row_height), color=(0.55, 0.55, 0.55), fill=fill, width=0.65)
                        if lines:
                            text_height = len(lines) * 11
                            text_top = y + max(5, (row_height - text_height) / 2)
                            page.insert_textbox(
                                fitz.Rect(x0 + 5, text_top, x1 - 5, y + row_height - 4),
                                "\n".join(lines), fontsize=8.8, fontname="hebo", color=(0, 0, 0), align=1 if x0 == 510 else 0,
                            )
                    y += row_height
                    line_offset += segment_count

            doc.close()
            snapshot.close()
            doc = compliance_doc

        elif doc_type == "technical_compliance" and uses_workstation_spec_template and doc.page_count >= 6:
            # The supplied template's last compliance page contains two RAID
            # rows that are not part of the workstation offering. Remove that
            # band and move every following section upward so no blank gap or
            # broken pagination remains.
            snapshot = fitz.open(stream=doc.tobytes(), filetype="pdf")
            source_index = 5
            compact_page = doc.new_page(width=612, height=792)
            compact_page.show_pdf_page(
                fitz.Rect(0, 0, 612, 230), snapshot, source_index,
                clip=fitz.Rect(0, 0, 612, 230), keep_proportion=False,
            )
            compact_page.show_pdf_page(
                fitz.Rect(0, 230, 612, 702), snapshot, source_index,
                clip=fitz.Rect(0, 320, 612, 792), keep_proportion=False,
            )
            doc.delete_page(source_index)
            snapshot.close()

        if doc_type in {"warranty", "non_return_hdd", "non_obsolete"}:
            for page in doc:
                force_customer_block(page)

        if doc_type not in {"service_support", "data_sheet", "technical_compliance", "make_in_india"}:
            for page_index, page in enumerate(doc):
                original_page = page_from + page_index
                if (
                    original_page in suppress_tender_pages
                    or (doc_type == "manufacturer_auth" and page_index > 0)
                ):
                    continue
                force_tender_no_date(page)

        out_dir = os.path.join(settings.MEDIA_ROOT, "generated_docs")
        os.makedirs(out_dir, exist_ok=True)
        filename = f"workstation_{bid.id}_{doc_type}.pdf"
        path = os.path.join(out_dir, filename)
        number_pages_from_one(doc)
        doc.save(path)
        doc.close()
        return JsonResponse({
            "success": True,
            "pdf_url": request.build_absolute_uri(f"/media/generated_docs/{filename}")+f"?v={int(time.time())}",
            "message": f"{doc_type} certificate generated successfully",
        })
    except WorkstationBid.DoesNotExist:
        return JsonResponse({"error": "Bid not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


# ---------------------------------------------------------------------------
# GeM extension autofill payload (plumbing only)
#
# TODO(gem-fields): The keys inside `specifications` below reuse this app's
# own internal field labels (same as WorkstationConfig.jsx / _workstation_bid_data).
# They have NOT been verified against the live GeM "Workstation" category
# technical-evaluation form. Before the Chrome extension can actually
# autofill a Workstation bid on GeM, someone needs to open an approved
# Workstation bid on bidplus.gem.gov.in and confirm each field's exact
# label + accepted option text (the way `_desktop_gem_payload` in Desktop.py
# already does for Desktop), then adjust the keys/values here to match.
# ---------------------------------------------------------------------------
def _workstation_gem_payload(bid, request, account):
    document_types = [
        "approved_atc_documents",
        "approved_price_paper",
        "approved_all_documents",
    ]
    documents = [
        {
            "type": doc_type,
            "url": request.build_absolute_uri(
                f"/api/workstation-bids/{bid.id}/generate-docs/"
            ),
        }
        for doc_type in document_types
    ]
    catalogue_product = CatalogueProduct.objects.filter(
        model_no__iexact=bid.model_number or ""
    ).first()
    price_fields = (
        "processor_price", "pro_descp_price", "motherboard_price",
        "motherboard_descp_price", "ram_price", "ssd1_price", "ssd2_price",
        "hdd_price", "graphic_card_price", "cabinet_price", "keyboard_price",
        "power_supply_price", "monitor_price", "os_price", "wifi_price",
        "dvd_price", "warranty_price", "freightInstallation_price",
        "hdd_non_return_price", "extra_requirements_price",
    )
    calculated_price = sum(float(getattr(bid, field, 0) or 0) for field in price_fields)
    approved_price = bid.final_amount or bid.total_price or calculated_price
    return {
        "workflow": "workstation_gem_upload",
        "product_type": "workstation",
        "bid_id": bid.id,
        "callback_url": request.build_absolute_uri(
            f"/api/workstation-bids/{bid.id}/gem-status/"
        ),
        "model_number": bid.model_number or "",
        "brand": "ACXXEL",
        "category": {
            "key": "workstation",
            "label": "Workstation",
            "slug": "",
        },
        "quantity": bid.qty,
        "price": approved_price,
        "bid_number": bid.bid_no,
        "department": bid.dept_name,
        "organization": bid.organization or "",
        "delivery_address": bid.address or "",
        "pincode": bid.pincode or "",
        "local_content": "",
        "specifications": {
            "Processor": bid.processor or "",
            "Processor Description": bid.pro_descp or "",
            "Motherboard": bid.motherboard or "",
            "Motherboard Description": bid.motherboard_descp or "",
            "RAM": bid.ram or "",
            "SSD": " + ".join(filter(None, [bid.ssd1, bid.ssd2])),
            "HDD": bid.hdd or "",
            "Graphics Card": bid.graphic_card or "",
            "Graphics Description": bid.graphics_description or "",
            "Operating System": bid.os or "",
            "Additional Software": bid.additional_software or "",
            "DVD": bid.dvd or "",
            "Wi-Fi / Bluetooth": bid.wifi or "",
            "Monitor": bid.monitor or "",
            "Cabinet": bid.cabinet or "",
            "Keyboard / Mouse": bid.keyboard or "",
            "Power Supply (SMPS)": bid.power_supply or "",
            "Warranty": bid.warranty or "",
            "HDD Return Option": bid.hdd_non_return or "No",
            "Freight and Installation": bid.freightInstallation or "Yes",
            "Extra Requirements": bid.extra_requirements or "",
            "Country Of Origin": "INDIA",
        },
        "documents": documents,
        "images": [
            request.build_absolute_uri(catalogue_product.image.url)
            for _ in [0]
            if catalogue_product and catalogue_product.image
        ],
    }
