import json
import re
from collections import Counter

from django.db import transaction
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from ..models import GemBidAssignment, GemBidAssignmentHistory, GemBidOpportunity, User
from .Gem import _require_role


FINAL_STATUSES = {"participated", "skipped", "expired"}
VALID_STATUSES = {value for value, _ in GemBidAssignment.STATUS_CHOICES}


def _category(value):
    item = str(value or "").lower()
    matches = {
        "printer": bool(re.search(r"printer|multifunction|\bmfp\b", item)),
        "aio": bool(re.search(r"all[ -]*in[ -]*one|\baio\b", item)),
        "workstation": "workstation" in item,
        "high_end_desktop": bool(re.search(r"high[ -]*(?:end|level)[^,;]*desktop", item)),
        "entry_mid_desktop": bool(re.search(r"(?:entry|mid(?:dle)?)[^,;]*desktop", item)),
        "toner": bool(re.search(r"toner|cartridge", item)),
    }
    found = [key for key, matched in matches.items() if matched]
    if re.search(r"bunch|\bboq\b", item) or len(found) > 1:
        return "bunch_bid"
    if found:
        return found[0]
    return "entry_mid_desktop" if "desktop computer" in item else "other"


def _assignment_data(row):
    opportunity = row.opportunity
    return {
        "id": row.id,
        "opportunity_id": opportunity.id,
        "bid_no": opportunity.bid_no,
        "item": opportunity.product_name,
        "category": _category(opportunity.product_name),
        "bid_date": opportunity.bid_date.isoformat() if opportunity.bid_date else "",
        "end_date": opportunity.end_date.isoformat() if opportunity.end_date else "",
        "pdf_url": opportunity.pdf_url,
        "assigned_to": {"id": row.assigned_to_id, "username": row.assigned_to.username, "email": row.assigned_to.email},
        "assigned_by": row.assigned_by.username,
        "status": row.status,
        "assigned_at": row.assigned_at.isoformat(),
        "updated_at": row.updated_at.isoformat(),
    }


@csrf_exempt
@require_http_methods(["GET", "POST"])
def gem_bid_assignments(request):
    user, error = _require_role(request, {"admin", "analyser", "user"})
    if error:
        return error

    if request.method == "GET":
        now = timezone.localtime()
        expiring = GemBidAssignment.objects.filter(
            opportunity__end_date__lte=now,
            status__in=["assigned", "in_progress"],
        )
        if expiring.exists():
            expiring.update(status="expired", completed_at=now)
        assignments = GemBidAssignment.objects.select_related("opportunity", "assigned_to", "assigned_by")
        if user.role == "user":
            assignments = assignments.filter(assigned_to=user, hidden_for_user=False)
        elif user.role == "analyser":
            assignments = assignments.filter(hidden_for_analyser=False)
        elif user.role == "admin":
            assignments = assignments.filter(hidden_for_admin=False)
        status = request.GET.get("status", "").strip()
        if status in VALID_STATUSES:
            assignments = assignments.filter(status=status)
        elif user.role == "user":
            assignments = assignments.exclude(status="skipped")
        employee_id = request.GET.get("employee", "").strip()
        if employee_id.isdigit() and user.role in {"admin", "analyser"}:
            assignments = assignments.filter(assigned_to_id=int(employee_id))

        employees = []
        if user.role in {"admin", "analyser"}:
            employees = list(User.objects.filter(role="user").order_by("username", "id").values("id", "username", "email"))
            employee_counts = Counter(
                GemBidAssignment.objects.exclude(status__in=FINAL_STATUSES)
                .values_list("assigned_to_id", flat=True)
            )
            for employee in employees:
                employee["active_count"] = employee_counts.get(employee["id"], 0)
        return JsonResponse({
            "employees": employees,
            "results": [_assignment_data(row) for row in assignments[:5000]],
        })

    try:
        body = json.loads(request.body or "{}")
    except (TypeError, ValueError):
        return JsonResponse({"error": "Invalid JSON payload."}, status=400)
    action = str(body.get("action") or "assign")

    if action == "assign":
        if user.role != "analyser":
            return JsonResponse({"error": "Only an analyser can assign bids."}, status=403)
        opportunity_ids = list(dict.fromkeys(body.get("opportunity_ids") or []))
        if not opportunity_ids:
            return JsonResponse({"error": "Select at least one bid."}, status=400)
        employee = User.objects.filter(id=body.get("assigned_to"), role="user").first()
        if not employee:
            return JsonResponse({"error": "Select a valid user."}, status=400)
        now = timezone.localtime()
        with transaction.atomic():
            opportunities = list(GemBidOpportunity.objects.select_for_update().filter(
                id__in=opportunity_ids, is_deleted=False, assignment__isnull=True, end_date__gt=now,
            ))
            if len(opportunities) != len(opportunity_ids):
                return JsonResponse({"error": "One or more bids are expired or already assigned. Refresh and try again."}, status=409)
            GemBidAssignment.objects.bulk_create([
                GemBidAssignment(opportunity=opportunity, assigned_to=employee, assigned_by=user)
                for opportunity in opportunities
            ], batch_size=500)
            created = list(GemBidAssignment.objects.filter(
                opportunity_id__in=opportunity_ids
            ))
            GemBidAssignmentHistory.objects.bulk_create([
                GemBidAssignmentHistory(
                    assignment=assignment, action="assigned", to_user=employee,
                    new_status="assigned", changed_by=user,
                ) for assignment in created
            ], batch_size=500)
        return JsonResponse({"assigned": len(created), "assignment_ids": [row.id for row in created]})

    if action == "bulk_hide":
        assignment_ids = list(dict.fromkeys(body.get("assignment_ids") or []))
        if not assignment_ids or len(assignment_ids) > 200:
            return JsonResponse({"error": "Select between 1 and 200 bids."}, status=400)
        rows = GemBidAssignment.objects.select_related("assigned_to").filter(id__in=assignment_ids)
        if user.role == "user":
            rows = rows.filter(assigned_to=user)
        rows = list(rows)
        if len(rows) != len(assignment_ids):
            return JsonResponse({"error": "One or more selected bids are not available to this account."}, status=403)
        field = {"user": "hidden_for_user", "analyser": "hidden_for_analyser", "admin": "hidden_for_admin"}[user.role]
        now = timezone.now()
        with transaction.atomic():
            GemBidAssignment.objects.filter(id__in=assignment_ids).update(**{field: True, "updated_at": now})
            GemBidAssignmentHistory.objects.bulk_create([
                GemBidAssignmentHistory(
                    assignment=row, action=f"hidden_by_{user.role}",
                    from_user=row.assigned_to, to_user=row.assigned_to,
                    old_status=row.status, new_status=row.status, changed_by=user,
                ) for row in rows
            ])
        return JsonResponse({"hidden": len(rows)})

    assignment = GemBidAssignment.objects.select_related("assigned_to").filter(id=body.get("assignment_id")).first()
    if not assignment:
        return JsonResponse({"error": "Assignment not found."}, status=404)
    if user.role == "user" and assignment.assigned_to_id != user.id:
        return JsonResponse({"error": "This bid is assigned to another user."}, status=403)

    if action == "status":
        if user.role != "user":
            return JsonResponse({"error": "Only the assigned user can update participation status."}, status=403)
        new_status = str(body.get("status") or "")
        if new_status not in VALID_STATUSES:
            return JsonResponse({"error": "Invalid assignment status."}, status=400)
        old_status = assignment.status
        assignment.status = new_status
        assignment.completed_at = timezone.now() if new_status in FINAL_STATUSES else None
        assignment.save(update_fields=["status", "completed_at", "updated_at"])
        GemBidAssignmentHistory.objects.create(
            assignment=assignment, action="status_changed", from_user=assignment.assigned_to,
            to_user=assignment.assigned_to, old_status=old_status, new_status=new_status, changed_by=user,
        )
        return JsonResponse({"updated": True})

    if action == "hide":
        field = {
            "user": "hidden_for_user",
            "analyser": "hidden_for_analyser",
            "admin": "hidden_for_admin",
        }[user.role]
        setattr(assignment, field, True)
        assignment.save(update_fields=[field, "updated_at"])
        GemBidAssignmentHistory.objects.create(
            assignment=assignment, action=f"hidden_by_{user.role}",
            from_user=assignment.assigned_to, to_user=assignment.assigned_to,
            old_status=assignment.status, new_status=assignment.status, changed_by=user,
        )
        return JsonResponse({"hidden": True})

    if action == "reassign" and user.role == "analyser":
        employee = User.objects.filter(id=body.get("assigned_to"), role="user").first()
        if not employee:
            return JsonResponse({"error": "Select a valid user."}, status=400)
        previous = assignment.assigned_to
        previous_status = assignment.status
        assignment.assigned_to = employee
        assignment.status = "assigned"
        assignment.completed_at = None
        assignment.save(update_fields=["assigned_to", "status", "completed_at", "updated_at"])
        GemBidAssignmentHistory.objects.create(
            assignment=assignment, action="reassigned", from_user=previous, to_user=employee,
            old_status=previous_status, new_status="assigned", changed_by=user,
        )
        return JsonResponse({"updated": True})

    return JsonResponse({"error": "Unsupported action."}, status=400)
