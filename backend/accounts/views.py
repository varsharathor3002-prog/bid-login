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


# ══════════════════════════════════════════════════════════
#  CATALOGUE PRODUCT APIs
# ══════════════════════════════════════════════════════════

def _catalogue_product_data(product, request):
    return {
        "id": product.id,
        "model_no": product.model_no,
        "processor": product.processor,
        "ram": product.ram or "",
        "storage": product.storage or "",
        "os": product.os or "",
        "category": product.category or "",
        "description": product.description or "",
        "image": (
            request.build_absolute_uri(product.image.url)
            if product.image else ""
        ),
        "created_at": product.created_at.strftime("%Y-%m-%d") if product.created_at else "",
    }


@csrf_exempt
@require_http_methods(["GET"])
def list_catalogue_products(request):
    """
    GET /api/catalogue/
    Optional query params:
      - search=<str>   → filter by model_no or processor
      - category=<str> → filter by category (Desktop, AIO, Workstation)
    Returns list of all catalogue products (filtered from Excel — Intel 12th gen+, AMD 56xx/57xx/58xxG).
    """
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
    """
    GET /api/catalogue/<id>/
    Returns single catalogue product detail.
    """
    try:
        product = CatalogueProduct.objects.get(id=product_id)
        return JsonResponse(_catalogue_product_data(product, request), status=200)
    except CatalogueProduct.DoesNotExist:
        return JsonResponse({"error": "Product not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def create_catalogue_product(request):
    """
    POST /api/catalogue/create/
    Multipart form-data:
      - model_no      (required, unique)
      - processor     (required)
      - ram
      - storage
      - os
      - category
      - description
      - image         (file, optional)
    """
    try:
        data = request.POST
        image = request.FILES.get("image")

        model_no = data.get("model_no", "").strip()
        processor = data.get("processor", "").strip()

        if not model_no:
            return JsonResponse({"error": "model_no is required"}, status=400)
        if not processor:
            return JsonResponse({"error": "processor is required"}, status=400)
        if CatalogueProduct.objects.filter(model_no=model_no).exists():
            return JsonResponse({"error": "A product with this model_no already exists"}, status=400)

        product = CatalogueProduct.objects.create(
            model_no=model_no,
            processor=processor,
            ram=data.get("ram", ""),
            storage=data.get("storage", ""),
            os=data.get("os", ""),
            category=data.get("category", ""),
            description=data.get("description", ""),
            image=image,
        )

        return JsonResponse({
            "message": "Catalogue product created successfully ✅",
            **_catalogue_product_data(product, request),
        }, status=201)

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def update_catalogue_product(request, product_id):
    """
    POST /api/catalogue/<id>/update/
    Multipart form-data (all fields optional — only provided fields are updated):
      - model_no, processor, ram, storage, os, category, description, image
    """
    try:
        product = CatalogueProduct.objects.get(id=product_id)
        data = request.POST
        image = request.FILES.get("image")

        model_no = data.get("model_no", "").strip()
        if model_no and model_no != product.model_no:
            if CatalogueProduct.objects.filter(model_no=model_no).exists():
                return JsonResponse({"error": "Another product with this model_no already exists"}, status=400)
            product.model_no = model_no

        if data.get("processor"):
            product.processor = data.get("processor").strip()
        if "ram" in data:
            product.ram = data.get("ram")
        if "storage" in data:
            product.storage = data.get("storage")
        if "os" in data:
            product.os = data.get("os")
        if "category" in data:
            product.category = data.get("category")
        if "description" in data:
            product.description = data.get("description")
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
    """
    DELETE /api/catalogue/<id>/delete/
    Permanently removes the catalogue product.
    """
    try:
        product = CatalogueProduct.objects.get(id=product_id)
        product.delete()
        return JsonResponse({"message": "Catalogue product deleted successfully ✅"}, status=200)
    except CatalogueProduct.DoesNotExist:
        return JsonResponse({"error": "Product not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


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

        upload_document = request.FILES.get("upload_document")

        bid = DesktopBid.objects.create(
            user=user,
            bid_no=data.get("bid_no", ""),
            dept_name=data.get("dept_name", ""),
            qty=int(data.get("qty", 0)),
            address=data.get("address", ""),
            pincode=data.get("pincode", ""),
            atc=data.get("atc", ""),
            upload_document=upload_document,
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
            "document": bid.upload_document.url if bid.upload_document else ""
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
        price = get_price_for("processor", data.get("processor", ""))
        return JsonResponse({"price": price})

@csrf_exempt
def check_ram(request):
    if request.method == "POST":
        data = json.loads(request.body)
        price = get_price_for("ram", data.get("ram", ""))
        return JsonResponse({"price": price})

@csrf_exempt
def check_hdd(request):
    if request.method == "POST":
        data = json.loads(request.body)
        price = get_price_for("hdd", data.get("hdd", ""))
        return JsonResponse({"price": price})

@csrf_exempt
def check_ssd(request):
    if request.method == "POST":
        data = json.loads(request.body)
        price = get_price_for("ssd", data.get("ssd", ""))
        return JsonResponse({"price": price})

@csrf_exempt
def check_os(request):
    if request.method == "POST":
        data = json.loads(request.body)
        price = get_price_for("os", data.get("os", ""))
        return JsonResponse({"price": price})

@csrf_exempt
def check_dvd(request):
    if request.method == "POST":
        data = json.loads(request.body)
        price = get_price_for("dvd", data.get("dvd", ""))
        return JsonResponse({"price": price})

@csrf_exempt
def check_wifi(request):
    if request.method == "POST":
        data = json.loads(request.body)
        price = get_price_for("wifi", data.get("wifi", ""))
        return JsonResponse({"price": price})

@csrf_exempt
def check_motherboard(request):
    if request.method == "POST":
        data = json.loads(request.body)
        price = get_price_for("motherboard", data.get("motherboard", ""))
        return JsonResponse({"price": price})

@csrf_exempt
def check_monitor_size(request):
    if request.method == "POST":
        data = json.loads(request.body)
        price = get_price_for("monitor", data.get("monitor", ""))
        return JsonResponse({"price": price})

@csrf_exempt
def check_cabinet_type(request):
    if request.method == "POST":
        data = json.loads(request.body)
        price = get_price_for("cabinet", data.get("cabinet", ""))
        return JsonResponse({"price": price})

@csrf_exempt
def check_keyboard(request):
    if request.method == "POST":
        data = json.loads(request.body)
        price = get_price_for("keyboard", data.get("keyboard", ""))
        return JsonResponse({"price": price})

@csrf_exempt
def check_warranty(request):
    if request.method == "POST":
        data = json.loads(request.body)
        price = get_price_for("warranty", data.get("warranty", ""))
        return JsonResponse({"price": price})


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
                "pending": "reviewed",
                "re-analyze": "re-analyze",
                "approved": "approved",
            }
            db_status = status_map.get(status_filter, "reviewed")
        else:
            db_status = status_filter

        bids = DesktopBid.objects.filter(
            review_status=db_status,
            status="complete",
        ).order_by("-created_at")

        result = []
        for bid in bids:
            result.append({
                "id": bid.id,
                "user_name": bid.user.username if bid.user else "Unknown",
                "submitted_by": bid.user.username if bid.user else "Unknown",
                "bid_no": bid.bid_no,
                "dept_name": bid.dept_name,
                "qty": bid.qty,
                "address": bid.address or "",
                "pincode": bid.pincode or "",
                "atc": bid.atc or "",
                "upload_document": (
                    request.build_absolute_uri(bid.upload_document.url)
                    if bid.upload_document else ""
                ),
                "status": status_filter,
                "review_status": bid.review_status,
                "created_at": bid.created_at.strftime("%Y-%m-%d") if bid.created_at else "",
                "date": str(bid.date) if bid.date else "",
                "remark": bid.analyser_note or "",
                "remarks": bid.analyser_note or "",
                "model": bid.model_number or "",
                "model_number": bid.model_number or "",
                "analyser_name": bid.analyser_username or "",
                "analyser_note": bid.analyser_note or "",
                "admin_note": bid.admin_note or "",
                "admin_username": bid.admin_username or "",
                "processor": bid.processor or "",
                "processor_price": bid.processor_price or 0,
                "pro_descp": bid.pro_descp or "",
                "ram": bid.ram or "",
                "ram_price": bid.ram_price or 0,
                "hdd": bid.hdd or "",
                "hdd_price": bid.hdd_price or 0,
                "ssd": bid.ssd1 or "",
                "ssd_price": bid.ssd1_price or 0,
                "ssd1": bid.ssd1 or "",
                "ssd1_price": bid.ssd1_price or 0,
                "ssd2": bid.ssd2 or "",
                "ssd2_price": bid.ssd2_price or 0,
                "os": bid.os or "",
                "os_price": bid.os_price or 0,
                "dvd": bid.dvd or "",
                "dvd_price": bid.dvd_price or 0,
                "wifi": bid.wifi or "",
                "wifi_price": bid.wifi_price or 0,
                "monitor": bid.monitor or "",
                "monitor_price": bid.monitor_price or 0,
                "cabinet": bid.cabinet or "",
                "cabinet_price": bid.cabinet_price or 0,
                "keyboard": bid.keyboard or "",
                "keyboard_price": bid.keyboard_price or 0,
                "warranty": bid.warranty or "",
                "warranty_price": bid.warranty_price or 0,
                "motherboard": bid.motherboard or "",
                "motherboard_price": bid.motherboard_price or 0,
                "motherboard_descp": bid.motherboard_descp or "",
                "epbg": bid.epbg or 0,
                "freightInstallation": bid.freightInstallation or "",
                "freightInstallation_price": bid.freightInstallation_price or 0,
                "hddreturnable": bid.hddreturnable or "",
                "hddreturnable_price": bid.hddreturnable_price or 0,
                "software1": bid.software1 or "",
                "gp": bid.gp or "",
            })

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

        data = {
            "id": bid.id,
            "bid_no": bid.bid_no,
            "dept_name": bid.dept_name,
            "qty": bid.qty,
            "address": bid.address or "",
            "pincode": bid.pincode or "",
            "atc": bid.atc or "",
            "upload_document": (
                request.build_absolute_uri(bid.upload_document.url)
                if bid.upload_document else ""
            ),
            "status": bid.status,
            "review_status": bid.review_status,
            "user_name": bid.user.username if bid.user else "Unknown",
            "submitted_by": bid.user.username if bid.user else "Unknown",
            "model": bid.model_number or "",
            "model_number": bid.model_number or "",
            "analyser_note": bid.analyser_note or "",
            "analyser_username": bid.analyser_username or "",
            "analyser_name": bid.analyser_username or "",
            "remark": bid.analyser_note or "",
            "remarks": bid.analyser_note or "",
            "admin_note": bid.admin_note or "",
            "admin_username": bid.admin_username or "",
            "processor": bid.processor or "",
            "processor_price": bid.processor_price or 0,
            "pro_descp": bid.pro_descp or "",
            "ram": bid.ram or "",
            "ram_price": bid.ram_price or 0,
            "hdd": bid.hdd or "",
            "hdd_price": bid.hdd_price or 0,
            "ssd": bid.ssd1 or "",
            "ssd_price": bid.ssd1_price or 0,
            "ssd1": bid.ssd1 or "",
            "ssd1_price": bid.ssd1_price or 0,
            "ssd2": bid.ssd2 or "",
            "ssd2_price": bid.ssd2_price or 0,
            "software1": bid.software1 or "",
            "gp": bid.gp or "",
            "os": bid.os or "",
            "os_price": bid.os_price or 0,
            "dvd": bid.dvd or "",
            "dvd_price": bid.dvd_price or 0,
            "wifi": bid.wifi or "",
            "wifi_price": bid.wifi_price or 0,
            "monitor": bid.monitor or "",
            "monitor_price": bid.monitor_price or 0,
            "cabinet": bid.cabinet or "",
            "cabinet_price": bid.cabinet_price or 0,
            "keyboard": bid.keyboard or "",
            "keyboard_price": bid.keyboard_price or 0,
            "warranty": bid.warranty or "",
            "warranty_price": bid.warranty_price or 0,
            "motherboard": bid.motherboard or "",
            "motherboard_price": bid.motherboard_price or 0,
            "motherboard_descp": bid.motherboard_descp or "",
            "date": str(bid.date) if bid.date else "",
            "epbg": bid.epbg or 0,
            "freightInstallation": bid.freightInstallation or "",
            "freightInstallation_price": bid.freightInstallation_price or 0,
            "hddreturnable": bid.hddreturnable or "",
            "hddreturnable_price": bid.hddreturnable_price or 0,
            "created_at": bid.created_at.strftime("%Y-%m-%d") if bid.created_at else "",
        }

        return JsonResponse(data, status=200)

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

        bid.bid_no = data.get("bid_no", bid.bid_no)
        bid.dept_name = data.get("dept_name", bid.dept_name)
        bid.address = data.get("address", bid.address)
        bid.pincode = data.get("pincode", bid.pincode)
        bid.atc = data.get("atc", bid.atc)
        if data.get("qty"):
            bid.qty = int(data.get("qty"))
        if data.get("model_number"):
            bid.model_number = data.get("model_number")

        bid.processor = data.get("processor", bid.processor)
        bid.processor_price = safe_float(data.get("processor_price"), bid.processor_price)
        bid.pro_descp = data.get("pro_descp", bid.pro_descp)

        bid.ram = data.get("ram", bid.ram)
        bid.ram_price = safe_float(data.get("ram_price"), bid.ram_price)

        bid.hdd = data.get("hdd", bid.hdd)
        bid.hdd_price = safe_float(data.get("hdd_price"), bid.hdd_price)

        bid.ssd1 = data.get("ssd1") or data.get("ssd") or bid.ssd1
        bid.ssd1_price = safe_float(
            data.get("ssd1_price") or data.get("ssd_price"), bid.ssd1_price
        )
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
        bid.freightInstallation_price = safe_float(
            data.get("freightInstallation_price"), bid.freightInstallation_price
        )
        bid.hddreturnable = data.get("hddreturnable", bid.hddreturnable)
        bid.hddreturnable_price = safe_float(
            data.get("hddreturnable_price"), bid.hddreturnable_price
        )

        bid.review_status = data.get("status", "reviewed")
        bid.analyser_note = data.get("analyser_note", bid.analyser_note or "")
        bid.analyser_username = data.get("analyser_username", bid.analyser_username or "")

        bid.save()

        return JsonResponse({
            "success": True,
            "bid_id": bid.id,
            "review_status": bid.review_status,
        })

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

        bid.bid_no = data.get("bid_no", bid.bid_no)
        bid.dept_name = data.get("dept_name", bid.dept_name)
        bid.address = data.get("address", bid.address)
        bid.pincode = data.get("pincode", bid.pincode)
        bid.atc = data.get("atc", bid.atc)
        if data.get("qty"):
            bid.qty = int(data.get("qty"))
        if data.get("model_number"):
            bid.model_number = data.get("model_number")

        bid.processor = data.get("processor", bid.processor)
        bid.processor_price = safe_float(data.get("processor_price"), bid.processor_price)
        bid.pro_descp = data.get("pro_descp", bid.pro_descp)

        bid.ram = data.get("ram", bid.ram)
        bid.ram_price = safe_float(data.get("ram_price"), bid.ram_price)

        bid.hdd = data.get("hdd", bid.hdd)
        bid.hdd_price = safe_float(data.get("hdd_price"), bid.hdd_price)

        bid.ssd1 = data.get("ssd1") or data.get("ssd") or bid.ssd1
        bid.ssd1_price = safe_float(
            data.get("ssd1_price") or data.get("ssd_price"), bid.ssd1_price
        )
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
        bid.freightInstallation_price = safe_float(
            data.get("freightInstallation_price"), bid.freightInstallation_price
        )
        bid.hddreturnable = data.get("hddreturnable", bid.hddreturnable)
        bid.hddreturnable_price = safe_float(
            data.get("hddreturnable_price"), bid.hddreturnable_price
        )

        bid.review_status = action
        bid.admin_note = data.get("admin_note", "").strip()
        bid.admin_username = data.get("admin_username", "").strip()

        bid.save()

        return JsonResponse({
            "success": True,
            "bid_id": bid.id,
            "review_status": bid.review_status,
            "message": (
                "✅ Bid approved successfully!"
                if action == "approved"
                else "⚠️ Bid sent back to analyser."
            ),
        })

    except DesktopBid.DoesNotExist:
        return JsonResponse({"error": "Bid not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


# ─────────────────────────────────────────────
# ADMIN — Products
# ─────────────────────────────────────────────
def get_products(request):
    products = list(Product.objects.all().order_by("id").values("id", "name"))
    return JsonResponse(products, safe=False)


@csrf_exempt
def add_product(request):
    if request.method == "POST":
        data = json.loads(request.body)
        name = data.get("name")

        if not name:
            return JsonResponse({"error": "Product name required"}, status=400)
        if Product.objects.filter(name=name).exists():
            return JsonResponse({"error": "Product already exists"}, status=400)

        Product.objects.create(name=name)
        return JsonResponse({"message": "Product added successfully ✅"})

    return JsonResponse({"error": "Use POST method"}, status=405)