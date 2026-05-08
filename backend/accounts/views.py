from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.hashers import make_password, check_password
import json
from django.views.decorators.http import require_http_methods
from django.utils import timezone
from .models import User, Product, DesktopBid


# =========================
# ✅ REGISTER
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
# ✅ LOGIN
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


# ─────────────────────────────────────────────
# STEP 1 — Create Bid
# ─────────────────────────────────────────────
@csrf_exempt
@require_http_methods(["POST"])
def create_desktop_bid(request):
    try:
        data = json.loads(request.body)
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
            qty=int(data.get("qty", 0)),
            address=data.get("address", ""),
            pincode=data.get("pincode", ""),
            atc=data.get("atc", ""),
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
        bid.processor_price = float(data.get("processor_price") or bid.processor_price)
        bid.pro_descp = data.get("pro_descp", bid.pro_descp)

        bid.ram = data.get("ram", bid.ram)
        bid.ram_price = float(data.get("ram_price") or bid.ram_price)

        bid.hdd = data.get("hdd", bid.hdd)
        bid.hdd_price = float(data.get("hdd_price") or bid.hdd_price)

        bid.ssd1 = data.get("ssd", bid.ssd1)
        bid.ssd1_price = float(data.get("ssd_price") or bid.ssd1_price)
        bid.ssd2 = data.get("ssd2", bid.ssd2)
        bid.ssd2_price = float(data.get("ssd2_price") or bid.ssd2_price)

        bid.software1 = data.get("software1", bid.software1)
        bid.gp = data.get("gp", bid.gp)

        bid.os = data.get("os", bid.os)
        bid.os_price = float(data.get("os_price") or bid.os_price)

        bid.dvd = data.get("dvd", bid.dvd)
        bid.dvd_price = float(data.get("dvd_price") or bid.dvd_price)

        bid.wifi = data.get("wifi", bid.wifi)
        bid.wifi_price = float(data.get("wifi_price") or bid.wifi_price)

        bid.monitor = data.get("monitor", bid.monitor)
        bid.monitor_price = float(data.get("monitor_price") or bid.monitor_price)

        bid.cabinet = data.get("cabinet", bid.cabinet)
        bid.cabinet_price = float(data.get("cabinet_price") or bid.cabinet_price)

        bid.keyboard = data.get("keyboard", bid.keyboard)
        bid.keyboard_price = float(data.get("keyboard_price") or bid.keyboard_price)

        bid.warranty = data.get("warranty", bid.warranty)
        bid.warranty_price = float(data.get("warranty_price") or bid.warranty_price)

        bid.motherboard = data.get("motherboard", bid.motherboard)
        bid.motherboard_price = float(data.get("motherboard_price") or bid.motherboard_price)
        bid.motherboard_descp = data.get("motherboard_descp", bid.motherboard_descp)

        if data.get("date"):
            bid.date = data.get("date")
        bid.epbg = float(data.get("epbg") or bid.epbg)

        bid.freightInstallation = data.get("freightInstallation", bid.freightInstallation)
        freight_price = data.get("freightInstallation_price")
        if freight_price and freight_price != "price":
            bid.freightInstallation_price = float(freight_price)

        bid.hddreturnable = data.get("hddreturnable", bid.hddreturnable)
        if data.get("hddreturnable_price"):
            bid.hddreturnable_price = float(data.get("hddreturnable_price") or 0)

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

def get_price_for(component, value):
    return 0


# ══════════════════════════════════════════════════════════
#  LIST BIDS
#  GET /api/desktop-bids/list/?status=pending&role=admin
#  GET /api/desktop-bids/list/?status=pending&role=analyser
#
#  Admin status mapping:
#    "pending"    → review_status = "reviewed"
#    "re-analyze" → review_status = "re-analyze"
#    "approved"   → review_status = "approved"
#
#  Analyser status mapping (direct):
#    "pending"    → review_status = "pending"
#    "reviewed"   → review_status = "reviewed"
#    "re-analyze" → review_status = "re-analyze"
# ══════════════════════════════════════════════════════════
@csrf_exempt
@require_http_methods(["GET"])
def list_desktop_bids(request):

    try:

        status_filter = request.GET.get("status", "pending")
        role = request.GET.get("role", "analyser")

        # ADMIN STATUS MAPPING
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

                # USER NAME
                "user_name": (
                    bid.user.username
                    if bid.user
                    else "Unknown"
                ),

                "submitted_by": (
                    bid.user.username
                    if bid.user
                    else "Unknown"
                ),

                # BASIC INFO
                "bid_no": bid.bid_no,
                "dept_name": bid.dept_name,
                "qty": bid.qty,

                # STATUS
                "status": status_filter,
                "review_status": bid.review_status,

                # DATE
                "created_at": (
                    bid.created_at.strftime("%Y-%m-%d")
                    if bid.created_at
                    else ""
                ),

                "date": (
                    str(bid.date)
                    if bid.date
                    else ""
                ),

                # REMARKS
                "remark": bid.analyser_note or "",
                "remarks": bid.analyser_note or "",

                # MODEL
                "model": bid.model_number or "",
                "model_number": bid.model_number or "",

                # ANALYSER
                "analyser_name": bid.analyser_username or "",
                "analyser_note": bid.analyser_note or "",

                # ADDRESS
                "address": bid.address or "",

                # PROCESSOR
                "processor": bid.processor or "",
                "processor_price": bid.processor_price or 0,
                "pro_descp": bid.pro_descp or "",

                # RAM
                "ram": bid.ram or "",
                "ram_price": bid.ram_price or 0,

                # HDD
                "hdd": bid.hdd or "",
                "hdd_price": bid.hdd_price or 0,

                # SSD
                "ssd": bid.ssd1 or "",
                "ssd_price": bid.ssd1_price or 0,

                "ssd2": bid.ssd2 or "",
                "ssd2_price": bid.ssd2_price or 0,

                # OS
                "os": bid.os or "",
                "os_price": bid.os_price or 0,

                # DVD
                "dvd": bid.dvd or "",
                "dvd_price": bid.dvd_price or 0,

                # WIFI
                "wifi": bid.wifi or "",
                "wifi_price": bid.wifi_price or 0,

                # MONITOR
                "monitor": bid.monitor or "",
                "monitor_price": bid.monitor_price or 0,

                # CABINET
                "cabinet": bid.cabinet or "",
                "cabinet_price": bid.cabinet_price or 0,

                # KEYBOARD
                "keyboard": bid.keyboard or "",
                "keyboard_price": bid.keyboard_price or 0,

                # WARRANTY
                "warranty": bid.warranty or "",
                "warranty_price": bid.warranty_price or 0,

                # MOTHERBOARD
                "motherboard": bid.motherboard or "",
                "motherboard_price": bid.motherboard_price or 0,
                "motherboard_descp": bid.motherboard_descp or "",

                # OTHER
                "epbg": bid.epbg or 0,
                "hddreturnable_price": bid.hddreturnable_price or 0,

                # SOFTWARE / GRAPHICS
                "software1": bid.software1 or "",
                "gp": bid.gp or "",
            })

        return JsonResponse(result, safe=False, status=200)

    except Exception as e:

        print("ERROR:", str(e))

        return JsonResponse(
            {"error": str(e)},
            status=400
        )
# ══════════════════════════════════════════════════════════
#  GET SINGLE BID DETAIL
#  GET /api/desktop-bids/<bid_id>/
# ══════════════════════════════════════════════════════════
@csrf_exempt
@require_http_methods(["GET"])
def get_desktop_bid(request, bid_id):
    try:
        bid = DesktopBid.objects.get(id=bid_id)

        data = {
            "id":               bid.id,
            "bid_no":           bid.bid_no,
            "dept_name":        bid.dept_name,
            "qty":              bid.qty,
            "address":          bid.address,
            "pincode":          bid.pincode,
            "atc":              bid.atc,
            "status":           bid.status,
            "review_status":    bid.review_status,
            "user_name":        bid.user.username if bid.user else "Unknown",
            "submitted_by":     bid.user.username if bid.user else "Unknown",
            "processor":        bid.processor,
            "processor_price":  bid.processor_price,
            "pro_descp":        bid.pro_descp or "",
            "ram":              bid.ram,
            "ram_price":        bid.ram_price,
            "hdd":              bid.hdd or "",
            "hdd_price":        bid.hdd_price,
            "ssd":              bid.ssd1 or "",
            "ssd_price":        bid.ssd1_price,
            "ssd2":             bid.ssd2 or "",
            "ssd2_price":       bid.ssd2_price,
            "software1":        bid.software1 or "",
            "gp":               bid.gp or "",
            "os":               bid.os,
            "os_price":         bid.os_price,
            "dvd":              bid.dvd or "",
            "dvd_price":        bid.dvd_price,
            "wifi":             bid.wifi or "",
            "wifi_price":       bid.wifi_price,
            "monitor":          bid.monitor,
            "monitor_price":    bid.monitor_price,
            "cabinet":          bid.cabinet,
            "cabinet_price":    bid.cabinet_price,
            "keyboard":         bid.keyboard or "",
            "keyboard_price":   bid.keyboard_price,
            "warranty":         bid.warranty,
            "warranty_price":   bid.warranty_price,
            "motherboard":      bid.motherboard,
            "motherboard_price":bid.motherboard_price,
            "motherboard_descp":bid.motherboard_descp or "",
            "date":             str(bid.date),
            "epbg":             bid.epbg,
            "freightInstallation":       bid.freightInstallation,
            "freightInstallation_price": bid.freightInstallation_price,
            "hddreturnable":    bid.hddreturnable,
            "hddreturnable_price": bid.hddreturnable_price,
            "model":            bid.model_number or "",
            "model_number":     bid.model_number or "",
            # Analyser fields
            "analyser_note":    bid.analyser_note or "",
            "analyser_username":bid.analyser_username or "",
            "remark":           bid.analyser_note or "",
            "remarks":          bid.analyser_note or "",
            # ✅ Admin note — analyser ko form mein dikhega
            "admin_note":       bid.admin_note or "",
            "admin_username":   bid.admin_username or "",
            "created_at":       bid.created_at.strftime("%Y-%m-%d"),
        }

        return JsonResponse(data, status=200)

    except DesktopBid.DoesNotExist:
        return JsonResponse({"error": "Bid not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


# ══════════════════════════════════════════════════════════
#  ANALYSER — Review Bid
#  PATCH /api/desktop-bids/<bid_id>/review/
# ══════════════════════════════════════════════════════════
@csrf_exempt
@require_http_methods(["PATCH"])
def review_desktop_bid(request, bid_id):
    try:
        bid = DesktopBid.objects.get(id=bid_id)
        data = json.loads(request.body)

        bid.bid_no    = data.get("bid_no", bid.bid_no)
        bid.dept_name = data.get("dept_name", bid.dept_name)
        bid.address   = data.get("address", bid.address)
        if data.get("qty"):
            bid.qty = int(data.get("qty"))

        bid.processor       = data.get("processor", bid.processor)
        bid.processor_price = float(data.get("processor_price") or bid.processor_price)
        bid.pro_descp       = data.get("pro_descp", bid.pro_descp)

        bid.ram       = data.get("ram", bid.ram)
        bid.ram_price = float(data.get("ram_price") or bid.ram_price)

        bid.hdd       = data.get("hdd", bid.hdd)
        bid.hdd_price = float(data.get("hdd_price") or bid.hdd_price)

        bid.ssd1       = data.get("ssd", bid.ssd1)
        bid.ssd1_price = float(data.get("ssd_price") or bid.ssd1_price)
        bid.ssd2       = data.get("ssd2", bid.ssd2)
        bid.ssd2_price = float(data.get("ssd2_price") or bid.ssd2_price)

        bid.software1 = data.get("software1", bid.software1)
        bid.gp        = data.get("gp", bid.gp)

        bid.os       = data.get("os", bid.os)
        bid.os_price = float(data.get("os_price") or bid.os_price)

        bid.dvd       = data.get("dvd", bid.dvd)
        bid.dvd_price = float(data.get("dvd_price") or bid.dvd_price)

        bid.wifi       = data.get("wifi", bid.wifi)
        bid.wifi_price = float(data.get("wifi_price") or bid.wifi_price)

        bid.monitor       = data.get("monitor", bid.monitor)
        bid.monitor_price = float(data.get("monitor_price") or bid.monitor_price)

        bid.cabinet       = data.get("cabinet", bid.cabinet)
        bid.cabinet_price = float(data.get("cabinet_price") or bid.cabinet_price)

        bid.keyboard       = data.get("keyboard", bid.keyboard)
        bid.keyboard_price = float(data.get("keyboard_price") or bid.keyboard_price)

        bid.warranty       = data.get("warranty", bid.warranty)
        bid.warranty_price = float(data.get("warranty_price") or bid.warranty_price)

        bid.motherboard       = data.get("motherboard", bid.motherboard)
        bid.motherboard_price = float(data.get("motherboard_price") or bid.motherboard_price)
        bid.motherboard_descp = data.get("motherboard_descp", bid.motherboard_descp)

        if data.get("date"):
            bid.date = data.get("date")
        bid.epbg = float(data.get("epbg") or bid.epbg)

        if data.get("hddreturnable_price"):
            bid.hddreturnable_price = float(data.get("hddreturnable_price") or 0)

        bid.analyser_note     = data.get("analyser_note", "")
        bid.analyser_username = data.get("analyser_username", bid.analyser_username)

        new_status = data.get("status", "reviewed")
        bid.review_status = new_status

        # ✅ Jab analyser re-submit karta hai, admin_note clear karo
        # (admin ne jo kaha tha wo fix ho gaya)
        if new_status == "reviewed":
            bid.admin_note    = ""
            bid.admin_username = ""

        bid.save()

        return JsonResponse(
            {"success": True, "bid_id": bid.id, "review_status": bid.review_status},
            status=200,
        )

    except DesktopBid.DoesNotExist:
        return JsonResponse({"error": "Bid not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


# ══════════════════════════════════════════════════════════
#  ADMIN — Review Bid (Approve / Re-Analyze)
#  PATCH /api/desktop-bids/<bid_id>/admin-review/
#
#  Payload:
#    status: "approved" | "re-analyze"
#    admin_note: string  ← analyser ko dikhegi
#    admin_username: string
#    + edited form fields
# ══════════════════════════════════════════════════════════
@csrf_exempt
@require_http_methods(["PATCH"])
def admin_review_desktop_bid(request, bid_id):
    try:
        bid = DesktopBid.objects.get(id=bid_id)
        data = json.loads(request.body)

        action = data.get("status", "")
        if action not in ("approved", "re-analyze"):
            return JsonResponse(
                {"error": "Invalid status. Use 'approved' or 're-analyze'."},
                status=400,
            )

        # ── Update editable spec fields ──
        bid.bid_no    = data.get("bid_no", bid.bid_no)
        bid.dept_name = data.get("dept_name", bid.dept_name)
        bid.address   = data.get("address", bid.address)
        if data.get("qty"):
            bid.qty = int(data.get("qty"))

        bid.processor       = data.get("processor", bid.processor)
        bid.processor_price = float(data.get("processor_price") or bid.processor_price)
        bid.pro_descp       = data.get("pro_descp", bid.pro_descp)

        bid.ram       = data.get("ram", bid.ram)
        bid.ram_price = float(data.get("ram_price") or bid.ram_price)

        bid.hdd       = data.get("hdd", bid.hdd)
        bid.hdd_price = float(data.get("hdd_price") or bid.hdd_price)

        bid.ssd1       = data.get("ssd", bid.ssd1)
        bid.ssd1_price = float(data.get("ssd_price") or bid.ssd1_price)
        bid.ssd2       = data.get("ssd2", bid.ssd2)
        bid.ssd2_price = float(data.get("ssd2_price") or bid.ssd2_price)

        bid.software1 = data.get("software1", bid.software1)
        bid.gp        = data.get("gp", bid.gp)

        bid.os       = data.get("os", bid.os)
        bid.os_price = float(data.get("os_price") or bid.os_price)

        bid.dvd       = data.get("dvd", bid.dvd)
        bid.dvd_price = float(data.get("dvd_price") or bid.dvd_price)

        bid.wifi       = data.get("wifi", bid.wifi)
        bid.wifi_price = float(data.get("wifi_price") or bid.wifi_price)

        bid.monitor       = data.get("monitor", bid.monitor)
        bid.monitor_price = float(data.get("monitor_price") or bid.monitor_price)

        bid.cabinet       = data.get("cabinet", bid.cabinet)
        bid.cabinet_price = float(data.get("cabinet_price") or bid.cabinet_price)

        bid.keyboard       = data.get("keyboard", bid.keyboard)
        bid.keyboard_price = float(data.get("keyboard_price") or bid.keyboard_price)

        bid.warranty       = data.get("warranty", bid.warranty)
        bid.warranty_price = float(data.get("warranty_price") or bid.warranty_price)

        bid.motherboard       = data.get("motherboard", bid.motherboard)
        bid.motherboard_price = float(data.get("motherboard_price") or bid.motherboard_price)
        bid.motherboard_descp = data.get("motherboard_descp", bid.motherboard_descp)

        if data.get("date"):
            bid.date = data.get("date")
        if data.get("epbg"):
            bid.epbg = float(data.get("epbg") or bid.epbg)
        if data.get("hddreturnable_price"):
            bid.hddreturnable_price = float(data.get("hddreturnable_price") or 0)

        # ✅ Admin note — separate field mein save karo
        # Analyser ise padh sakta hai apne form mein
        admin_note     = data.get("admin_note", "").strip()
        admin_username = data.get("admin_username", "").strip()

        bid.admin_note     = admin_note
        bid.admin_username = admin_username

        # ── Set review_status ──
        bid.review_status = action
        bid.save()

        message = (
            "✅ Bid approved successfully!"
            if action == "approved"
            else "⚠️ Bid sent back to analyser for re-analysis."
        )

        return JsonResponse({
            "success": True,
            "bid_id": bid.id,
            "review_status": bid.review_status,
            "message": message,
        }, status=200)

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