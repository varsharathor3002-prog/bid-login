import base64
import io
import json
from pathlib import Path

from django.db import transaction
from django.conf import settings
from django.core import signing
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from PyPDF2 import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.pdfbase.pdfmetrics import stringWidth

from ..gem_crypto import decrypt_text, encrypt_text
from ..models import (
    DesktopBid,
    GemAccount,
    GemAuditLog,
    GemUploadJob,
    User,
)
from .Desktop import _desktop_gem_payload


def _json_body(request):
    try:
        data = json.loads(request.body or "{}")
        return data if isinstance(data, dict) else {}
    except (TypeError, ValueError):
        return {}


def _request_user(request, data=None):
    try:
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            return None
        payload = signing.loads(
            header[7:], salt="gem-api-auth", max_age=12 * 60 * 60
        )
        user = User.objects.filter(id=int(payload["user_id"])).first()
        if not user or user.role != payload.get("role"):
            return None
        return user
    except (KeyError, TypeError, ValueError, signing.BadSignature):
        return None


def _require_role(request, roles, data=None):
    user = _request_user(request, data)
    if not user:
        return None, JsonResponse({"error": "Authentication required."}, status=401)
    if user.role not in roles:
        return None, JsonResponse({"error": "You are not authorized for this action."}, status=403)
    return user, None


def _extension_token(user):
    return signing.dumps(
        {"user_id": user.id, "role": user.role},
        salt="gem-api-auth",
        compress=True,
    )


def _account_admin_data(account):
    return {
        "id": account.id,
        "label": account.label,
        "username": decrypt_text(account.username_encrypted),
        "is_active": account.is_active,
        "category_mapping": account.category_mapping or [],
        "has_password": bool(account.password_encrypted),
        "created_at": account.created_at.isoformat(),
        "updated_at": account.updated_at.isoformat(),
    }


def _account_picker_data(account):
    return {
        "id": account.id,
        "label": account.label,
    }


def _job_data(job, include_audit=False):
    data = {
        "id": job.id,
        "bid_id": job.bid_id,
        "bid_no": job.bid.bid_no,
        "model_number": job.bid.model_number or "",
        "account_id": job.account_id,
        "account_label": job.account.label if job.account else "Manual GeM login",
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
@require_http_methods(["GET", "POST"])
def gem_accounts(request):
    if request.method == "GET":
        user, error = _require_role(request, {"admin", "analyser"})
        if error:
            return error
        accounts = GemAccount.objects.filter(is_active=True)
        if user.role == "admin" and request.GET.get("manage") == "1":
            return JsonResponse([_account_admin_data(item) for item in accounts], safe=False)
        return JsonResponse([_account_picker_data(item) for item in accounts], safe=False)

    data = _json_body(request)
    user, error = _require_role(request, {"admin"}, data)
    if error:
        return error
    label = str(data.get("label") or "").strip()
    username = str(data.get("username") or "").strip()
    password = str(data.get("password") or "")
    if not label or not username or not password:
        return JsonResponse({"error": "Label, username and password are required."}, status=400)
    if GemAccount.objects.filter(label__iexact=label).exists():
        return JsonResponse({"error": "An account with this label already exists."}, status=409)
    account = GemAccount.objects.create(
        label=label,
        username_encrypted=encrypt_text(username),
        password_encrypted=encrypt_text(password),
        category_mapping=data.get("category_mapping") or [],
        created_by=user,
    )
    return JsonResponse(_account_admin_data(account), status=201)


@csrf_exempt
@require_http_methods(["PATCH", "DELETE"])
def gem_account_detail(request, account_id):
    data = _json_body(request)
    user, error = _require_role(request, {"admin"}, data)
    if error:
        return error
    account = GemAccount.objects.filter(id=account_id).first()
    if not account:
        return JsonResponse({"error": "GeM account not found."}, status=404)
    if request.method == "DELETE":
        if account.upload_jobs.filter(status__in=["queued", "ready_for_fill", "filled", "retrying"]).exists():
            return JsonResponse({"error": "This account has active upload jobs."}, status=409)
        account.is_active = False
        account.save(update_fields=["is_active", "updated_at"])
        return JsonResponse({"success": True})

    if "label" in data:
        account.label = str(data.get("label") or "").strip()
    if "username" in data and str(data.get("username") or "").strip():
        account.username_encrypted = encrypt_text(str(data["username"]).strip())
    if data.get("password"):
        account.password_encrypted = encrypt_text(str(data["password"]))
        if hasattr(account, "session"):
            account.session.delete()
    if "category_mapping" in data:
        account.category_mapping = data.get("category_mapping") or []
    if "is_active" in data:
        account.is_active = bool(data.get("is_active"))
    account.save()
    return JsonResponse(_account_admin_data(account))


@csrf_exempt
@require_http_methods(["POST"])
def create_gem_upload_job(request, bid_id):
    data = _json_body(request)
    user, error = _require_role(request, {"analyser", "admin"}, data)
    if error:
        return error
    bid = DesktopBid.objects.filter(id=bid_id).first()
    if not bid:
        return JsonResponse({"error": "Desktop bid not found."}, status=404)
    if bid.review_status != "approved":
        return JsonResponse({"error": "Admin approval is required before GeM upload."}, status=409)
    payload = _desktop_gem_payload(bid, request, {})
    payload.pop("gem_account", None)
    category_key = (payload.get("category") or {}).get("key", "")
    active = bid.gem_upload_jobs.filter(
        status__in=["queued", "ready_for_fill", "retrying"]
    ).first()
    if active:
        active.payload_snapshot = payload
        active.save(update_fields=["payload_snapshot", "updated_at"])
        return JsonResponse({
            **_job_data(active),
            "extension_token": _extension_token(user),
        }, status=200)

    with transaction.atomic():
        job = GemUploadJob.objects.create(
            bid=bid,
            account=None,
            triggered_by=user,
            payload_snapshot=payload,
            next_attempt_at=timezone.now(),
        )
        GemAuditLog.objects.create(
            job=job,
            actor=user,
            event="job_created",
            message="Upload queued for manual GeM login through the Chrome extension.",
        )
        bid.gem_account = "Manual GeM login"
        bid.gem_status = "queued"
        bid.gem_error = ""
        bid.save(update_fields=["gem_account", "gem_status", "gem_error", "updated_at"])
    return JsonResponse({
        **_job_data(job),
        "extension_token": _extension_token(user),
    }, status=201)


@csrf_exempt
@require_http_methods(["GET"])
def gem_jobs(request):
    user, error = _require_role(request, {"admin", "analyser"})
    if error:
        return error
    jobs = GemUploadJob.objects.select_related("bid", "account", "triggered_by")
    bid_id = request.GET.get("bid_id")
    if bid_id:
        jobs = jobs.filter(bid_id=bid_id)
    status_value = request.GET.get("status")
    if status_value:
        jobs = jobs.filter(status=status_value)
    return JsonResponse([_job_data(item) for item in jobs[:200]], safe=False)


@csrf_exempt
@require_http_methods(["GET", "PATCH"])
def gem_job_detail(request, job_id):
    data = _json_body(request) if request.method == "PATCH" else None
    user, error = _require_role(request, {"admin", "analyser"}, data)
    if error:
        return error
    job = GemUploadJob.objects.select_related(
        "bid", "account", "triggered_by"
    ).filter(id=job_id).first()
    if not job:
        return JsonResponse({"error": "Upload job not found."}, status=404)
    if request.method == "PATCH":
        if user.role != "admin":
            return JsonResponse({"error": "Only Admin can change a job account."}, status=403)
        account = GemAccount.objects.filter(
            id=data.get("account_id"), is_active=True
        ).first()
        if not account:
            return JsonResponse({"error": "Please select a valid GeM account."}, status=400)
        job.account = account
        job.status = "queued"
        job.progress = "Account changed by Admin; waiting for extension"
        job.error = ""
        job.rejection_reason = ""
        job.save(update_fields=[
            "account", "status", "progress", "error", "rejection_reason", "updated_at",
        ])
        GemAuditLog.objects.create(
            job=job, actor=user, event="account_changed",
            message=f"Admin changed account to {account.label}.",
        )
    return JsonResponse(_job_data(job, include_audit=True))


def _extension_job_data(job):
    return {
        **_job_data(job),
        "payload": job.payload_snapshot,
    }


@csrf_exempt
@require_http_methods(["GET"])
def extension_jobs(request):
    user, error = _require_role(request, {"analyser", "admin"})
    if error:
        return error
    jobs = GemUploadJob.objects.select_related("bid", "account", "triggered_by").filter(
        status__in=["queued", "ready_for_fill", "filled"]
    )
    jobs = list(jobs[:25])
    for job in jobs:
        payload = _desktop_gem_payload(job.bid, request, {})
        payload.pop("gem_account", None)
        if job.payload_snapshot != payload:
            job.payload_snapshot = payload
            job.save(update_fields=["payload_snapshot", "updated_at"])
    return JsonResponse([_extension_job_data(job) for job in jobs], safe=False)


@csrf_exempt
@require_http_methods(["POST"])
def extension_claim_job(request, job_id):
    data = _json_body(request)
    user, error = _require_role(request, {"analyser", "admin"}, data)
    if error:
        return error
    job = GemUploadJob.objects.select_related("bid", "account", "triggered_by").filter(id=job_id).first()
    if not job:
        return JsonResponse({"error": "Upload job not found."}, status=404)
    if job.status not in {"queued", "ready_for_fill"}:
        return JsonResponse({"error": "This job is not available for form filling."}, status=409)
    payload = _desktop_gem_payload(job.bid, request, {})
    payload.pop("gem_account", None)
    job.payload_snapshot = payload
    job.status = "ready_for_fill"
    job.progress = "Ready for the Chrome extension to fill GeM"
    job.attempts += 1
    job.started_at = job.started_at or timezone.now()
    job.save(update_fields=[
        "payload_snapshot", "status", "progress", "attempts", "started_at", "updated_at",
    ])
    GemAuditLog.objects.create(job=job, actor=user, event="extension_claimed", message="Chrome extension claimed the job.")
    return JsonResponse(_extension_job_data(job))


def _mrp_for_model(model_number):
    return 122000 if str(model_number or "").upper().startswith("ACL-1082DS-") else 100000


def _amount_words(amount):
    return {
        100000: "ONE LAKH",
        122000: "ONE LAKH TWENTY TWO THOUSAND",
    }.get(amount, str(amount))


def _draw_wrapped_text(
    pdf, text, x, y, width, font_name="Helvetica", font_size=11, bold_words=None
):
    bold_words = set(bold_words or [])
    words = text.split()
    lines = []
    current = []
    current_width = 0
    for word in words:
        word_font = "Helvetica-Bold" if word in bold_words else font_name
        word_width = stringWidth(word, word_font, font_size)
        space_width = stringWidth(" ", font_name, font_size) if current else 0
        if current and current_width + space_width + word_width > width:
            lines.append(current)
            current = [(word, word_font)]
            current_width = word_width
        else:
            current.append((word, word_font))
            current_width += space_width + word_width
    if current:
        lines.append(current)
    for line in lines:
        cursor = x
        for index, (word, word_font) in enumerate(line):
            if index:
                cursor += stringWidth(" ", font_name, font_size)
            pdf.setFont(word_font, font_size)
            pdf.drawString(cursor, y, word)
            cursor += stringWidth(word, word_font, font_size)
        y -= 15


def _desktop_mrp_pdf(job):
    template = Path(settings.BASE_DIR) / "accounts" / "document_templates" / "desktop_mrp_declaration.pdf"
    source = PdfReader(str(template))
    model_number = str(job.bid.model_number or "").strip().upper()
    amount = _mrp_for_model(model_number)
    category = (
        "High End Desktop Computer"
        if model_number.startswith("ACL-1082DS-")
        else "Entry and Mid-Level Desktop Computer"
    )
    declaration = (
        f"We hereby declare that the Maximum Retail Price (MRP) of ACXXEL DESKTOP "
        f"{model_number} bearing brand name ACXXEL and Model No: {model_number} "
        f"to be listed under GeM Category: -> {category} is Rs. {amount} "
        f"(Rupees {_amount_words(amount)} ONLY)."
    )

    overlay_bytes = io.BytesIO()
    overlay = canvas.Canvas(overlay_bytes, pagesize=(612, 792))
    overlay.setFillColorRGB(1, 1, 1)
    overlay.rect(65, 387, 500, 75, stroke=0, fill=1)
    overlay.setFillColorRGB(0, 0, 0)
    _draw_wrapped_text(
        overlay,
        declaration,
        75,
        448,
        475,
        bold_words={model_number},
    )
    overlay.save()
    overlay_bytes.seek(0)

    source.pages[0].merge_page(PdfReader(overlay_bytes).pages[0])
    output = io.BytesIO()
    writer = PdfWriter()
    writer.add_page(source.pages[0])
    writer.write(output)
    return output.getvalue()


@require_http_methods(["GET"])
def extension_mrp_document(request, job_id):
    user, error = _require_role(request, {"analyser", "admin"})
    if error:
        return error
    job = GemUploadJob.objects.select_related("bid", "triggered_by").filter(id=job_id).first()
    if not job:
        return JsonResponse({"error": "Upload job not found."}, status=404)
    pdf_bytes = _desktop_mrp_pdf(job)
    return JsonResponse({
        "filename": f"ACXXEL_MRP_Declaration_{job.bid.model_number}.pdf",
        "content_type": "application/pdf",
        "base64": base64.b64encode(pdf_bytes).decode("ascii"),
    })


@require_http_methods(["GET"])
def extension_bis_document(request, job_id):
    user, error = _require_role(request, {"analyser", "admin"})
    if error:
        return error
    job = GemUploadJob.objects.select_related("triggered_by").filter(id=job_id).first()
    if not job:
        return JsonResponse({"error": "Upload job not found."}, status=404)
    certificate = (
        Path(settings.BASE_DIR)
        / "accounts"
        / "document_templates"
        / "desktop_bis_certificate.pdf"
    )
    if not certificate.exists():
        return JsonResponse({"error": "BIS certificate template is missing."}, status=404)
    return JsonResponse({
        "filename": "ACXXEL_BIS_Certificate_2025.pdf",
        "content_type": "application/pdf",
        "base64": base64.b64encode(certificate.read_bytes()).decode("ascii"),
    })


@require_http_methods(["GET"])
def extension_product_images(request, job_id):
    user, error = _require_role(request, {"analyser", "admin"})
    if error:
        return error
    job = GemUploadJob.objects.select_related("bid", "triggered_by").filter(id=job_id).first()
    if not job:
        return JsonResponse({"error": "Upload job not found."}, status=404)
    image_dir = (
        Path(settings.BASE_DIR)
        / "accounts"
        / "document_templates"
        / "desktop_product_images"
    )
    slots = (
        ("front", "front"),
        ("side", "side"),
        ("interior", "interior"),
    )
    images = []
    content_types = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg"}
    for slot, stem in slots:
        image_path = next((
            candidate
            for extension in (".png", ".jpg", ".jpeg")
            if (candidate := image_dir / f"{stem}{extension}").exists()
        ), None)
        if not image_path:
            return JsonResponse({
                "error": f"Desktop {slot} image is missing.",
            }, status=404)
        images.append({
            "slot": slot,
            "filename": f"ACXXEL_DESKTOP_{stem}{image_path.suffix.lower()}",
            "content_type": content_types[image_path.suffix.lower()],
            "base64": base64.b64encode(image_path.read_bytes()).decode("ascii"),
        })
    return JsonResponse({"images": images})


@csrf_exempt
@require_http_methods(["POST"])
def extension_report_job(request, job_id):
    data = _json_body(request)
    user, error = _require_role(request, {"analyser", "admin"}, data)
    if error:
        return error
    job = GemUploadJob.objects.select_related("bid", "account", "triggered_by").filter(id=job_id).first()
    if not job:
        return JsonResponse({"error": "Upload job not found."}, status=404)
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
    job.bid.save(update_fields=["gem_status", "gem_error", "gem_product_id", "gem_product_url", "updated_at"])
    GemAuditLog.objects.create(
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
def retry_gem_job(request, job_id):
    data = _json_body(request)
    user, error = _require_role(request, {"admin"}, data)
    if error:
        return error
    job = GemUploadJob.objects.filter(id=job_id).first()
    if not job:
        return JsonResponse({"error": "Upload job not found."}, status=404)
    if job.status not in {"failed", "rejected", "cancelled"}:
        return JsonResponse({"error": "Only failed, rejected or cancelled jobs can be retried."}, status=409)
    job.status = "queued"
    job.progress = "Queued for retry"
    job.error = ""
    job.rejection_reason = ""
    job.next_attempt_at = timezone.now()
    job.save(update_fields=[
        "status", "progress", "error", "rejection_reason",
        "next_attempt_at", "updated_at",
    ])
    GemAuditLog.objects.create(
        job=job, actor=user, event="job_retried", message="Job manually retried."
    )
    return JsonResponse(_job_data(job))
