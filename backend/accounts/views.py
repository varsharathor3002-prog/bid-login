from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.hashers import make_password, check_password
import json

from .models import User, BidProduct , AIOProduct, Price


@csrf_exempt
def register(request):
    if request.method == "POST":
        data = json.loads(request.body)

        User.objects.create(
            username=data['username'],
            email=data['email'],
            password=make_password(data['password']),  
            role='user'
        )

        return JsonResponse({"message": "User registered successfully"})

    return JsonResponse({"message": "Use POST method for registration"})


# ✅ LOGIN
# =========================
@csrf_exempt
def login(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)

            username = data.get("username")
            password = data.get("password")

            # 🔒 validation
            if not username or not password:
                return JsonResponse({"error": "Username and Password required"}, status=400)

            # 🔍 find user
            try:
                user = User.objects.get(username=username)
            except User.DoesNotExist:
                return JsonResponse({"error": "User not found"}, status=404)

            # 🔐 check password
            if check_password(password, user.password):
                return JsonResponse({
                    "message": "Login successful ✅",
                    "role": user.role,
                    "username": user.username
                })
            else:
                return JsonResponse({"error": "Invalid password"}, status=400)

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "Use POST method"}, status=405)

    # ✅ FORGOT PASSWORD
# =========================
@csrf_exempt
def forgot_password(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)

            username = data.get("username")
            new_password = data.get("new_password")

            # 🔒 validation
            if not username or not new_password:
                return JsonResponse({"error": "All fields are required"}, status=400)

            # 🔍 find user
            try:
                user = User.objects.get(username=username)
            except User.DoesNotExist:
                return JsonResponse({"error": "User not found"}, status=404)

            # 🔐 update password
            user.password = make_password(new_password)
            user.save()

            return JsonResponse({"message": "Password updated successfully ✅"})

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "Use POST method"}, status=405)


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