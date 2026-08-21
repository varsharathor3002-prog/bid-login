"""AIO's GeM-upload job queue — structurally the same as Desktop's (Gem.py),
scoped to AioBid instead of DesktopBid.

Scope note: this gives the Analyser/Admin a working "Upload to GeM" button
(opens the real GeM login page and tracks the upload's status, exactly like
Desktop's does when its browser extension isn't loaded) and a job-queue/audit
trail identical in shape to Desktop's. What it deliberately does NOT do is
reproduce Desktop's `_desktop_gem_payload` extension auto-fill spec mapping —
that function hardcodes ~80 GeM taxonomy field names/default values (cabinet
bay counts, power supply wattage, operating temperature range...) that were
tuned against Desktop's specific GeM category form. AIO's real GeM category
("All in One PC") has a different form with fields nobody has captured here,
so `_aio_gem_payload` only fills in values genuinely known from the bid
itself — inventing the rest would mean an automated system submitting
fabricated compliance data to a real government portal. The extension would
also need its own update to recognize this workflow name before auto-fill
does anything; until then the button still works as a manual-upload tracker.
"""
import re
from django.db import transaction
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from ..models import CatalogueProduct
from .Aio import AioBid, AioGemUploadJob, AioGemAuditLog, _ensure_table, _ensure_gem_tables
from .Desktop import _catalogue_extra_specs
from .Gem import _request_user, _require_role, _extension_token, _json_body


def _aio_gem_payload(bid, request):
    model_number = str(f"{bid.model_no}{bid.model}" or "").strip().upper()
    local_content = str(bid.local_content or "").strip().rstrip("%")
    keyboard_text = str(bid.keyboard or "")
    if re.search(r"\bwireless\b", keyboard_text, re.IGNORECASE):
        keyboard_mouse_connectivity = "Wireless"
    elif re.search(r"\bwired\b|\busb\b", keyboard_text, re.IGNORECASE):
        keyboard_mouse_connectivity = "USB Wired"
    else:
        keyboard_mouse_connectivity = ""

    catalogue_product = CatalogueProduct.objects.filter(
        model_no__iexact=model_number, category="aio"
    ).first()
    catalogue_specs = _catalogue_extra_specs(catalogue_product) if catalogue_product else {}

    return {
        "workflow": "aio_gem_upload",
        "bid_id": bid.id,
        "callback_url": request.build_absolute_uri(f"/api/aio-bids/{bid.id}/gem-status/"),
        "model_number": model_number,
        "brand": "ACXXEL",
        # No verified GeM category slug for "All in One PC" yet — left blank
        # rather than guessing at a real GeM taxonomy key.
        "category": {"key": "", "label": "All in One PC", "slug": ""},
        "quantity": bid.qty,
        "price": float(bid.total_price or 0),
        "bid_number": bid.bid_no,
        "department": bid.dept_name,
        "organization": bid.organization or "",
        "delivery_address": bid.address or "",
        "pincode": bid.pincode or "",
        "local_content": local_content,
        "specifications": {
            **catalogue_specs,
            "Processor": bid.processor or "",
            "RAM": bid.ram or "",
            "SSD": bid.ssd or "",
            "Operating System": bid.os or "",
            "Optical Drive": bid.dvd or "",
            "WiFi / Bluetooth": bid.wifi or "",
            "Integrated Screen Size": bid.screen_size or "",
            "Keyboard / Mouse": bid.keyboard or "",
            "Keyboard / Mouse Connectivity": keyboard_mouse_connectivity,
            "On Site OEM Warranty": bid.warranty or "",
            "Ports": bid.motherboard or "",
        },
        "documents": [
            {
                "type": doc_type,
                "url": request.build_absolute_uri(f"/api/aio-bids/{bid.id}/generate-docs/"),
            }
            for doc_type in ["approved_atc_documents", "approved_price_paper", "approved_all_documents"]
        ],
        "images": [
            request.build_absolute_uri(catalogue_product.image.url)
            for _ in [0]
            if catalogue_product and catalogue_product.image
        ],
    }


def _job_data(job, include_audit=False):
    data = {
        "id": job.id,
        "bid_id": job.bid_id,
        "bid_no": job.bid.bid_no,
        "model_number": f"{job.bid.model_no}{job.bid.model}",
        "triggered_by": job.triggered_by.username if job.triggered_by else "",
        "status": job.status,
        "progress": job.progress,
        "error": job.error,
        "rejection_reason": job.rejection_reason,
        "attempts": job.attempts,
        "max_attempts": job.max_attempts,
        "action_required": job.status in {"queued", "ready_for_fill", "filled"},
        "gem_product_id": job.gem_product_id,
        "gem_product_url": job.gem_product_url,
        "created_at": job.created_at.isoformat(),
        "updated_at": job.updated_at.isoformat(),
        "submitted_at": job.submitted_at.isoformat() if job.submitted_at else "",
        "completed_at": job.completed_at.isoformat() if job.completed_at else "",
    }
    if include_audit:
        data["audit"] = [
            {
                "event": item.event,
                "message": item.message,
                "actor": item.actor.username if item.actor else "",
                "metadata": item.metadata,
                "created_at": item.created_at.isoformat(),
            }
            for item in job.audit_logs.all()[:100]
        ]
    return data


@csrf_exempt
@require_http_methods(["POST"])
def create_aio_gem_upload_job(request, bid_id):
    data = _json_body(request)
    user, error = _require_role(request, {"analyser"}, data)
    if error:
        return error
    _ensure_table();_ensure_gem_tables()
    bid = AioBid.objects.filter(id=bid_id).first()
    if not bid:
        return JsonResponse({"error": "AIO bid not found."}, status=404)
    if bid.status != "approved":
        return JsonResponse({"error": "Admin approval is required before GeM upload."}, status=409)
    payload = _aio_gem_payload(bid, request)
    active = bid.gem_upload_jobs.filter(status__in=["queued", "ready_for_fill", "retrying"]).first()
    if active:
        active.payload_snapshot = payload
        active.save(update_fields=["payload_snapshot", "updated_at"])
        return JsonResponse({**_job_data(active), "extension_token": _extension_token(user)}, status=200)

    with transaction.atomic():
        job = AioGemUploadJob.objects.create(
            bid=bid, triggered_by=user,
            payload_snapshot=payload, next_attempt_at=timezone.now(),
        )
        AioGemAuditLog.objects.create(
            job=job, actor=user, event="job_created",
            message="Upload queued for manual GeM login through the Chrome extension.",
        )
        bid.gem_account = "Manual GeM login"
        bid.gem_status = "queued"
        bid.gem_error = ""
        bid.save(update_fields=["gem_account", "gem_status", "gem_error", "updated_at"])
    return JsonResponse({**_job_data(job), "extension_token": _extension_token(user)}, status=201)


@csrf_exempt
@require_http_methods(["GET"])
def aio_gem_jobs(request):
    user, error = _require_role(request, {"admin", "analyser"})
    if error:
        return error
    _ensure_gem_tables()
    jobs = AioGemUploadJob.objects.select_related("bid", "triggered_by")
    bid_id = request.GET.get("bid_id")
    if bid_id:
        jobs = jobs.filter(bid_id=bid_id)
    status_value = request.GET.get("status")
    if status_value:
        jobs = jobs.filter(status=status_value)
    return JsonResponse([_job_data(item) for item in jobs[:200]], safe=False)


@csrf_exempt
@require_http_methods(["GET"])
def aio_gem_job_detail(request, job_id):
    # Same to same as Desktop's own gem_job_detail (Gem.py) — GET-only. The
    # PATCH branch that used to live here let an Admin reassign a job to a
    # different GemAccount; that model was retired app-wide (migration
    # 0053_remove_gemaccount), so there's nothing left to PATCH.
    user, error = _require_role(request, {"admin", "analyser"})
    if error:
        return error
    _ensure_gem_tables()
    job = AioGemUploadJob.objects.select_related("bid", "triggered_by").filter(id=job_id).first()
    if not job:
        return JsonResponse({"error": "Upload job not found."}, status=404)
    return JsonResponse(_job_data(job, include_audit=True))


@csrf_exempt
@require_http_methods(["GET"])
def extension_aio_jobs(request):
    user, error = _require_role(request, {"analyser", "admin"})
    if error:
        return error
    _ensure_gem_tables()
    jobs = AioGemUploadJob.objects.select_related("bid", "triggered_by").filter(
        status__in=["queued", "ready_for_fill", "filled"]
    )
    if user.role == "analyser":
        jobs = jobs.filter(triggered_by=user)
    jobs = list(jobs[:25])
    for job in jobs:
        payload = _aio_gem_payload(job.bid, request)
        if job.payload_snapshot != payload:
            job.payload_snapshot = payload
            job.save(update_fields=["payload_snapshot", "updated_at"])
    return JsonResponse([{**_job_data(job), "payload": job.payload_snapshot} for job in jobs], safe=False)


@csrf_exempt
@require_http_methods(["POST"])
def extension_aio_claim_job(request, job_id):
    data = _json_body(request)
    user, error = _require_role(request, {"analyser", "admin"}, data)
    if error:
        return error
    _ensure_gem_tables()
    job = AioGemUploadJob.objects.select_related("bid", "triggered_by").filter(id=job_id).first()
    if not job:
        return JsonResponse({"error": "Upload job not found."}, status=404)
    if user.role == "analyser" and job.triggered_by_id != user.id:
        return JsonResponse({"error": "This job is assigned to another employee."}, status=403)
    if job.status not in {"queued", "ready_for_fill"}:
        return JsonResponse({"error": "This job is not available for form filling."}, status=409)
    payload = _aio_gem_payload(job.bid, request, {})
    payload.pop("gem_account", None)
    job.payload_snapshot = payload
    job.status = "ready_for_fill"
    job.progress = "Ready for the Chrome extension to fill GeM"
    job.attempts += 1
    job.started_at = job.started_at or timezone.now()
    job.save(update_fields=["payload_snapshot", "status", "progress", "attempts", "started_at", "updated_at"])
    AioGemAuditLog.objects.create(job=job, actor=user, event="extension_claimed", message="Chrome extension claimed the job.")
    return JsonResponse({**_job_data(job), "payload": job.payload_snapshot})


@csrf_exempt
@require_http_methods(["POST"])
def extension_aio_report_job(request, job_id):
    data = _json_body(request)
    user, error = _require_role(request, {"analyser", "admin"}, data)
    if error:
        return error
    _ensure_gem_tables()
    job = AioGemUploadJob.objects.select_related("bid", "triggered_by").filter(id=job_id).first()
    if not job:
        return JsonResponse({"error": "Upload job not found."}, status=404)
    if user.role == "analyser" and job.triggered_by_id != user.id:
        return JsonResponse({"error": "This job is assigned to another employee."}, status=403)
    status_value = str(data.get("status") or "").strip()
    allowed = {"ready_for_fill", "filled", "submitted", "published", "rejected", "failed"}
    if status_value not in allowed:
        return JsonResponse({"error": "Invalid extension job status."}, status=400)
    job.status = status_value
    job.progress = str(data.get("progress") or "")[:255]
    job.error = str(data.get("error") or "")[:4000]
    job.rejection_reason = str(data.get("rejection_reason") or "")[:4000]
    job.gem_product_id = str(data.get("gem_product_id") or "")[:255]
    job.gem_product_url = str(data.get("gem_product_url") or "")[:1000]
    now = timezone.now()
    if status_value == "submitted":
        job.submitted_at = now
    if status_value in {"published", "rejected", "failed"}:
        job.completed_at = now
    job.save()
    job.bid.gem_status = status_value
    job.bid.gem_error = job.error or job.rejection_reason
    job.bid.gem_product_id = job.gem_product_id
    job.bid.gem_product_url = job.gem_product_url
    if status_value in {"submitted", "published"}:
        job.bid.gem_uploaded_at = now
    job.bid.save(update_fields=["gem_status", "gem_error", "gem_product_id", "gem_product_url", "gem_uploaded_at", "updated_at"])
    AioGemAuditLog.objects.create(
        job=job, actor=user, event=f"extension_{status_value}",
        message=job.progress or job.error or job.rejection_reason,
        metadata={
            "page_url": str(data.get("page_url") or "")[:1000],
            "diagnostics": (data.get("diagnostics") or [])[:40],
        },
    )
    return JsonResponse(_job_data(job))


@csrf_exempt
@require_http_methods(["POST"])
def retry_aio_gem_job(request, job_id):
    data = _json_body(request)
    user, error = _require_role(request, {"admin"}, data)
    if error:
        return error
    _ensure_gem_tables()
    job = AioGemUploadJob.objects.filter(id=job_id).first()
    if not job:
        return JsonResponse({"error": "Upload job not found."}, status=404)
    if job.status not in {"failed", "rejected", "cancelled"}:
        return JsonResponse({"error": "Only failed, rejected or cancelled jobs can be retried."}, status=409)
    job.status = "queued"
    job.progress = "Queued for retry"
    job.error = ""
    job.rejection_reason = ""
    job.next_attempt_at = timezone.now()
    job.save(update_fields=["status", "progress", "error", "rejection_reason", "next_attempt_at", "updated_at"])
    AioGemAuditLog.objects.create(job=job, actor=user, event="job_retried", message="Job manually retried.")
    return JsonResponse(_job_data(job))


@csrf_exempt
@require_http_methods(["PATCH", "POST"])
def update_aio_gem_status(request, bid_id):
    """Same-shaped callback endpoint as Desktop's update_desktop_gem_status,
    for a direct (non-job-queue) status ping from the callback_url in the
    payload above."""
    try:
        bid = AioBid.objects.get(id=bid_id)
    except AioBid.DoesNotExist:
        return JsonResponse({"error": "AIO bid not found."}, status=404)
    data = _json_body(request)
    status_value = str(data.get("status") or "").strip().lower()
    allowed = {"not_started", "queued", "ready_for_fill", "filled", "retrying", "submitted", "published", "rejected", "failed", "cancelled"}
    if status_value not in allowed:
        return JsonResponse({"error": "Invalid GeM status."}, status=400)
    bid.gem_status = status_value
    bid.gem_product_id = str(data.get("product_id") or bid.gem_product_id or "").strip()
    bid.gem_product_url = str(data.get("product_url") or bid.gem_product_url or "").strip()
    bid.gem_error = str(data.get("error") or "").strip()
    if status_value in {"submitted", "published"}:
        bid.gem_uploaded_at = timezone.now()
    bid.save(update_fields=["gem_status", "gem_product_id", "gem_product_url", "gem_error", "gem_uploaded_at", "updated_at"])
    return JsonResponse({"success": True, "gem_status": bid.gem_status})
