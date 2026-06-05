from django.http import JsonResponse
from django.http.multipartparser import MultiPartParser
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.hashers import make_password, check_password
import json
from django.views.decorators.http import require_http_methods
from django.utils import timezone
from .models import User, Product, DesktopBid, CatalogueProduct


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
    """FileField se safe absolute URL nikalo."""
    try:
        if field and field.name:
            return request.build_absolute_uri(field.url)
    except Exception:
        pass
    return ""


# ══════════════════════════════════════════════════════════
#  CATALOGUE PRODUCT APIs
# ══════════════════════════════════════════════════════════

def _catalogue_product_data(product, request):
    extra_specs = product.extra_specs if hasattr(product, 'extra_specs') else {}
    if isinstance(extra_specs, str):
        try:
            extra_specs = json.loads(extra_specs)
        except Exception:
            extra_specs = {}

    return {
        "id": product.id,
        "model_no": product.model_no,
        "processor": product.processor or "",
        "ram": product.ram or "",
        "storage": product.storage or "",
        "os": product.os or "",
        "category": product.category or "",
        "description": product.description or "",
        "extra_specs": extra_specs,
        "image": _file_url(request, product.image),
        "created_at": product.created_at.strftime("%Y-%m-%d") if product.created_at else "",
    }


@csrf_exempt
@require_http_methods(["GET"])
def list_catalogue_products(request):
    try:
        qs = CatalogueProduct.objects.all()

        search = request.GET.get("search", "").strip()
        if search:
            qs = qs.filter(model_no__icontains=search) | qs.filter(processor__icontains=search)

        category = request.GET.get("category", "").strip()
        if category:
            qs = qs.filter(category__iexact=category)

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
    if request.method != "POST":
        return JsonResponse({"error": "Use POST method"}, status=405)
    try:
        data = request.POST
        image = request.FILES.get("image")

        model_no = data.get("model_no", "").strip()
        if not model_no:
            return JsonResponse({"error": "model_no is required"}, status=400)

        if CatalogueProduct.objects.filter(model_no=model_no).exists():
            return JsonResponse({"error": "A product with this model_no already exists"}, status=400)

        extra_specs_raw = data.get("extra_specs", "{}")
        try:
            extra_specs = json.loads(extra_specs_raw) if extra_specs_raw else {}
        except Exception:
            extra_specs = {}

        product = CatalogueProduct.objects.create(
            model_no=model_no,
            processor=data.get("processor", ""),
            ram=data.get("ram", ""),
            storage=data.get("storage", ""),
            os=data.get("os", ""),
            category=data.get("category", ""),
            description=data.get("description", ""),
            image=image,
        )

        if hasattr(product, 'extra_specs'):
            product.extra_specs = extra_specs
            product.save()

        return JsonResponse({
            "message": "Catalogue product created successfully ✅",
            **_catalogue_product_data(product, request),
        }, status=201)

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
def update_catalogue_product(request, product_id):
    if request.method not in ("POST", "PATCH"):
        return JsonResponse({"error": "Use POST or PATCH method"}, status=405)
    try:
        product = CatalogueProduct.objects.get(id=product_id)

        if request.method == "PATCH":
            if request.content_type and "multipart" in request.content_type:
                data, files = MultiPartParser(
                    request.META, request, request.upload_handlers, request.encoding
                ).parse()
                image = files.get("image")
            else:
                data = request.POST
                image = request.FILES.get("image")
        else:
            data = request.POST
            image = request.FILES.get("image")

        model_no = data.get("model_no", "").strip()
        if model_no and model_no != product.model_no:
            if CatalogueProduct.objects.filter(model_no=model_no).exists():
                return JsonResponse({"error": "Another product with this model_no already exists"}, status=400)
            product.model_no = model_no

        if "processor" in data:
            product.processor = data.get("processor", "")
        if "ram" in data:
            product.ram = data.get("ram", "")
        if "storage" in data:
            product.storage = data.get("storage", "")
        if "os" in data:
            product.os = data.get("os", "")
        if "category" in data:
            product.category = data.get("category", "")
        if "description" in data:
            product.description = data.get("description", "")

        if "extra_specs" in data and hasattr(product, 'extra_specs'):
            try:
                product.extra_specs = json.loads(data.get("extra_specs", "{}"))
            except Exception:
                pass

        if image:
            product.image = image

        product.save()

        return JsonResponse({
            "message": "Catalogue product updated successfully ✅",
            **_catalogue_product_data(product, request),
        }, status=200)

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
        return JsonResponse({"message": "Catalogue product deleted successfully ✅"}, status=200)
    except CatalogueProduct.DoesNotExist:
        return JsonResponse({"error": "Product not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["DELETE"])
def delete_all_catalogue_products(request):
    try:
        count, _ = CatalogueProduct.objects.all().delete()
        return JsonResponse({
            "message": f"✅ {count} products deleted successfully",
            "deleted_count": count
        }, status=200)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


# ══════════════════════════════════════════════════════════
#  DESKTOP BID — HELPER SERIALIZER
# ══════════════════════════════════════════════════════════

def _bid_data(bid, request, status_label=None):
    """DesktopBid object ko dict mein convert karo — sabhi fields ke saath."""
    return {
        "id": bid.id,
        "user_name": bid.user.username if bid.user else "Unknown",
        "submitted_by": bid.user.username if bid.user else "Unknown",
        "bid_no": bid.bid_no,
        "dept_name": bid.dept_name,
        "qty": bid.qty,
        "organization": bid.organization or "",
        "address": bid.address or "",
        "pincode": bid.pincode or "",
        "atc": bid.atc or "",

        # ── Main document ──
        "upload_document": _file_url(request, bid.upload_document),

        # ── ATC / Compliance documents ──
        "atc_special_document": _file_url(request, bid.atc_special_document),
        "general_exp":  _file_url(request, bid.general_exp),
        "general_perf": _file_url(request, bid.general_perf),
        "general_turn": _file_url(request, bid.general_turn),
        "general_cert": _file_url(request, bid.general_cert),
        "general_oem":  _file_url(request, bid.general_oem),
        "general_oemT": _file_url(request, bid.general_oemT),

        # ── Status ──
        "status": status_label if status_label else bid.status,
        "review_status": bid.review_status,

        # ── Dates ──
        "created_at": bid.created_at.strftime("%Y-%m-%d") if bid.created_at else "",
        "date": str(bid.date) if bid.date else "",

        # ── Analyser / Admin ──
        "remark": bid.analyser_note or "",
        "remarks": bid.analyser_note or "",
        "analyser_note": bid.analyser_note or "",
        "analyser_name": bid.analyser_username or "",
        "analyser_username": bid.analyser_username or "",
        "admin_note": bid.admin_note or "",
        "admin_username": bid.admin_username or "",

        # ── Model ──
        "model": bid.model_number or "",
        "model_number": bid.model_number or "",

        # ── Processor ──
        "processor": bid.processor or "",
        "processor_price": bid.processor_price or 0,
        "pro_descp": bid.pro_descp or "",

        # ── RAM ──
        "ram": bid.ram or "",
        "ram_price": bid.ram_price or 0,

        # ── HDD ──
        "hdd": bid.hdd or "",
        "hdd_price": bid.hdd_price or 0,

        # ── SSD ──
        "ssd": bid.ssd1 or "",
        "ssd_price": bid.ssd1_price or 0,
        "ssd1": bid.ssd1 or "",
        "ssd1_price": bid.ssd1_price or 0,
        "ssd2": bid.ssd2 or "",
        "ssd2_price": bid.ssd2_price or 0,

        # ── OS ──
        "os": bid.os or "",
        "os_price": bid.os_price or 0,

        # ── DVD ──
        "dvd": bid.dvd or "",
        "dvd_price": bid.dvd_price or 0,

        # ── WiFi ──
        "wifi": bid.wifi or "",
        "wifi_price": bid.wifi_price or 0,

        # ── Monitor ──
        "monitor": bid.monitor or "",
        "monitor_price": bid.monitor_price or 0,

        # ── Cabinet ──
        "cabinet": bid.cabinet or "",
        "cabinet_price": bid.cabinet_price or 0,

        # ── Keyboard ──
        "keyboard": bid.keyboard or "",
        "keyboard_price": bid.keyboard_price or 0,

        # ── Warranty ──
        "warranty": bid.warranty or "",
        "warranty_price": bid.warranty_price or 0,

        # ── Motherboard ──
        "motherboard": bid.motherboard or "",
        "motherboard_price": bid.motherboard_price or 0,
        "motherboard_descp": bid.motherboard_descp or "",

        # ── Extra ──
        "epbg": bid.epbg or 0,
        "freightInstallation": bid.freightInstallation or "",
        "freightInstallation_price": bid.freightInstallation_price or 0,
        "hddreturnable": bid.hddreturnable or "",
        "hddreturnable_price": bid.hddreturnable_price or 0,

        # ── Software / GP ──
        "software1": bid.software1 or "",
        "gp": bid.gp or "",
    }


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
            qty=int(data.get("qty", 0)),
            address=data.get("address", ""),
            pincode=data.get("pincode", ""),
            atc=data.get("atc", ""),
            upload_document=request.FILES.get("upload_document"),
            atc_special_document=request.FILES.get("atc_special_document"),
            general_exp=request.FILES.get("general_exp"),
            general_perf=request.FILES.get("general_perf"),
            general_turn=request.FILES.get("general_turn"),
            general_cert=request.FILES.get("general_cert"),
            general_oem=request.FILES.get("general_oem"),
            general_oemT=request.FILES.get("general_oemT"),
            status="draft",
            processor="",
            ram="",
            os="",
            monitor="",
            cabinet="",
            warranty="",
            motherboard="",
            software1="",
            gp="",
            date="2000-01-01",
        )

        return JsonResponse({
            "message": "Desktop Bid Created Successfully",
            "bid_id": bid.id,
            "user": user.username,
            "document": _file_url(request, bid.upload_document),
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

        bid.processor = data.get("processor", bid.processor)
        bid.processor_price = safe_float(data.get("processor_price"), bid.processor_price)
        bid.pro_descp = data.get("pro_descp", bid.pro_descp)

        bid.ram = data.get("ram", bid.ram)
        bid.ram_price = safe_float(data.get("ram_price"), bid.ram_price)

        bid.hdd = data.get("hdd", bid.hdd)
        bid.hdd_price = safe_float(data.get("hdd_price"), bid.hdd_price)

        bid.ssd1 = data.get("ssd", bid.ssd1)
        bid.ssd1_price = safe_float(data.get("ssd_price"), bid.ssd1_price)
        bid.ssd2 = data.get("ssd2", bid.ssd2)
        bid.ssd2_price = safe_float(data.get("ssd2_price"), bid.ssd2_price)

        bid.software1 = data.get("software1", bid.software1)
        bid.gp = data.get("gp", bid.gp)

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

        if data.get("date"):
            bid.date = data.get("date")
        bid.epbg = safe_float(data.get("epbg"), bid.epbg)

        bid.freightInstallation = data.get("freightInstallation", bid.freightInstallation)
        freight_price = data.get("freightInstallation_price")
        if freight_price and freight_price != "price":
            bid.freightInstallation_price = safe_float(freight_price, bid.freightInstallation_price)

        bid.hddreturnable = data.get("hddreturnable", bid.hddreturnable)
        if data.get("hddreturnable_price"):
            bid.hddreturnable_price = safe_float(data.get("hddreturnable_price"), bid.hddreturnable_price)

        bid.status = "configured"
        bid.save()

        return JsonResponse({"success": True, "bid_id": bid.id}, status=200)

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

        model = data.get("model", "").strip()
        if not model:
            return JsonResponse({"error": "Model number required"}, status=400)

        bid.model_number = model
        bid.status = "complete"
        bid.save()

        return JsonResponse({
            "success": True,
            "bid_id": bid.id,
            "model_number": bid.model_number
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


# ══════════════════════════════════════════════════════════
#  LIST BIDS
# ══════════════════════════════════════════════════════════
@csrf_exempt
@require_http_methods(["GET"])
def list_desktop_bids(request):
    try:
        status_filter = request.GET.get("status", "pending")
        role = request.GET.get("role", "analyser")

        if role == "admin":
            status_map = {
                "pending":    "reviewed",
                "re-analyze": "re-analyze",
                "approved":   "approved",
            }
            db_status = status_map.get(status_filter, "reviewed")
        else:
            db_status = status_filter

        bids = DesktopBid.objects.filter(
            review_status=db_status,
            status__in=["complete", "configured"],
        ).order_by("-created_at")

        result = [_bid_data(bid, request, status_label=status_filter) for bid in bids]
        return JsonResponse(result, safe=False, status=200)

    except Exception as e:
        print("ERROR:", str(e))
        return JsonResponse({"error": str(e)}, status=400)


# ══════════════════════════════════════════════════════════
#  GET SINGLE BID
# ══════════════════════════════════════════════════════════
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


# ══════════════════════════════════════════════════════════
#  ANALYSER REVIEW
# ══════════════════════════════════════════════════════════
@csrf_exempt
@require_http_methods(["PATCH"])
def review_desktop_bid(request, bid_id):
    try:
        bid = DesktopBid.objects.get(id=bid_id)
        data = json.loads(request.body)

        bid.bid_no    = data.get("bid_no", bid.bid_no)
        bid.dept_name = data.get("dept_name", bid.dept_name)
        bid.organization = data.get("organization", bid.organization)
        bid.address   = data.get("address", bid.address)
        bid.pincode   = data.get("pincode", bid.pincode)
        bid.atc       = data.get("atc", bid.atc)
        if data.get("qty"):
            bid.qty = int(data.get("qty"))
        if data.get("model_number"):
            bid.model_number = data.get("model_number")

        bid.processor       = data.get("processor", bid.processor)
        bid.processor_price = safe_float(data.get("processor_price"), bid.processor_price)
        bid.pro_descp       = data.get("pro_descp", bid.pro_descp)
        bid.ram             = data.get("ram", bid.ram)
        bid.ram_price       = safe_float(data.get("ram_price"), bid.ram_price)
        bid.hdd             = data.get("hdd", bid.hdd)
        bid.hdd_price       = safe_float(data.get("hdd_price"), bid.hdd_price)
        bid.ssd1            = data.get("ssd1") or data.get("ssd") or bid.ssd1
        bid.ssd1_price      = safe_float(data.get("ssd1_price") or data.get("ssd_price"), bid.ssd1_price)
        bid.ssd2            = data.get("ssd2", bid.ssd2)
        bid.ssd2_price      = safe_float(data.get("ssd2_price"), bid.ssd2_price)
        bid.software1       = data.get("software1", bid.software1)
        bid.gp              = data.get("gp", bid.gp)
        bid.os              = data.get("os", bid.os)
        bid.os_price        = safe_float(data.get("os_price"), bid.os_price)
        bid.dvd             = data.get("dvd", bid.dvd)
        bid.dvd_price       = safe_float(data.get("dvd_price"), bid.dvd_price)
        bid.wifi            = data.get("wifi", bid.wifi)
        bid.wifi_price      = safe_float(data.get("wifi_price"), bid.wifi_price)
        bid.monitor         = data.get("monitor", bid.monitor)
        bid.monitor_price   = safe_float(data.get("monitor_price"), bid.monitor_price)
        bid.cabinet         = data.get("cabinet", bid.cabinet)
        bid.cabinet_price   = safe_float(data.get("cabinet_price"), bid.cabinet_price)
        bid.keyboard        = data.get("keyboard", bid.keyboard)
        bid.keyboard_price  = safe_float(data.get("keyboard_price"), bid.keyboard_price)
        bid.warranty        = data.get("warranty", bid.warranty)
        bid.warranty_price  = safe_float(data.get("warranty_price"), bid.warranty_price)
        bid.motherboard        = data.get("motherboard", bid.motherboard)
        bid.motherboard_price  = safe_float(data.get("motherboard_price"), bid.motherboard_price)
        bid.motherboard_descp  = data.get("motherboard_descp", bid.motherboard_descp)
        if data.get("date"):
            bid.date = data.get("date")
        bid.epbg                     = safe_float(data.get("epbg"), bid.epbg)
        bid.freightInstallation       = data.get("freightInstallation", bid.freightInstallation)
        bid.freightInstallation_price = safe_float(data.get("freightInstallation_price"), bid.freightInstallation_price)
        bid.hddreturnable             = data.get("hddreturnable", bid.hddreturnable)
        bid.hddreturnable_price       = safe_float(data.get("hddreturnable_price"), bid.hddreturnable_price)
        bid.review_status             = data.get("status", "reviewed")
        bid.analyser_note             = data.get("analyser_note", bid.analyser_note or "")
        bid.analyser_username         = data.get("analyser_username", bid.analyser_username or "")
        bid.save()

        return JsonResponse({"success": True, "bid_id": bid.id, "review_status": bid.review_status})

    except DesktopBid.DoesNotExist:
        return JsonResponse({"error": "Bid not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


# ══════════════════════════════════════════════════════════
#  ADMIN REVIEW
# ══════════════════════════════════════════════════════════
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

        bid.bid_no       = data.get("bid_no", bid.bid_no)
        bid.dept_name    = data.get("dept_name", bid.dept_name)
        bid.organization = data.get("organization", bid.organization)
        bid.address      = data.get("address", bid.address)
        bid.pincode      = data.get("pincode", bid.pincode)
        bid.atc          = data.get("atc", bid.atc)
        if data.get("qty"):
            bid.qty = int(data.get("qty"))
        if data.get("model_number"):
            bid.model_number = data.get("model_number")

        bid.processor       = data.get("processor", bid.processor)
        bid.processor_price = safe_float(data.get("processor_price"), bid.processor_price)
        bid.pro_descp       = data.get("pro_descp", bid.pro_descp)
        bid.ram             = data.get("ram", bid.ram)
        bid.ram_price       = safe_float(data.get("ram_price"), bid.ram_price)
        bid.hdd             = data.get("hdd", bid.hdd)
        bid.hdd_price       = safe_float(data.get("hdd_price"), bid.hdd_price)
        bid.ssd1            = data.get("ssd1") or data.get("ssd") or bid.ssd1
        bid.ssd1_price      = safe_float(data.get("ssd1_price") or data.get("ssd_price"), bid.ssd1_price)
        bid.ssd2            = data.get("ssd2", bid.ssd2)
        bid.ssd2_price      = safe_float(data.get("ssd2_price"), bid.ssd2_price)
        bid.software1       = data.get("software1", bid.software1)
        bid.gp              = data.get("gp", bid.gp)
        bid.os              = data.get("os", bid.os)
        bid.os_price        = safe_float(data.get("os_price"), bid.os_price)
        bid.dvd             = data.get("dvd", bid.dvd)
        bid.dvd_price       = safe_float(data.get("dvd_price"), bid.dvd_price)
        bid.wifi            = data.get("wifi", bid.wifi)
        bid.wifi_price      = safe_float(data.get("wifi_price"), bid.wifi_price)
        bid.monitor         = data.get("monitor", bid.monitor)
        bid.monitor_price   = safe_float(data.get("monitor_price"), bid.monitor_price)
        bid.cabinet         = data.get("cabinet", bid.cabinet)
        bid.cabinet_price   = safe_float(data.get("cabinet_price"), bid.cabinet_price)
        bid.keyboard        = data.get("keyboard", bid.keyboard)
        bid.keyboard_price  = safe_float(data.get("keyboard_price"), bid.keyboard_price)
        bid.warranty        = data.get("warranty", bid.warranty)
        bid.warranty_price  = safe_float(data.get("warranty_price"), bid.warranty_price)
        bid.motherboard        = data.get("motherboard", bid.motherboard)
        bid.motherboard_price  = safe_float(data.get("motherboard_price"), bid.motherboard_price)
        bid.motherboard_descp  = data.get("motherboard_descp", bid.motherboard_descp)
        if data.get("date"):
            bid.date = data.get("date")
        bid.epbg                     = safe_float(data.get("epbg"), bid.epbg)
        bid.freightInstallation       = data.get("freightInstallation", bid.freightInstallation)
        bid.freightInstallation_price = safe_float(data.get("freightInstallation_price"), bid.freightInstallation_price)
        bid.hddreturnable             = data.get("hddreturnable", bid.hddreturnable)
        bid.hddreturnable_price       = safe_float(data.get("hddreturnable_price"), bid.hddreturnable_price)
        bid.review_status  = action
        bid.admin_note     = data.get("admin_note", "").strip()
        bid.admin_username = data.get("admin_username", "").strip()
        bid.save()

        return JsonResponse({
            "success": True,
            "bid_id": bid.id,
            "review_status": bid.review_status,
            "message": "✅ Bid approved successfully!" if action == "approved" else "⚠️ Bid sent back to analyser.",
        })

    except DesktopBid.DoesNotExist:
        return JsonResponse({"error": "Bid not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


# ══════════════════════════════════════════════════════════
#  PDF SPEC EXTRACTION
# ══════════════════════════════════════════════════════════
import re
import os
import tempfile
import pdfplumber
import fitz


def _extract_text_from_pdf(temp_path):
    text = ""
    try:
        with pdfplumber.open(temp_path) as pdf:
            for page in pdf.pages:
                t = page.extract_text()
                if t:
                    text += "\n" + t
    except Exception:
        pass

    if not text.strip():
        doc = fitz.open(temp_path)
        for page in doc:
            text += page.get_text()
        doc.close()

    return text


def _label_value(text, label, multiline=False):
    escaped = re.escape(label)
    if multiline:
        pattern = rf"{escaped}\s+(.+?)(?=\n[A-Z][A-Za-z\s]+\n|\Z)"
        m = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
        if m:
            val = m.group(1).strip()
            return re.sub(r'\s+', ' ', val)
        return ""
    pattern = rf"{escaped}\s+(.+?)(?=\n|$)"
    m = re.search(pattern, text, re.IGNORECASE)
    if m:
        val = m.group(1).strip()
        val = re.sub(r'\s*https?://\S+', '', val)
        val = re.sub(r'\s*Product Compare.*$', '', val)
        return val.strip()
    return ""


def _clean_model_no(raw):
    if not raw:
        return ""
    raw = re.sub(r'[()]', '', raw)
    raw = re.sub(r'\s+', '', raw)
    return raw.strip()


@csrf_exempt
@require_http_methods(["POST"])
def extract_specs_from_pdf(request):
    temp_path = None
    try:
        pdf_file = request.FILES.get("pdf")
        if not pdf_file:
            return JsonResponse({"error": "PDF file required"}, status=400)

        pdf_bytes = pdf_file.read()
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(pdf_bytes)
            temp_path = tmp.name

        raw_text = _extract_text_from_pdf(temp_path)
        flat = re.sub(r'\s+', ' ', raw_text).strip()

        model_no = ""
        m = re.search(r'\(([A-Z0-9][A-Z0-9\-_\/\.]+\n[A-Z0-9\-_\/\.]+)\)', raw_text)
        if m:
            model_no = _clean_model_no(m.group(1))
        else:
            m = re.search(r'\(([A-Z0-9][A-Z0-9\-_\/\.]{4,})\)', raw_text)
            if m:
                model_no = m.group(1).strip()
            else:
                m = re.search(r'gem\.gov\.in/[^/]+/[^/]+-([a-z0-9][a-z0-9\-]+)/p-', flat, re.IGNORECASE)
                if m:
                    model_no = m.group(1).upper()
                else:
                    model_no = _label_value(flat, "Model No.") or _label_value(flat, "Part Number") or ""

        category = ""
        lower = flat.lower()
        if re.search(r'\baio\b|all[\s\-]in[\s\-]one', lower):
            category = "AIO"
        elif "workstation" in lower:
            category = "Workstation"
        elif "printer" in lower:
            category = "Printer"
        elif "toner" in lower:
            category = "Toner"
        elif "desktop" in lower:
            category = "Desktop"

        description = _label_value(flat, "Description of Stores") or _label_value(flat, "Description of Store") or ""
        if not description:
            m = re.search(r'Description of Stores?\s+(.+?)(?=Computer Type|Processor Number|$)', flat, re.IGNORECASE)
            if m:
                description = re.sub(r'\s+', ' ', m.group(1)).strip()

        computer_type = _label_value(flat, "Computer Type")

        processor = _label_value(flat, "Processor Number")
        if not processor:
            pm = re.search(
                r'(Intel\s+Core\s+(?:Ultra\s+)?i[3579][-\s]\d{4,5}[A-Z]*|'
                r'Intel\s+Core\s+i[3579]\s+\d{4,5}[A-Z]*|'
                r'AMD\s+Ryzen\s+[3579]\s+\d{4,5}[A-Z]*|'
                r'Intel\s+Xeon\s+[A-Za-z0-9\-]+)',
                flat
            )
            processor = pm.group(1).strip() if pm else ""

        os_val = (
            _label_value(flat, "Factory Pre-loaded Operating System by Desktop OEM") or
            _label_value(flat, "Factory Pre-loaded Operating System by Desktop") or
            _label_value(flat, "Operating System (Factory Preloaded with Certification)") or
            _label_value(flat, "Factory Pre-Loaded Operating System")
        )
        if not os_val:
            m = re.search(r'(Windows\s+1[01][^\n,]{0,30})', flat, re.IGNORECASE)
            os_val = m.group(1).strip() if m else ""

        ram_type = _label_value(flat, "Type of RAM")
        ram_size = (
            _label_value(flat, "RAM Size (Memory Card/Module) (in GB) (Capacity to be installed in the System)") or
            _label_value(flat, "RAM Size Provided with the System (GB)") or
            _label_value(flat, "RAM Size (GB)")
        )
        ram = f"{ram_size} GB {ram_type}".strip() if ram_size and ram_type else (f"{ram_size} GB".strip() if ram_size else "")

        storage_type    = _label_value(flat, "Type of Storage Installed with the System") or _label_value(flat, "Type of Storage Installed")
        ssd_capacity    = _label_value(flat, "SSD - Storage Capacity (in GB)") or _label_value(flat, "SSD Storage Capacity (in GB)")
        hdd_capacity    = _label_value(flat, "HDD - Storage Capacity (in GB)") or _label_value(flat, "HDD Storage Capacity (in GB)")
        storage_capacity = (
            _label_value(flat, "Primary Storage (Boot Drive) Capacity (in GB)") or
            _label_value(flat, "Storage Capacity (in GB)") or
            ssd_capacity
        )

        extra = {}

        def ex(label, *alts):
            val = _label_value(flat, label)
            if not val:
                for alt in alts:
                    val = _label_value(flat, alt)
                    if val:
                        break
            if val:
                extra[label] = val

        if computer_type:
            extra["Computer Type"] = computer_type

        ex("Graphics Type")
        ex("Graphic Card Make and Model - Must declare", "Graphic Card Number")
        ex("Trusted Platform Module")
        ex("Expansion Slots (PCIe x 1)")
        ex("Expansion Slots (PCIe x 16)")
        ex("Expansion Slots (M Dot 2) for SSD")
        if storage_type:
            extra["Type of Storage Installed with the System"] = storage_type
        if ssd_capacity:
            extra["SSD - Storage Capacity (in GB)"] = ssd_capacity
        if hdd_capacity:
            extra["HDD - Storage Capacity (in GB)"] = hdd_capacity
        if ram_type:
            extra["Type of RAM"] = ram_type
        ex("Memory Expandable Up To (in GB)")
        ex("Total Numbers of DIMM Slots Available")
        ex("Cabinet Form Factor")
        ex("Optical Drive")
        ex("Audio Interface Type")
        ex("Type of Ethernet Ports")
        ex("Number of Ethernet Ports")
        ex("Number of USB Type A Port (Version 2 Point 0)")
        ex("Number of USB Type A Port (Version 3 point 2 Gen 1)")
        ex("Number of USB Ports Type C")
        ex("Number of VGA Ports")
        ex("Number of HDMI Ports")
        ex("Number of DP Ports")
        ex("Availibility of Monitor", "Availability of Monitor")
        ex("Panel Type")
        ex("Display Technology")
        ex("Screen Size (in CMs)")
        ex("Maximum Resolution (Pixels)")
        ex("Image Aspect Ratio")
        ex("Brightness (in Nits)")
        ex("Refresh Rate (in Hz)")
        ex("Monitor Port")
        ex("Integrated Webcam with Mic")
        ex("Speaker")
        ex("Mouse Connectivity")
        ex("Keyboard Connectivity")
        ex("Type of Keyboard")
        ex("Power Supply Capacity- Maximum (in Watt)")
        ex("Display Size - Diagonal (in Inches)")
        ex("Stand")
        ex("Number of Ports")
        ex("Controller Type")
        ex("RAID Level")
        ex("Wireless Connectivity")
        ex("Print Speed B&W (ppm)")
        ex("Print Speed Color (ppm)")
        ex("Duplex Printing")
        ex("Paper Size Supported")

        warranty = (
            _label_value(flat, "On Site OEM Warranty (in Year)") or
            _label_value(flat, "Warranty (in Year)") or
            _label_value(flat, "Warranty")
        )
        if warranty:
            extra["On Site OEM Warranty (in Year)"] = warranty

        ex("Availibility of RoHS Certificate")

        return JsonResponse({
            "model_no": model_no,
            "category": category,
            "description": description,
            "processor": processor,
            "ram": ram,
            "storage": storage_capacity,
            "os": os_val,
            "extra_specs": extra,
            "raw_text": raw_text[:2000],
        }, status=200)

    except Exception as e:
        import traceback
        return JsonResponse({"error": str(e), "trace": traceback.format_exc()}, status=500)

    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.unlink(temp_path)
            except Exception:
                pass