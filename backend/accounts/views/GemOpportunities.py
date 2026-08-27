import json
import base64
import fitz
import re
from datetime import timedelta
from django.http import JsonResponse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from ..models import GemBidOpportunity
from .Gem import _require_role


def _date(value):
    parsed = parse_datetime(str(value or "").strip().replace(" ", "T", 1))
    if parsed and timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed)
    return parsed


def _clean_item(value):
    value = " ".join(str(value or "").split())
    # GeM's bilingual PDF sometimes appends the Hindi tender text to the
    # English category on the same extracted line.  The UI needs categories,
    # not that following clause text.
    value = re.split(r"[\u0900-\u097f]", value, maxsplit=1)[0]
    q_markers = list(re.finditer(r"\(Q\d+\)", value, re.I))
    if q_markers:
        value = value[:q_markers[-1].end()]
    value = re.sub(r"\s*\(Q\d+\)\s*", "", value, flags=re.I)
    return re.sub(r"\s*,\s*", ", ", value).strip(" ,")[:500]


def _data(row):
    return {
        "id": row.id,
        "bid_no": row.bid_no,
        "bid_date": row.bid_date.isoformat() if row.bid_date else "",
        "end_date": row.end_date.isoformat() if row.end_date else "",
        "product_name": _clean_item(row.product_name),
        "product_type": row.product_type,
        "pdf_url": row.pdf_url,
    }


@csrf_exempt
@require_http_methods(["GET", "POST"])
def gem_bid_opportunities(request):
    user, error = _require_role(request, {"admin", "analyser"})
    if error:
        return error
    if request.method == "GET":
        now = timezone.localtime()
        first_date = now.date() - timedelta(days=3)
        rows = GemBidOpportunity.objects.filter(
            is_deleted=False,
            assignment__isnull=True,
            end_date__gt=now,
            bid_date__date__gte=first_date,
            bid_date__date__lte=now.date(),
        )
        return JsonResponse({"results": [_data(row) for row in rows[:5000]]})
    try:
        body = json.loads(request.body or "{}")
    except (TypeError, ValueError):
        return JsonResponse({"error": "Invalid JSON payload."}, status=400)
    if body.get("action") == "delete":
        row_id = body.get("id")
        updated = GemBidOpportunity.objects.filter(id=row_id).update(is_deleted=True)
        if not updated:
            return JsonResponse({"error": "Bid record not found."}, status=404)
        return JsonResponse({"deleted": True})
    if body.get("action") == "bulk_delete":
        row_ids = list(dict.fromkeys(body.get("ids") or []))
        if not row_ids:
            return JsonResponse({"error": "Select at least one bid."}, status=400)
        updated = GemBidOpportunity.objects.filter(id__in=row_ids).update(is_deleted=True)
        return JsonResponse({"deleted": updated})
    rows = body.get("results", [])
    saved = 0
    for item in rows if isinstance(rows, list) else []:
        bid_no = str(item.get("bid_no") or "").strip()
        product_name = str(item.get("product_name") or "").strip()
        if not bid_no or not product_name:
            continue
        existing = GemBidOpportunity.objects.filter(bid_no=bid_no).first()
        if existing and existing.is_deleted:
            # A user-deleted opportunity is a permanent ignore/tombstone. A
            # later GeM scan must not make it visible again.
            continue
        GemBidOpportunity.objects.update_or_create(
            bid_no=bid_no,
            defaults={
                "bid_date": _date(item.get("bid_date")),
                "end_date": _date(item.get("end_date")),
                "product_name": _clean_item(product_name),
                "department": str(item.get("department") or ""),
                "delivery_pincode": str(item.get("delivery_pincode") or "")[:6],
                "product_type": str(item.get("product_type") or "")[:40],
                "pdf_url": str(item.get("pdf_url") or "")[:1000],
            },
        )
        saved += 1
    return JsonResponse({"saved": saved})


@csrf_exempt
@require_http_methods(["POST"])
def parse_gem_bid_pdf(request):
    user, error = _require_role(request, {"admin", "analyser"})
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
