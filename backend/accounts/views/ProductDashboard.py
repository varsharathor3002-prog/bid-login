from datetime import timedelta

from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_http_methods

from ..models import PrinterBid, WorkstationBid


MODELS = {
    "workstation": WorkstationBid,
    "printer": PrinterBid,
}


def _model(product):
    return MODELS[product]


def _analyser_label(bid):
    if bid.review_status == "pending":
        return "pending"
    if bid.review_status == "re-analyze":
        return "reAnalyze"
    if bid.review_status in ("reviewed", "approved"):
        return "reviewed"
    return None


def _admin_label(bid):
    if bid.review_status == "reviewed":
        return "pending"
    if bid.review_status == "approved":
        return "approved"
    if bid.review_status == "re-analyze":
        return "rejected"
    return None


def _base_queryset(product, role, year=None, analyser=None):
    queryset = _model(product).objects.filter(status="complete")
    if role == "admin":
        queryset = queryset.filter(review_status__in=["reviewed", "approved", "re-analyze"])
    else:
        queryset = queryset.filter(review_status__in=["pending", "reviewed", "approved", "re-analyze"])
    if year:
        queryset = queryset.filter(created_at__year=year)
    if analyser:
        queryset = queryset.filter(analyser_username=analyser)
    return queryset


def _years(request, product):
    current_year = timezone.now().year
    db_years = list(
        _model(product).objects.filter(status="complete")
        .dates("created_at", "year", order="DESC")
    )
    years = sorted({date.year for date in db_years} | {current_year}, reverse=True)
    return JsonResponse(years, safe=False)


def _monthly(request, product, role):
    try:
        year = int(request.GET.get("year") or timezone.now().year)
    except (TypeError, ValueError):
        year = timezone.now().year
    analyser = request.GET.get("analyser") if role == "admin" else None
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    status_keys = ["pending", "approved", "rejected"] if role == "admin" else ["pending", "reviewed", "reAnalyze"]
    result = [
        {"month": name, "monthNumber": index + 1, "total": 0, **{key: 0 for key in status_keys}}
        for index, name in enumerate(months)
    ]
    label_for = _admin_label if role == "admin" else _analyser_label
    for bid in _base_queryset(product, role, year=year, analyser=analyser):
        label = label_for(bid)
        if not bid.created_at or label not in status_keys:
            continue
        row = result[bid.created_at.month - 1]
        row["total"] += 1
        row[label] += 1
    return JsonResponse(result, safe=False)


def _daily(request, product, role):
    today = timezone.localdate()
    sunday = today - timedelta(days=(today.weekday() + 1) % 7)
    days = [sunday + timedelta(days=index) for index in range((today - sunday).days + 1)]
    status_keys = ["pending", "approved", "rejected"] if role == "admin" else ["pending", "reviewed", "reAnalyze"]
    result = [
        {
            "date": day.isoformat(),
            "day": day.strftime("%A"),
            "shortDay": day.strftime("%a"),
            "total": 0,
            **{key: 0 for key in status_keys},
        }
        for day in days
    ]
    date_map = {row["date"]: row for row in result}
    analyser = request.GET.get("analyser") if role == "admin" else None
    queryset = _base_queryset(product, role, analyser=analyser).filter(
        created_at__date__gte=sunday,
        created_at__date__lte=today,
    )
    label_for = _admin_label if role == "admin" else _analyser_label
    for bid in queryset:
        label = label_for(bid)
        if not bid.created_at or label not in status_keys:
            continue
        # updated_at changes for review/approval and must not move an old bid
        # into today's activity chart.
        key = timezone.localtime(bid.created_at).date().isoformat()
        if key in date_map:
            date_map[key]["total"] += 1
            date_map[key][label] += 1
    return JsonResponse(result, safe=False)


def _stats(request, product):
    analyser = request.GET.get("analyser")
    queryset = _base_queryset(product, "admin", analyser=analyser)
    pending = queryset.filter(review_status="reviewed").count()
    approved = queryset.filter(review_status="approved").count()
    re_analyze = queryset.filter(review_status="re-analyze").count()
    return JsonResponse({
        "pending": pending,
        "approved": approved,
        "reAnalyze": re_analyze,
        "total": pending + approved + re_analyze,
    })


@require_http_methods(["GET"])
def workstation_dashboard_years(request): return _years(request, "workstation")

@require_http_methods(["GET"])
def workstation_monthly_performance(request): return _monthly(request, "workstation", "analyser")

@require_http_methods(["GET"])
def workstation_daily_activity(request): return _daily(request, "workstation", "analyser")

@require_http_methods(["GET"])
def admin_workstation_dashboard_years(request): return _years(request, "workstation")

@require_http_methods(["GET"])
def admin_workstation_monthly_performance(request): return _monthly(request, "workstation", "admin")

@require_http_methods(["GET"])
def admin_workstation_daily_activity(request): return _daily(request, "workstation", "admin")

@require_http_methods(["GET"])
def admin_workstation_stats(request): return _stats(request, "workstation")

@require_http_methods(["GET"])
def printer_dashboard_years(request): return _years(request, "printer")

@require_http_methods(["GET"])
def printer_monthly_performance(request): return _monthly(request, "printer", "analyser")

@require_http_methods(["GET"])
def printer_daily_activity(request): return _daily(request, "printer", "analyser")

@require_http_methods(["GET"])
def admin_printer_dashboard_years(request): return _years(request, "printer")

@require_http_methods(["GET"])
def admin_printer_monthly_performance(request): return _monthly(request, "printer", "admin")

@require_http_methods(["GET"])
def admin_printer_daily_activity(request): return _daily(request, "printer", "admin")

@require_http_methods(["GET"])
def admin_printer_stats(request): return _stats(request, "printer")
