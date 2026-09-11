import json
import re

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from ..models import GemFinancialRanking
from .Gem import _require_role

COMPANY = "LAPS N TABS TECHNOLOGY PRIVATE LIMITED"


def company_key(value):
    # GeM keeps appending new trailing decorations after the seller name
    # (MSE/MII badge, social-category notes, "Under PMA", combinations of
    # these...). Rather than enumerate every pattern, treat the seller as a
    # match when the name starts with our company name followed by a bracket
    # or the word "Under" — a genuinely different, longer company name (e.g.
    # "... LIMITED AND CO") never starts that way.
    normalized = " ".join(value.split()).upper()
    if normalized == COMPANY:
        return COMPANY
    if normalized.startswith(COMPANY):
        rest = normalized[len(COMPANY):].lstrip()
        if rest.startswith("(") or re.match(r"^UNDER\b", rest):
            return COMPANY
    return normalized


def result_data(row):
    matches = [seller for seller in row.sellers if company_key(seller["sellerName"]) == COMPANY]
    return {
        "id": row.id, "bid_no": row.bid_no, "lot_key": row.lot_key,
        "ra_no": row.ra_no, "technical_status": row.technical_status,
        "item_name": row.item_name, "sellers": row.sellers,
        "company_rank": matches[0]["rank"] if len(matches) == 1 else None,
        "company_match": "matched" if len(matches) == 1 else "ambiguous" if matches else "not_found",
        "last_synced_at": row.last_synced_at.isoformat(),
    }


@csrf_exempt
@require_http_methods(["GET", "POST"])
def financial_rankings(request):
    _, error = _require_role(request, {"analyser", "admin"})
    if error:
        return error
    if request.method == "GET":
        results = [result_data(row) for row in GemFinancialRanking.objects.all()]
        if request.GET.get("qualified_only") == "1":
            results = [row for row in results if row["technical_status"] == "qualified"]
        return JsonResponse({"company_name": COMPANY, "results": results})
    try:
        body = json.loads(request.body)
        if not isinstance(body, dict):
            raise ValueError("Expected a result object.")
        bid_no = body.get("bid_no", "")
        if not isinstance(bid_no, str) or not re.fullmatch(r"GEM/\d{4}/B/\d+", bid_no) or len(bid_no) > 100:
            raise ValueError("A valid GeM bid number is required.")
        technical_status = body.get("technical_status", "unknown")
        if technical_status not in ("unknown", "qualified", "disqualified"):
            raise ValueError("Invalid technical status.")
        ra_no = body.get("ra_no", "")
        if not isinstance(ra_no, str) or len(ra_no) > 100 or (ra_no and not re.fullmatch(r"GEM/\d{4}/R/\d+", ra_no)):
            raise ValueError("Invalid RA number.")
        for key, limit in [("lot_key", 100), ("item_name", 500)]:
            if not isinstance(body.get(key, ""), str) or len(body.get(key, "")) > limit:
                raise ValueError(f"Invalid {key}.")
        sellers = body.get("sellers")
        if not isinstance(sellers, list) or not 1 <= len(sellers) <= 1000:
            raise ValueError("Provide between 1 and 1000 seller rows.")
        cleaned = []
        for seller in sellers:
            if not isinstance(seller, dict):
                raise ValueError("Invalid seller row.")
            for key in ["sellerName", "offeredItem"]:
                if not isinstance(seller.get(key), str) or not seller[key].strip() or len(seller[key]) > 1000:
                    raise ValueError(f"Invalid {key}.")
            if type(seller.get("rank")) is not int or not 1 <= seller["rank"] <= 1000000:
                raise ValueError("An explicit positive rank is required.")
            if not isinstance(seller.get("totalPrice"), str) or not re.fullmatch(r"\d{1,16}\.\d{2}", seller["totalPrice"]):
                raise ValueError("Total price must be a decimal string with two decimal places.")
            if seller.get("currency", "INR") != "INR":
                raise ValueError("Only INR results are supported.")
            cleaned.append({key: seller[key] for key in ["sellerName", "offeredItem", "rank", "totalPrice"]} | {"currency": "INR"})
    except (ValueError, UnicodeDecodeError) as exc:
        return JsonResponse({"error": str(exc)}, status=400)
    row, created = GemFinancialRanking.objects.update_or_create(
        bid_no=bid_no, lot_key=body.get("lot_key", ""),
        defaults={"item_name": body.get("item_name", ""), "sellers": cleaned, "technical_status": technical_status, "ra_no": ra_no},
    )
    return JsonResponse(result_data(row), status=201 if created else 200)


@csrf_exempt
@require_http_methods(["DELETE"])
def delete_financial_ranking(request, result_id):
    _, error = _require_role(request, {"analyser", "admin"})
    if error:
        return error
    row = GemFinancialRanking.objects.filter(id=result_id).first()
    if not row:
        return JsonResponse({"error": "Financial ranking record not found."}, status=404)
    bid_no = row.bid_no
    row.delete()
    return JsonResponse({"deleted": True, "bid_no": bid_no})
