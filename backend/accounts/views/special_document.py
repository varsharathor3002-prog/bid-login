from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

ALLOWED_EXTENSIONS = (".pdf", ".jpg", ".jpeg", ".png")


def _file_url(request, field):
    try:
        if field and field.name:
            return request.build_absolute_uri(field.url)
    except Exception:
        pass
    return ""


def make_special_document_view(get_model, ensure_table=None):
    """Lets the Analyser replace or remove a bid's ATC special document
    without going through the user's update-docs step (which also resets
    the bid's status). POST multipart "atc_special_document" to replace,
    or POST remove=1 to clear it."""

    @csrf_exempt
    @require_http_methods(["POST"])
    def view(request, bid_id):
        if ensure_table:
            ensure_table()
        model = get_model()
        bid = model.objects.filter(id=bid_id).first()
        if bid is None:
            return JsonResponse({"error": "Bid not found"}, status=404)

        uploaded = request.FILES.get("atc_special_document")
        if uploaded:
            if not uploaded.name.lower().endswith(ALLOWED_EXTENSIONS):
                return JsonResponse({"error": "Only PDF, JPG or PNG files are allowed."}, status=400)
            bid.atc_special_document = uploaded
        elif str(request.POST.get("remove", "")).lower() in ("1", "true", "yes"):
            bid.atc_special_document = None
        else:
            return JsonResponse({"error": "No file uploaded."}, status=400)

        bid.save(update_fields=["atc_special_document"])
        return JsonResponse({
            "success": True,
            "atc_special_document": _file_url(request, bid.atc_special_document),
        })

    return view


def _desktop():
    from ..models import DesktopBid
    return DesktopBid


def _workstation():
    from ..models import WorkstationBid
    return WorkstationBid


def _aio():
    from .Aio import AioBid
    return AioBid


def _toner():
    from .Toner import TonerBid
    return TonerBid


def _ensure_aio():
    from .Aio import _ensure_table
    _ensure_table()


def _ensure_toner():
    from .Toner import _ensure_table
    _ensure_table()


desktop_special_document = make_special_document_view(_desktop)
workstation_special_document = make_special_document_view(_workstation)
aio_special_document = make_special_document_view(_aio, _ensure_aio)
toner_special_document = make_special_document_view(_toner, _ensure_toner)
