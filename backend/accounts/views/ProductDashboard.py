from datetime import timedelta

from django.http import JsonResponse
from django.db.models import Q
from django.utils import timezone
from django.views.decorators.http import require_http_methods

from ..models import DesktopBid, PrinterBid, WorkstationBid


MODELS = {
    "desktop": DesktopBid,
    "workstation": WorkstationBid,
    "printer": PrinterBid,
}


def _filter_user(queryset, username):
    if not username:
        return queryset
    if any(field.name == "username" for field in queryset.model._meta.fields):
        return queryset.filter(Q(user__username=username) | Q(user__isnull=True, username=username))
    return queryset.filter(user__username=username)


@require_http_methods(["GET"])
def admin_dashboard_participants(request, product):
    if product not in ("desktop", "aio", "workstation", "printer", "toner"):
        return JsonResponse({"error": "Unknown product"}, status=404)
    queryset = _model(product).objects.exclude(status="draft").select_related("user")
    users, analysers = set(), set()
    for bid in queryset:
        username = bid.user.username if bid.user else getattr(bid, "username", "")
        if username:
            users.add(username)
        if bid.analyser_username:
            analysers.add(bid.analyser_username)
    return JsonResponse({"users": sorted(users), "analysers": sorted(analysers)})


def _model(product):
    if product == "aio":
        from .Aio import AioBid
        return AioBid
    if product == "toner":
        from .Toner import TonerBid
        return TonerBid
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
    if not hasattr(bid, "review_status"):
        return {"analyzed": "pending", "approved": "approved", "rejected": "rejected", "re-analyze": "rejected"}.get(bid.status)
    if bid.review_status == "reviewed":
        return "pending"
    if bid.review_status == "approved":
        return "approved"
    if bid.review_status == "re-analyze":
        return "rejected"
    return None


def _base_queryset(product, role, year=None, analyser=None):
    if product in ("aio", "toner"):
        queryset = _model(product).objects.filter(status__in=["analyzed", "approved", "rejected", "re-analyze"])
    else:
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
        (_model(product).objects.exclude(status="draft") if product in ("aio", "toner") else _model(product).objects.filter(status="complete"))
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
    queryset = _base_queryset(product, role, year=year, analyser=analyser)
    if role == "admin":
        queryset = _filter_user(queryset, request.GET.get("user"))
    for bid in queryset:
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
    if role == "admin":
        queryset = _filter_user(queryset, request.GET.get("user"))
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
    queryset = _filter_user(_base_queryset(product, "admin", analyser=analyser), request.GET.get("user"))
    if product in ("aio", "toner"):
        pending = queryset.filter(status="analyzed").count()
        approved = queryset.filter(status="approved").count()
        re_analyze = queryset.filter(status__in=["rejected", "re-analyze"]).count()
    else:
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


@require_http_methods(["GET"])
def admin_aio_dashboard_years(request): return _years(request, "aio")

@require_http_methods(["GET"])
def admin_aio_monthly_performance(request): return _monthly(request, "aio", "admin")

@require_http_methods(["GET"])
def admin_aio_daily_activity(request): return _daily(request, "aio", "admin")

@require_http_methods(["GET"])
def admin_aio_stats(request): return _stats(request, "aio")

@require_http_methods(["GET"])
def admin_toner_dashboard_years(request): return _years(request, "toner")

@require_http_methods(["GET"])
def admin_toner_monthly_performance(request): return _monthly(request, "toner", "admin")

@require_http_methods(["GET"])
def admin_toner_daily_activity(request): return _daily(request, "toner", "admin")

@require_http_methods(["GET"])
def admin_toner_stats(request): return _stats(request, "toner")
