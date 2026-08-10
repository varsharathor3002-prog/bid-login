import io
import json
from zoneinfo import ZoneInfo

from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import LongTable, Paragraph, SimpleDocTemplate, TableStyle

from ..models import ComponentRate, ComponentRateHistory


VALID_PRODUCTS = {"desktop", "workstation", "aio"}


def _serialize(rate):
    return {
        "product": rate.product,
        "category": rate.category,
        "name": rate.component_name,
        "price": float(rate.price),
        "updated_at": rate.updated_at.isoformat(),
    }


@csrf_exempt
@require_http_methods(["GET", "PUT", "DELETE"])
def component_rates(request):
    product = (request.GET.get("product") or "").lower()
    if product and product not in VALID_PRODUCTS:
        return JsonResponse({"error": "Invalid product."}, status=400)

    if request.method == "GET":
        rates = ComponentRate.objects.all()
        if product:
            rates = rates.filter(product=product)
        return JsonResponse({"rates": [_serialize(rate) for rate in rates]})

    try:
        data = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON."}, status=400)

    product = str(data.get("product", product)).lower()
    category = str(data.get("category", "")).strip()
    name = str(data.get("name", "")).strip()
    if product not in VALID_PRODUCTS or not category or not name:
        return JsonResponse({"error": "Product, category and name are required."}, status=400)

    if request.method == "DELETE":
        deleted, _ = ComponentRate.objects.filter(
            product=product, category=category, component_name=name
        ).delete()
        return JsonResponse({"restored": bool(deleted)})

    try:
        price = float(data.get("price"))
        if price < 0:
            raise ValueError
    except (TypeError, ValueError):
        return JsonResponse({"error": "Price must be zero or greater."}, status=400)

    rate, _ = ComponentRate.objects.update_or_create(
        product=product,
        category=category,
        component_name=name,
        defaults={"price": price},
    )
    ComponentRateHistory.objects.create(
        product=product,
        category=category,
        component_name=name,
        price=price,
    )
    return JsonResponse({"rate": _serialize(rate)})


@require_http_methods(["POST"])
@csrf_exempt
def component_rates_pdf(request):
    try:
        data = json.loads(request.body or "{}")
        product = str(data.get("product", "")).lower()
        rows = data.get("rows", [])
    except (json.JSONDecodeError, AttributeError):
        return JsonResponse({"error": "Invalid JSON."}, status=400)
    if product not in VALID_PRODUCTS or not isinstance(rows, list):
        return JsonResponse({"error": "Invalid rate list."}, status=400)

    output = io.BytesIO()
    doc = SimpleDocTemplate(output, pagesize=landscape(A4), rightMargin=12*mm, leftMargin=12*mm, topMargin=12*mm, bottomMargin=12*mm)
    styles = getSampleStyleSheet()
    styles["BodyText"].fontSize = 9.5
    styles["BodyText"].leading = 11.5

    def price_text(value):
        try:
            number = float(value)
            return f"{number:,.2f}".rstrip("0").rstrip(".")
        except (TypeError, ValueError):
            return str(value or "-")

    india_tz = ZoneInfo("Asia/Kolkata")
    history_by_component = {}
    change_dates = set()
    for entry in ComponentRateHistory.objects.filter(product=product).order_by("changed_at", "id"):
        change_date = entry.changed_at.astimezone(india_tz).date()
        change_dates.add(change_date)
        component_dates = history_by_component.setdefault(
            (entry.category, entry.component_name), {}
        )
        component_dates.setdefault(change_date, []).append(price_text(entry.price))

    ordered_dates = sorted(change_dates)
    table_rows = [[
        "Category",
        "Specification",
        "Original Price",
        *[change_date.strftime("%d-%m-%Y") for change_date in ordered_dates],
    ]]
    for row in rows:
        component_dates = history_by_component.get(
            (str(row.get("category", "")), str(row.get("name", ""))), {}
        )
        table_rows.append([
            Paragraph(str(row.get("categoryLabel", "")), styles["BodyText"]),
            Paragraph(str(row.get("name", "")), styles["BodyText"]),
            Paragraph(price_text(row.get("originalPrice", "-")), styles["BodyText"]),
            *[
                Paragraph(
                    " &rarr; ".join(component_dates.get(change_date, [])) or "-",
                    styles["BodyText"],
                )
                for change_date in ordered_dates
            ],
        ])

    category_width = 28*mm
    specification_width = 72*mm
    original_price_width = 30*mm
    fixed_width = category_width + specification_width + original_price_width
    available_date_width = landscape(A4)[0] - 24*mm - fixed_width
    date_width = available_date_width / max(len(ordered_dates), 1)
    table = LongTable(
        table_rows,
        repeatRows=1,
        colWidths=[category_width, specification_width, original_price_width]
        + [date_width] * len(ordered_dates),
    )
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a8a")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), .4, colors.HexColor("#cbd5e1")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("FONTSIZE", (0, 1), (-1, -1), 9.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
    ]))
    doc.build([Paragraph(f"{product.title()} Component Rate List", styles["Title"]), table])
    response = HttpResponse(output.getvalue(), content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="{product}-component-rates.pdf"'
    return response
