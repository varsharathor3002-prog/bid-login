from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.hashers import make_password, check_password
import json

from .models import User, Product, Bid,  DesktopBid, BidModel, BidPricing, BidProduct , AIOProduct, Price



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
            role = data.get("role")   # 👈 ADD THIS

            if not username or not password:
                return JsonResponse({"error": "Username and Password required"}, status=400)

            user = User.objects.filter(username=username).first()

            if not user:
                return JsonResponse({"error": "User not found"}, status=404)

            # ✅ Role validation
            if role and user.role != role:
                return JsonResponse({"error": "Invalid role selected"}, status=400)

            if check_password(password, user.password):
                return JsonResponse({
                    "message": "Login successful ✅",
                    "username": user.username,
                    "role": user.role
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


# CREATE BID (Step 1)

@csrf_exempt
def create_bid(request):
    if request.method == "POST":
        data = json.loads(request.body)

        bid = Bid.objects.create(
            bid_no=data.get("bid_no"),
            dept_name=data.get("dept_name"),
            qty=data.get("qty"),
            atc=data.get("atc"),
            address=data.get("address"),
            pincode=data.get("pincode"),
            device_type=data.get("device_type"),  # ✅ IMPORTANT
            status="submitted"
        )

        return JsonResponse({
            "message": "Bid Created ✅",
            "bid_id": bid.id
        })

    return JsonResponse({"error": "POST method required"}, status=405)


# Specification BID (Step-2)

@csrf_exempt
def create_desktop_bid(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)

            bid_id = data.get("bid_id")

            try:
                bid = Bid.objects.get(id=bid_id)
            except Bid.DoesNotExist:
                return JsonResponse({"error": "Bid not found"}, status=404)

            spec = DesktopSpec.objects.create(
                bid=bid,  # 🔥 LINKING

                processor=data.get("processor"),
                pro_descp=data.get("pro_descp"),
                processor_price=data.get("processor_price") or 0,

                ram=data.get("ram"),
                ram_price=data.get("ram_price") or 0,

                hdd=data.get("hdd"),
                hdd_price=data.get("hdd_price") or 0,

                ssd=data.get("ssd"),
                ssd_price=data.get("ssd_price") or 0,

                software1=data.get("software1"),
                gp=data.get("gp"),

                os=data.get("os"),
                os_price=data.get("os_price") or 0,

                dvd=data.get("dvd"),
                dvd_price=data.get("dvd_price") or 0,

                wifi=data.get("wifi"),
                wifi_price=data.get("wifi_price") or 0,

                monitor=data.get("monitor"),
                monitor_price=data.get("monitor_price") or 0,

                cabinet=data.get("cabinet"),
                cabinet_price=data.get("cabinet_price") or 0,

                keyboard=data.get("keyboard"),
                keyboard_price=data.get("keyboard_price") or 0,

                warranty=data.get("warranty"),
                warranty_price=data.get("warranty_price") or 0,

                motherboard=data.get("motherboard"),
                motherboard_descp=data.get("motherboard_descp"),
                motherboard_price=data.get("motherboard_price") or 0,

                date=data.get("date"),
                epbg=data.get("epbg") or 0,

                freightInstallation=data.get("freightInstallation", "Yes"),
                freightInstallation_price=data.get("freightInstallation_price") or 1000,

                hddreturnable=data.get("hddreturnable"),
                hddreturnable_price=data.get("hddreturnable_price") or 0,
            )

            return JsonResponse({
                "message": "Desktop Spec Saved ✅",
                "spec_id": spec.id
            })

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)

    return JsonResponse({"error": "Invalid request"}, status=405)

# ADD MODEL NUMBER (Step 3)

@csrf_exempt
def add_model(request):
    if request.method == "POST":
        data = json.loads(request.body)

        bid_id = data.get("bid_id")

        try:
            bid = Bid.objects.get(id=bid_id)
        except Bid.DoesNotExist:
            return JsonResponse({"error": "Bid not found"}, status=404)

        BidModel.objects.create(
            bid=bid,
            model_no=data.get("model_no")
        )

        return JsonResponse({"message": "Model added ✅"})

    return JsonResponse({"error": "POST method required"}, status=405)

   


def approved_bids(request):
    bids = BidProduct.objects.filter(status="Approved").order_by("-id")

    data = []
    for b in bids:
        data.append({
            "id": b.id,
            "bid_no": b.bid_no,
            "model": b.model,
            "remark": b.remark,
            "date": b.date,
            "status": b.status,
        })

    return JsonResponse(data, safe=False)



@csrf_exempt
def update_bid(request):
    if request.method == "POST":
        data = json.loads(request.body)

        try:
            bid = BidProduct.objects.get(id=data["id"])

            bid.bid_qualify = data.get("status")
            bid.bid_disqualify_reason = data.get("reason")
            bid.dealer_name = data.get("dname")
            bid.price = data.get("price")
            bid.brand = data.get("brand")

            bid.save()

            return JsonResponse({"message": "Updated successfully"})

        except BidProduct.DoesNotExist:
            return JsonResponse({"error": "Bid not found"}, status=404)

    return JsonResponse({"error": "Invalid request"}, status=400)






def aio_bids(request):
    bids = AIOProduct.objects.all().order_by("-id")

    data = []
    for b in bids:
        data.append({
            "id": b.id,
            "user_name": b.user_name,
            "bid_no": b.bid_no,
            "model": b.model,
            "qty": b.qty,
            "date": b.date,
            "status": b.status,
            "remark": b.remark,
            "dealer_name": b.dealer_name,
            "brand": b.brand,
            "price": b.price,
        })

    return JsonResponse(data, safe=False)



@csrf_exempt
def approve_aio_bid(request):
    if request.method == "POST":
        data = json.loads(request.body)

        try:
            bid = AIOProduct.objects.get(id=data["id"])

            bid.pro_price = data.get("pro_price", 0)
            bid.ram_price = data.get("ram_price", 0)
            bid.hdd_price = data.get("hdd_price", 0)
            bid.ssd_price = data.get("ssd_price", 0)

            bid.dealer_name = data.get("dealer_name")
            bid.brand = data.get("brand")

            total = (
                bid.pro_price + bid.ram_price +
                bid.hdd_price + bid.ssd_price
            )

            bid.total = total
            bid.status = "Approved"

            bid.save()

            return JsonResponse({"message": "Approved ✅"})

        except AIOProduct.DoesNotExist:
            return JsonResponse({"error": "Not found"}, status=404)




@csrf_exempt
def add_price(request):
    if request.method == "POST":
        data = json.loads(request.body)

        PriceItem.objects.create(
            type=data.get("type"),
            name=data.get("name"),
            price=data.get("price"),
            date=data.get("date"),
        )

        return JsonResponse({"message": "Price Saved ✅"})

    return JsonResponse({"error": "Invalid request"}, status=400)

def get_prices(request, type):
    prices = PriceItem.objects.filter(type=type).order_by("-id")

    data = []
    for p in prices:
        data.append({
            "name": p.name,
            "price": p.price,
            "date": p.date,
        })

    return JsonResponse(data, safe=False)