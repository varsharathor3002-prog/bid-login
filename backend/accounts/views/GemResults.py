import json
import re
from datetime import timedelta

from django.db import transaction
from django.http import JsonResponse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from ..models import DesktopBid, GemBidEvaluationHistory, GemBidResult
from .Gem import _require_role


FINAL_STATUS_WORDS = ("disqualified", "qualified", "awarded", "cancelled", "closed")


def _parse_datetime(value):
    if not value:
        return None
    parsed = parse_datetime(str(value).strip().replace(" ", "T", 1))
    if parsed and timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed)
    return parsed


def _history_data(row):
    return {
        "date_time": row.date_time.isoformat() if row.date_time else "",
        "status": row.status,
        "reason": row.reason,
        "comment": row.comment,
    }


def _result_data(result):
    history = list(result.evaluation_history.all())
    latest = history[0] if history else None
    deadline = result.disqualified_at + timedelta(days=3) if result.disqualified_at else None
    return {
        "id": result.id,
        "bid_no": result.bid_no,
        "product_type": result.product_type,
        "item_name": result.item_name,
        "quantity": result.quantity,
        "department": result.department,
        "start_date": result.start_date.isoformat() if result.start_date else "",
        "end_date": result.end_date.isoformat() if result.end_date else "",
        "status": result.status,
        "technical_status": result.technical_status,
        "is_disqualified": result.is_disqualified,
        "newly_disqualified": result.newly_disqualified,
        "disqualified_at": result.disqualified_at.isoformat() if result.disqualified_at else "",
        "claim_deadline": deadline.isoformat() if deadline else "",
        "reason": latest.reason if latest else "",
        "comment": latest.comment if latest else "",
        "history": [_history_data(row) for row in history],
        "last_synced_at": result.last_synced_at.isoformat(),
    }


@csrf_exempt
@require_http_methods(["GET", "POST"])
def gem_bid_results(request):
    user, error = _require_role(request, {"admin", "analyser"})
    if error:
        return error

    if request.method == "GET":
        results = GemBidResult.objects.prefetch_related("evaluation_history")
        if request.GET.get("status") == "disqualified":
            results = results.filter(is_disqualified=True)
        year = request.GET.get("year", "").strip()
        if year.isdigit():
            results = results.filter(disqualified_at__year=int(year))
        year_from = request.GET.get("year_from", "").strip()
        if year_from.isdigit():
            results = results.filter(disqualified_at__year__gte=int(year_from))
        product_type = request.GET.get("product", "").strip().lower()
        if product_type in dict(GemBidResult.PRODUCT_CHOICES):
            results = results.filter(product_type=product_type)
        summary_scope = GemBidResult.objects.all()
        if product_type in dict(GemBidResult.PRODUCT_CHOICES):
            summary_scope = summary_scope.filter(product_type=product_type)
        total = summary_scope.count()
        disqualified = summary_scope.filter(is_disqualified=True).count()
        urgent_cutoff = timezone.now() - timedelta(days=3)
        urgent = summary_scope.filter(
            is_disqualified=True, disqualified_at__gte=urgent_cutoff
        ).count()
        return JsonResponse({
            "summary": {
                "total": total,
                "disqualified": disqualified,
                "rate": round((disqualified / total * 100), 1) if total else 0,
                "action_needed": urgent,
            },
            "results": [_result_data(item) for item in results[:2000]],
        })

    try:
        body = json.loads(request.body or "{}")
    except (TypeError, ValueError):
        return JsonResponse({"error": "Invalid JSON payload."}, status=400)
    rows = body.get("results", body if isinstance(body, list) else [])
    if not isinstance(rows, list):
        return JsonResponse({"error": "results must be a list."}, status=400)

    saved = []
    with transaction.atomic():
        for row in rows:
            bid_no = str(row.get("bid_no", "")).strip()
            if not bid_no:
                continue
            existing = GemBidResult.objects.filter(bid_no=bid_no).first()
            was_pending = bool(existing and not existing.is_final)
            technical_status = str(row.get("technical_status", "")).strip()
            status = str(row.get("status", "")).strip()
            combined_status = f"{status} {technical_status}".lower()
            evaluation_read = bool(row.get("evaluation_read"))
            detected_disqualified = bool(row.get("is_disqualified")) or "disqualified" in combined_status
            is_disqualified = detected_disqualified if evaluation_read or not existing else existing.is_disqualified
            detected_final = bool(row.get("is_final")) or any(word in combined_status for word in FINAL_STATUS_WORDS)
            is_final = detected_final if evaluation_read or not existing else existing.is_final
            history = row.get("history") if isinstance(row.get("history"), list) else []
            stored_disqualified_event = (
                existing.evaluation_history.filter(status__icontains="disqualified").first()
                if existing else None
            )
            disqualified_at = _parse_datetime(row.get("disqualified_at"))
            # Disqualification is append-only audit data. A later incomplete or
            # contradictory scan must never erase a previously confirmed result.
            is_disqualified = bool(
                detected_disqualified
                or (existing and existing.is_disqualified)
                or stored_disqualified_event
            )
            if existing and existing.disqualified_at:
                disqualified_at = existing.disqualified_at
            if not evaluation_read and existing and not technical_status:
                technical_status = existing.technical_status
            if not disqualified_at and is_disqualified:
                disqualified_events = [item for item in history if "disqualified" in str(item.get("status", "")).lower()]
                if disqualified_events:
                    disqualified_at = _parse_datetime(disqualified_events[0].get("date_time"))
            if not disqualified_at and stored_disqualified_event:
                disqualified_at = stored_disqualified_event.date_time
            if existing and existing.is_disqualified:
                technical_status = existing.technical_status or "Disqualified"
            defaults = {
                "product_type": str(row.get("product_type", "desktop")).lower()
                if str(row.get("product_type", "desktop")).lower() in dict(GemBidResult.PRODUCT_CHOICES)
                else "other",
                "item_name": re.sub(r"^\s*s\s*:\s*", "", str(row.get("item_name", "")), flags=re.I)[:500],
                "quantity": row.get("quantity") or None,
                "department": str(row.get("department", "")),
                "start_date": _parse_datetime(row.get("start_date")),
                "end_date": _parse_datetime(row.get("end_date")),
                "status": status[:150],
                "technical_status": technical_status[:150],
                "is_disqualified": is_disqualified,
                "is_final": is_final,
                "newly_disqualified": bool(
                    (existing and existing.newly_disqualified)
                    or (is_disqualified and was_pending)
                ),
                "disqualified_at": disqualified_at,
                "linked_bid": DesktopBid.objects.filter(bid_no=bid_no).first(),
            }
            result, _ = GemBidResult.objects.update_or_create(bid_no=bid_no, defaults=defaults)
            for event in history:
                GemBidEvaluationHistory.objects.get_or_create(
                    bid_result=result,
                    date_time=_parse_datetime(event.get("date_time")),
                    status=str(event.get("status", ""))[:150],
                    reason=str(event.get("reason", "")),
                    comment=str(event.get("comment", "")),
                )
            saved.append(result.bid_no)
    return JsonResponse({"saved": len(saved), "bid_numbers": saved})


@csrf_exempt
@require_http_methods(["DELETE"])
def delete_gem_bid_result(request, result_id):
    user, error = _require_role(request, {"admin", "analyser"})
    if error:
        return error
    return JsonResponse({
        "error": "Disqualified bid records are permanent audit data and cannot be deleted."
    }, status=409)


@csrf_exempt
@require_http_methods(["GET"])
def gem_pending_bid_results(request):
    user, error = _require_role(request, {"admin", "analyser"})
    if error:
        return error
    rows = GemBidResult.objects.filter(is_final=False).values_list("bid_no", flat=True)
    return JsonResponse({"bid_numbers": list(rows)})
