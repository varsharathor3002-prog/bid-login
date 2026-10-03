import json

from django.http import JsonResponse

from ..models import CatalogueProduct


def existing_model_for_config(match_view, request, bid_id, model_number):
    """Return the model number Find Model already gives for this bid's
    configuration when a *new* model number is being saved, else None.

    Runs the product's own match view (the same one behind its Find Model
    button) on the same request, so a manually entered model number is
    refused exactly when Find Model would have returned an existing one.
    """
    model_number = str(model_number or "").strip()
    if not model_number:
        return None
    if CatalogueProduct.objects.filter(model_no__iexact=model_number).exists():
        return None
    try:
        data = json.loads(match_view(request, bid_id).content or b"{}")
    except Exception:
        return None
    existing = str(((data or {}).get("match") or {}).get("model_no") or "").strip()
    if existing and existing.upper() != model_number.upper():
        return existing
    return None


def duplicate_model_response(existing_model):
    return JsonResponse({
        "error": (
            f"This configuration already exists as model {existing_model}. "
            "Use Find Model to select it instead of creating a duplicate."
        ),
        "existing_model": existing_model,
    }, status=400)


def guard_new_model(match_view, request, bid_id, model_number, current_model):
    """For submit/review paths that also accept a model number: refuse only
    when it is being changed to a new number that duplicates an existing
    configuration. Returns an error response, or None to carry on."""
    model_number = str(model_number or "").strip()
    if not model_number or model_number.upper() == str(current_model or "").strip().upper():
        return None
    existing = existing_model_for_config(match_view, request, bid_id, model_number)
    return duplicate_model_response(existing) if existing else None
