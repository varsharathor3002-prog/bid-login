from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.hashers import make_password, check_password
import json
from django.views.decorators.http import require_http_methods

from .models import User, Product,DesktopBid



# 
# =========================
# ✅ REGISTER (only USER)
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
                role="user"   # 🔒 fixed role
            )

            return JsonResponse({
                "message": "User registered successfully ✅"
            })

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "Use POST method"}, status=405)


# =========================
# ✅ LOGIN (ALL ROLES)
# =========================
@csrf_exempt
def login(request):

    if request.method == "POST":

        try:

            data = json.loads(request.body)

            username = data.get("username")
            password = data.get("password")
            role = data.get("role")

            # ✅ VALIDATION
            if not username or not password:

                return JsonResponse(
                    {
                        "error": "Username and Password required"
                    },
                    status=400
                )

            # ✅ USER CHECK
            user = User.objects.filter(
                username=username
            ).first()

            if not user:

                return JsonResponse(
                    {
                        "error": "User not found"
                    },
                    status=404
                )

            # ✅ ROLE CHECK
            if role and user.role != role:

                return JsonResponse(
                    {
                        "error": "Invalid role selected"
                    },
                    status=400
                )

            # ✅ PASSWORD CHECK
            if check_password(password, user.password):

                return JsonResponse({

                    "message": "Login successful ✅",

                    "username": user.username,

                    "email": user.email,

                    "role": user.role,

                    "user_id": user.id,

                })

            else:

                return JsonResponse(
                    {
                        "error": "Invalid password"
                    },
                    status=400
                )

        except Exception as e:

            return JsonResponse(
                {
                    "error": str(e)
                },
                status=500
            )

    return JsonResponse(
        {
            "error": "Use POST method"
        },
        status=405
    )

    

@csrf_exempt
def forgot_password(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)

            username = data.get("username")
            email = data.get("email")   # 👈 add this
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
# STEP 1 — Create Bid (Basic Info Only)
# POST /api/desktop-bids/create/
# ─────────────────────────────────────────────

@csrf_exempt
@require_http_methods(["POST"])
def create_desktop_bid(request):

    """
    STEP 1:
    Create Desktop Bid
    + Logged-in user ko bid ke saath connect karo
    """

    try:

        data = json.loads(request.body)

        # ✅ USER ID FRONTEND SE AAYEGI
        user_id = data.get("user_id")

        if not user_id:

            return JsonResponse(
                {
                    "error": "User ID required"
                },
                status=400
            )

        # ✅ USER FETCH
        try:

            user = User.objects.get(id=user_id)

        except User.DoesNotExist:

            return JsonResponse(
                {
                    "error": "User not found"
                },
                status=404
            )

        # ✅ CREATE BID
        bid = DesktopBid.objects.create(

            # ✅ USER RELATION
            user=user,

            # STEP 1 FIELDS
            bid_no=data.get("bid_no", ""),

            dept_name=data.get("dept_name", ""),

            qty=int(data.get("qty", 0)),

            address=data.get("address", ""),

            pincode=data.get("pincode", ""),

            atc=data.get("atc", ""),

            status="draft",

            # STEP 2 PLACEHOLDER VALUES
            processor="",

            ram="",

            os="",

            monitor="",

            cabinet="",

            warranty="",

            motherboard="",

            software1="",

            gp="",

            # TEMP DATE
            date="2000-01-01",
        )

        return JsonResponse({

            "message": "Desktop Bid Created Successfully",

            "bid_id": bid.id,

            "user": user.username,

        }, status=201)

    except Exception as e:

        return JsonResponse(
            {
                "error": str(e)
            },
            status=400
        )




# ─────────────────────────────────────────────
# STEP 2 — Update Bid (Specs/Config)
# POST /api/desktop-bids/<id>/update/
# ─────────────────────────────────────────────
@csrf_exempt
@require_http_methods(["POST"])
def update_desktop_bid(request, bid_id):
    """
    STEP 2: Specs fill hongi:
    processor, ram, hdd, ssd1, ssd2, os, dvd, wifi,
    monitor, cabinet, keyboard, warranty, motherboard,
    date, epbg, freight, hddreturnable, descriptions
    """
    try:
        bid = DesktopBid.objects.get(id=bid_id)
        data = json.loads(request.body)

        # Processor
        bid.processor = data.get("processor", bid.processor)
        bid.processor_price = float(data.get("processor_price") or bid.processor_price)
        bid.pro_descp = data.get("pro_descp", bid.pro_descp)

        # RAM
        bid.ram = data.get("ram", bid.ram)
        bid.ram_price = float(data.get("ram_price") or bid.ram_price)

        # HDD
        bid.hdd = data.get("hdd", bid.hdd)
        bid.hdd_price = float(data.get("hdd_price") or bid.hdd_price)

        # SSD — form sends 'ssd' & 'ssd2', model has ssd1 & ssd2
        bid.ssd1 = data.get("ssd", bid.ssd1)
        bid.ssd1_price = float(data.get("ssd_price") or bid.ssd1_price)
        bid.ssd2 = data.get("ssd2", bid.ssd2)
        bid.ssd2_price = float(data.get("ssd2_price") or bid.ssd2_price)

        # Software & Graphics (text only, no price)
        bid.software1 = data.get("software1", bid.software1)
        bid.gp = data.get("gp", bid.gp)

        # OS
        bid.os = data.get("os", bid.os)
        bid.os_price = float(data.get("os_price") or bid.os_price)

        # DVD
        bid.dvd = data.get("dvd", bid.dvd)
        bid.dvd_price = float(data.get("dvd_price") or bid.dvd_price)

        # WiFi
        bid.wifi = data.get("wifi", bid.wifi)
        bid.wifi_price = float(data.get("wifi_price") or bid.wifi_price)

        # Monitor
        bid.monitor = data.get("monitor", bid.monitor)
        bid.monitor_price = float(data.get("monitor_price") or bid.monitor_price)

        # Cabinet
        bid.cabinet = data.get("cabinet", bid.cabinet)
        bid.cabinet_price = float(data.get("cabinet_price") or bid.cabinet_price)

        # Keyboard
        bid.keyboard = data.get("keyboard", bid.keyboard)
        bid.keyboard_price = float(data.get("keyboard_price") or bid.keyboard_price)

        # Warranty
        bid.warranty = data.get("warranty", bid.warranty)
        bid.warranty_price = float(data.get("warranty_price") or bid.warranty_price)

        # Motherboard
        bid.motherboard = data.get("motherboard", bid.motherboard)
        bid.motherboard_price = float(data.get("motherboard_price") or bid.motherboard_price)
        bid.motherboard_descp = data.get("motherboard_descp", bid.motherboard_descp)

        # Date & EPBG
        if data.get("date"):
            bid.date = data.get("date")
        bid.epbg = float(data.get("epbg") or bid.epbg)

        # Freight & HDD Returnable
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
# POST /api/desktop-bids/<id>/model/
# ─────────────────────────────────────────────
@csrf_exempt
@require_http_methods(["POST"])
def save_model_number(request, bid_id):
    """
    STEP 3: Sirf model_number save hoga.
    Bid status 'complete' ho jaegi.
    """
    try:
        bid = DesktopBid.objects.get(id=bid_id)
        data = json.loads(request.body)

        model = data.get("model", "").strip()
        if not model:
            return JsonResponse({"error": "Model number required"}, status=400)

        bid.model_number = model
        bid.status = "complete"
        bid.save()

        return JsonResponse({"success": True, "bid_id": bid.id, "model_number": bid.model_number}, status=200)

    except DesktopBid.DoesNotExist:
        return JsonResponse({"error": "Bid not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


# ─────────────────────────────────────────────
# PRICE CHECK VIEWS (existing endpoints)
# ─────────────────────────────────────────────

@csrf_exempt
def check_processor(request):
    if request.method == "POST":
        data = json.loads(request.body)
        processor = data.get("processor", "")
        # Apna pricing logic yahan lagao
        price = get_price_for("processor", processor)
        return JsonResponse({"price": price})


@csrf_exempt
def check_ram(request):
    if request.method == "POST":
        data = json.loads(request.body)
        ram = data.get("ram", "")
        price = get_price_for("ram", ram)
        return JsonResponse({"price": price})


@csrf_exempt
def check_hdd(request):
    if request.method == "POST":
        data = json.loads(request.body)
        hdd = data.get("hdd", "")
        price = get_price_for("hdd", hdd)
        return JsonResponse({"price": price})


@csrf_exempt
def check_ssd(request):
    if request.method == "POST":
        data = json.loads(request.body)
        ssd = data.get("ssd", "")
        price = get_price_for("ssd", ssd)
        return JsonResponse({"price": price})


@csrf_exempt
def check_os(request):
    if request.method == "POST":
        data = json.loads(request.body)
        os = data.get("os", "")
        price = get_price_for("os", os)
        return JsonResponse({"price": price})


@csrf_exempt
def check_dvd(request):
    if request.method == "POST":
        data = json.loads(request.body)
        dvd = data.get("dvd", "")
        price = get_price_for("dvd", dvd)
        return JsonResponse({"price": price})


@csrf_exempt
def check_wifi(request):
    if request.method == "POST":
        data = json.loads(request.body)
        wifi = data.get("wifi", "")
        price = get_price_for("wifi", wifi)
        return JsonResponse({"price": price})


@csrf_exempt
def check_motherboard(request):
    if request.method == "POST":
        data = json.loads(request.body)
        motherboard = data.get("motherboard", "")
        price = get_price_for("motherboard", motherboard)
        return JsonResponse({"price": price})


@csrf_exempt
def check_monitor_size(request):
    if request.method == "POST":
        data = json.loads(request.body)
        monitor = data.get("monitor", "")
        price = get_price_for("monitor", monitor)
        return JsonResponse({"price": price})


@csrf_exempt
def check_cabinet_type(request):
    if request.method == "POST":
        data = json.loads(request.body)
        cabinet = data.get("cabinet", "")
        price = get_price_for("cabinet", cabinet)
        return JsonResponse({"price": price})


@csrf_exempt
def check_keyboard(request):
    if request.method == "POST":
        data = json.loads(request.body)
        keyboard = data.get("keyboard", "")
        price = get_price_for("keyboard", keyboard)
        return JsonResponse({"price": price})


@csrf_exempt
def check_warranty(request):
    if request.method == "POST":
        data = json.loads(request.body)
        warranty = data.get("warranty", "")
        price = get_price_for("warranty", warranty)
        return JsonResponse({"price": price})


# ─────────────────────────────────────────────
# Helper — apna pricing DB/logic yahan lagao
# ─────────────────────────────────────────────
def get_price_for(component, value):
    """
    Yahan apna actual pricing logic lagao.
    Abhi placeholder 0 return kar raha hai.
    """
    return 0








# ══════════════════════════════════════════════════════════
#  ANALYSER — List Bids by review_status
#  GET /api/desktop-bids/list/?status=pending|re-analyze|reviewed
#
#  AnalyserDashboard fields needed per row:
#    id, bid_no, dept_name, qty, status,
#    created_at, submitted_by, remarks, model_number
# ══════════════════════════════════════════════════════════
@csrf_exempt
@require_http_methods(["GET"])
def list_desktop_bids(request):
    """
    AnalyserDashboard tabs:
      pending    → review_status = "pending"
      re-analyze → review_status = "re-analyze"
      reviewed   → review_status = "reviewed"
    """

    try:

        status_filter = request.GET.get(
            "status",
            "pending"
        )

        bids = DesktopBid.objects.filter(
            review_status=status_filter,
            status="complete",
        ).order_by("-created_at")

        result = []

        for bid in bids:

            result.append({

                "id": bid.id,

                # ✅ USER NAME JO BID CREATE KAR RAHA HAI
                "submitted_by": (
                    bid.user.username
                    if bid.user
                    else "Internal User"
                ),

                "bid_no": bid.bid_no,

                "dept_name": bid.dept_name,

                "qty": bid.qty,

                "status": bid.review_status,

                "created_at": bid.created_at.strftime("%Y-%m-%d"),

                # ✅ ANALYSER REMARKS
                "remarks": bid.analyser_note or "",

                # ✅ MODEL NUMBER
                "model_number": bid.model_number or "",

                # ✅ ANALYSER NAME
                "analyser_name": (
                    bid.analyser_username
                    if bid.analyser_username
                    else ""
                ),

            })

        return JsonResponse(
            result,
            safe=False,
            status=200
        )

    except Exception as e:

        return JsonResponse(
            {
                "error": str(e)
            },
            status=400
        )
 
# ══════════════════════════════════════════════════════════
#  ANALYSER — Get Single Bid Detail (Pre-fill)
#  GET /api/desktop-bids/<bid_id>/
#
#  BidDetailView uses field names: ssd, ssd2
#  Model has: ssd1, ssd2
#  So: ssd1 → 'ssd' naam se response mein bhejo
# ══════════════════════════════════════════════════════════
@csrf_exempt
@require_http_methods(["GET"])
def get_desktop_bid(request, bid_id):
    """
    Full bid data pre-filled karne ke liye.
    ssd1 → 'ssd' naam se bhejo (BidDetailView name='ssd' use karta hai).
    """
    try:
        bid = DesktopBid.objects.get(id=bid_id)
 
        data = {
            # Basic Info
            "id":            bid.id,
            "bid_no":        bid.bid_no,
            "dept_name":     bid.dept_name,
            "qty":           bid.qty,
            "address":       bid.address,
            "pincode":       bid.pincode,
            "atc":           bid.atc,
            "status":        bid.status,
            "review_status": bid.review_status,
 
            # Processor
            "processor":       bid.processor,
            "processor_price": bid.processor_price,
            "pro_descp":       bid.pro_descp or "",
 
            # RAM
            "ram":       bid.ram,
            "ram_price": bid.ram_price,
 
            # HDD
            "hdd":       bid.hdd or "",
            "hdd_price": bid.hdd_price,
 
            # SSD — ssd1 → 'ssd' naam se bhejo
            "ssd":        bid.ssd1 or "",
            "ssd_price":  bid.ssd1_price,
            "ssd2":       bid.ssd2 or "",
            "ssd2_price": bid.ssd2_price,
 
            # Descriptions
            "software1": bid.software1 or "",
            "gp":        bid.gp or "",
 
            # OS
            "os":       bid.os,
            "os_price": bid.os_price,
 
            # DVD
            "dvd":       bid.dvd or "",
            "dvd_price": bid.dvd_price,
 
            # WiFi
            "wifi":       bid.wifi or "",
            "wifi_price": bid.wifi_price,
 
            # Monitor
            "monitor":       bid.monitor,
            "monitor_price": bid.monitor_price,
 
            # Cabinet
            "cabinet":       bid.cabinet,
            "cabinet_price": bid.cabinet_price,
 
            # Keyboard
            "keyboard":       bid.keyboard or "",
            "keyboard_price": bid.keyboard_price,
 
            # Warranty
            "warranty":       bid.warranty,
            "warranty_price": bid.warranty_price,
 
            # Motherboard
            "motherboard":        bid.motherboard,
            "motherboard_price":  bid.motherboard_price,
            "motherboard_descp":  bid.motherboard_descp or "",
 
            # Extras
            "date":                      str(bid.date),
            "epbg":                      bid.epbg,
            "freightInstallation":       bid.freightInstallation,
            "freightInstallation_price": bid.freightInstallation_price,
            "hddreturnable":             bid.hddreturnable,
            "hddreturnable_price":       bid.hddreturnable_price,
 
            # Step 3
            "model_number": bid.model_number or "",
 
            # Analyser
            "analyser_note":     bid.analyser_note or "",
            "analyser_username": bid.analyser_username or "",
 
            # Dashboard list fields (same response mein)
            "created_at":   bid.created_at.strftime("%Y-%m-%d"),
            "submitted_by": bid.analyser_username or "Internal User",
            "remarks":      bid.analyser_note or "",
        }
 
        return JsonResponse(data, status=200)
 
    except DesktopBid.DoesNotExist:
        return JsonResponse({"error": "Bid not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)
 
 
# ══════════════════════════════════════════════════════════
#  ANALYSER — Review & Send to Admin
#  PATCH /api/desktop-bids/<bid_id>/review/
#
#  BidDetailView sends:
#    ...all edited form fields...
#    analyser_note, analyser_username, status="reviewed"
# ══════════════════════════════════════════════════════════
@csrf_exempt
@require_http_methods(["PATCH"])
def review_desktop_bid(request, bid_id):
    """
    Analyser ne review kiya:
    - Saare edited fields save honge
    - analyser_note save hoga
    - review_status = 'reviewed' (ya 're-analyze' agar admin wapas bheja ho)
    """
    try:
        bid = DesktopBid.objects.get(id=bid_id)
        data = json.loads(request.body)
 
        # ── Basic Info ──
        bid.bid_no    = data.get("bid_no", bid.bid_no)
        bid.dept_name = data.get("dept_name", bid.dept_name)
        bid.address   = data.get("address", bid.address)
        if data.get("qty"):
            bid.qty = int(data.get("qty"))
 
        # ── Processor ──
        bid.processor       = data.get("processor", bid.processor)
        bid.processor_price = float(data.get("processor_price") or bid.processor_price)
        bid.pro_descp       = data.get("pro_descp", bid.pro_descp)
 
        # ── RAM ──
        bid.ram       = data.get("ram", bid.ram)
        bid.ram_price = float(data.get("ram_price") or bid.ram_price)
 
        # ── HDD ──
        bid.hdd       = data.get("hdd", bid.hdd)
        bid.hdd_price = float(data.get("hdd_price") or bid.hdd_price)
 
        # ── SSD — frontend 'ssd' → model ssd1 ──
        bid.ssd1       = data.get("ssd", bid.ssd1)
        bid.ssd1_price = float(data.get("ssd_price") or bid.ssd1_price)
        bid.ssd2       = data.get("ssd2", bid.ssd2)
        bid.ssd2_price = float(data.get("ssd2_price") or bid.ssd2_price)
 
        # ── Descriptions ──
        bid.software1 = data.get("software1", bid.software1)
        bid.gp        = data.get("gp", bid.gp)
 
        # ── OS ──
        bid.os       = data.get("os", bid.os)
        bid.os_price = float(data.get("os_price") or bid.os_price)
 
        # ── DVD ──
        bid.dvd       = data.get("dvd", bid.dvd)
        bid.dvd_price = float(data.get("dvd_price") or bid.dvd_price)
 
        # ── WiFi ──
        bid.wifi       = data.get("wifi", bid.wifi)
        bid.wifi_price = float(data.get("wifi_price") or bid.wifi_price)
 
        # ── Monitor ──
        bid.monitor       = data.get("monitor", bid.monitor)
        bid.monitor_price = float(data.get("monitor_price") or bid.monitor_price)
 
        # ── Cabinet ──
        bid.cabinet       = data.get("cabinet", bid.cabinet)
        bid.cabinet_price = float(data.get("cabinet_price") or bid.cabinet_price)
 
        # ── Keyboard ──
        bid.keyboard       = data.get("keyboard", bid.keyboard)
        bid.keyboard_price = float(data.get("keyboard_price") or bid.keyboard_price)
 
        # ── Warranty ──
        bid.warranty       = data.get("warranty", bid.warranty)
        bid.warranty_price = float(data.get("warranty_price") or bid.warranty_price)
 
        # ── Motherboard ──
        bid.motherboard       = data.get("motherboard", bid.motherboard)
        bid.motherboard_price = float(data.get("motherboard_price") or bid.motherboard_price)
        bid.motherboard_descp = data.get("motherboard_descp", bid.motherboard_descp)
 
        # ── Date & EPBG ──
        if data.get("date"):
            bid.date = data.get("date")
        bid.epbg = float(data.get("epbg") or bid.epbg)
 
        # ── HDD Returnable ──
        if data.get("hddreturnable_price"):
            bid.hddreturnable_price = float(data.get("hddreturnable_price") or 0)
 
        # ── Analyser Fields ──
        bid.analyser_note     = data.get("analyser_note", "")
        bid.analyser_username = data.get("analyser_username", bid.analyser_username)
 
        # BidDetailView "status": "reviewed" bhejta hai
        new_review_status   = data.get("status", "reviewed")
        bid.review_status   = new_review_status
 
        bid.save()
 
        return JsonResponse(
            {"success": True, "bid_id": bid.id, "review_status": bid.review_status},
            status=200,
        )
 
    except DesktopBid.DoesNotExist:
        return JsonResponse({"error": "Bid not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)
 





































































































# ADMIN
def get_products(request):
    products = list(
        Product.objects.all().order_by("id").values("id", "name")
    )
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

