import json
import base64
import fitz
import re
from django.http import JsonResponse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from ..models import GemBidOpportunity
from .Gem import _request_user
from .GemOpportunityCleanup import valid_opportunity_dates
from .GemOpportunityRules import classify_opportunity_item, clean_opportunity_item


SUPPORTED_PRODUCT_TYPES = {"desktop", "workstation", "toner", "printer", "aio"}
OPPORTUNITY_MANAGEMENT_ROLES = {"admin", "management"}


def _require_login(request):
    user = _request_user(request)
    if not user:
        return None, JsonResponse({"error": "Authentication required."}, status=401)
    return user, None


def _date(value):
    parsed = parse_datetime(str(value or "").strip().replace(" ", "T", 1))
    if parsed and timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed)
    return parsed


def _clean_item(value):
    return clean_opportunity_item(value)


def _data(row):
    return {
        "id": row.id,
        "bid_no": row.bid_no,
        "bid_date": row.bid_date.isoformat() if row.bid_date else "",
        "end_date": row.end_date.isoformat() if row.end_date else "",
        "product_name": _clean_item(row.product_name),
        "product_type": row.product_type,
        "pdf_url": row.pdf_url,
        **corrigendum_data(row),
    }


def corrigendum_data(row):
    return {
        "has_corrigendum": row.has_corrigendum,
        "corrigendum_detail": row.corrigendum_detail,
        "corrigendum_found_at": row.corrigendum_found_at.isoformat() if row.corrigendum_found_at else "",
    }


def _corrigendum_fields(existing, item):
    flag = item.get("has_corrigendum")
    if flag is True:
        fields = {
            "has_corrigendum": True,
            "corrigendum_detail": str(item.get("corrigendum_detail") or "")[:2000],
        }
        if not (existing and existing.corrigendum_found_at):
            fields["corrigendum_found_at"] = timezone.now()
        return fields
    if flag is False and not (existing and existing.has_corrigendum):
        # GeM never withdraws a corrigendum, so one "none found" read must not
        # clear an earlier detection.
        return {"has_corrigendum": False}
    return {}


@csrf_exempt
@require_http_methods(["GET", "POST"])
def gem_bid_opportunities(request):
    user, error = _require_login(request)
    if error:
        return error
    if request.method == "GET":
        if user.role not in OPPORTUNITY_MANAGEMENT_ROLES:
            return JsonResponse({"error": "You are not authorized for this action."}, status=403)
        now = timezone.now()
        rows = GemBidOpportunity.objects.filter(
            is_deleted=False,
            assignment__isnull=True,
            end_date__gt=now,
        )
        visible = [row for row in rows[:5000] if valid_opportunity_dates(row.bid_date, row.end_date, now)]
        return JsonResponse({"results": [_data(row) for row in visible]})
    try:
        body = json.loads(request.body or "{}")
    except (TypeError, ValueError):
        return JsonResponse({"error": "Invalid JSON payload."}, status=400)
    if body.get("action") == "corrigendum_pending":
        # Active dashboard bids whose corrigendum has not been seen yet; the
        # extension re-checks these on GeM because a corrigendum can be issued
        # days after the bid was first received.
        rows = GemBidOpportunity.objects.filter(
            is_deleted=False, has_corrigendum=False, end_date__gt=timezone.now(),
        ).order_by("end_date")
        return JsonResponse({"bid_nos": list(rows.values_list("bid_no", flat=True)[:500])})
    if body.get("action") == "mark_corrigendum":
        bid_nos = [str(value or "").strip() for value in body.get("bid_nos") or []]
        updated = GemBidOpportunity.objects.filter(
            bid_no__in=bid_nos, is_deleted=False, has_corrigendum=False,
        ).update(has_corrigendum=True, corrigendum_found_at=timezone.now())
        return JsonResponse({"updated": updated})
    if body.get("action") == "delete":
        if user.role not in OPPORTUNITY_MANAGEMENT_ROLES:
            return JsonResponse({"error": "You are not authorized for this action."}, status=403)
        row_id = body.get("id")
        updated = GemBidOpportunity.objects.filter(id=row_id).update(is_deleted=True)
        if not updated:
            return JsonResponse({"error": "Bid record not found."}, status=404)
        return JsonResponse({"deleted": True})
    if body.get("action") == "bulk_delete":
        if user.role not in OPPORTUNITY_MANAGEMENT_ROLES:
            return JsonResponse({"error": "You are not authorized for this action."}, status=403)
        row_ids = list(dict.fromkeys(body.get("ids") or []))
        if not row_ids:
            return JsonResponse({"error": "Select at least one bid."}, status=400)
        updated = GemBidOpportunity.objects.filter(id__in=row_ids).update(is_deleted=True)
        return JsonResponse({"deleted": updated})
    rows = body.get("results", [])
    saved = 0
    created = 0
    updated = 0
    rejections = []
    visible_ids = []
    now = timezone.now()
    for item in rows if isinstance(rows, list) else []:
        bid_no = str(item.get("bid_no") or "").strip()
        product_name = str(item.get("product_name") or "").strip()
        if not re.fullmatch(r"GEM/\d{4}/B/\d+", bid_no):
            rejections.append({"bid_no": bid_no, "reason": "invalid_bid_no"})
            continue
        classification = classify_opportunity_item(product_name)
        provided_product_type = str(item.get("product_type") or "").strip()
        if (
            not classification
            or provided_product_type not in SUPPORTED_PRODUCT_TYPES
            or provided_product_type != classification["product_type"]
        ):
            rejections.append({"bid_no": bid_no, "reason": "unsupported_product"})
            continue
        bid_date = _date(item.get("bid_date"))
        end_date = _date(item.get("end_date"))
        if not valid_opportunity_dates(bid_date, end_date, now):
            rejections.append({"bid_no": bid_no, "reason": "invalid_date"})
            continue
        validity = item.get("offer_validity_days")
        if validity is not None and (type(validity) is not int or not 1 <= validity <= 120):
            rejections.append({"bid_no": bid_no, "reason": "invalid_offer_validity"})
            continue
        quantity = item.get("quantity")
        if type(quantity) is not int or quantity < 5:
            rejections.append({"bid_no": bid_no, "reason": "minimum_quantity_5"})
            continue
        existing = GemBidOpportunity.objects.filter(bid_no=bid_no).first()
        if existing and existing.is_deleted:
            # A user-deleted opportunity is a permanent ignore/tombstone. A
            # later GeM scan must not make it visible again.
            rejections.append({"bid_no": bid_no, "reason": "deleted_by_user"})
            continue
        corrigendum = _corrigendum_fields(existing, item)
        if existing and GemBidOpportunity.objects.filter(id=existing.id, assignment__isnull=False).exists():
            # Assigned bids are otherwise frozen, but the assignee still needs
            # to know when GeM issues a corrigendum for them.
            if corrigendum:
                GemBidOpportunity.objects.filter(id=existing.id).update(**corrigendum)
            rejections.append({"bid_no": bid_no, "reason": "already_assigned"})
            continue
        row, was_created = GemBidOpportunity.objects.update_or_create(
            bid_no=bid_no,
            defaults={
                "bid_date": bid_date,
                "end_date": end_date,
                "product_name": classification["clean_name"],
                "department": str(item.get("department") or ""),
                "delivery_pincode": str(item.get("delivery_pincode") or "")[:6],
                "product_type": classification["product_type"],
                "pdf_url": str(item.get("pdf_url") or "")[:1000],
                **corrigendum,
            },
        )
        saved += 1
        created += int(was_created)
        updated += int(not was_created)
        visible_ids.append(row.id)
    frontend_visible = bool(saved) and GemBidOpportunity.objects.filter(
        id__in=visible_ids,
        is_deleted=False,
        assignment__isnull=True,
        end_date__gt=now,
    ).count() == saved
    return JsonResponse({
        "saved": saved,
        "created": created,
        "updated": updated,
        "rejected": len(rejections),
        "rejections": rejections,
        "frontend_visible": frontend_visible,
    })


@csrf_exempt
@require_http_methods(["POST"])
def parse_gem_bid_pdf(request):
    user, error = _require_login(request)
    if error:
        return error
    try:
        body = json.loads(request.body or "{}")
        pdf_bytes = base64.b64decode(body.get("pdf_base64") or "", validate=True)
        if not pdf_bytes.startswith(b"%PDF"):
            raise ValueError("Not a PDF")
        document = fitz.open(stream=pdf_bytes, filetype="pdf")
        detail_text = "\n".join(page.get_text() for page in document)
    except Exception:
        return JsonResponse({"error": "GeM bid document could not be read."}, status=400)
    return JsonResponse({"detail_text": detail_text})
