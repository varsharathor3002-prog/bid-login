import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from ..models import User, WorkstationBid


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
            return JsonResponse({"error": "User ID ya Username required hai"}, status=400)

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
                "hint": "Please logout karke dobara login karein"
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