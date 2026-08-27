from django.db import transaction
from django.db.models import Q

from ..models import GemBidOpportunity, GemBidResult


def delete_bid_with_related_data(bid, product_type):
    """Delete a product bid and all database rows owned by that bid.

    Catalogue products, component rates, users, and other shared reference
    data are intentionally excluded.
    """
    bid_id = bid.pk
    bid_no = str(getattr(bid, "bid_no", "") or "").strip()

    with transaction.atomic():
        result_filter = Q(product_type=product_type, bid_no=bid_no)
        if product_type == "desktop":
            result_filter |= Q(linked_bid_id=bid_id)

        result_count = 0
        opportunity_count = 0
        if bid_no:
            result_count, _ = GemBidResult.objects.filter(result_filter).delete()
            # Assignment and assignment-history rows cascade from opportunity.
            opportunity_count, _ = GemBidOpportunity.objects.filter(bid_no=bid_no).delete()

        # GemUploadJob and GemAuditLog rows cascade through their model FKs.
        bid_delete_count, _ = bid.delete()

    return {
        "bid_id": bid_id,
        "bid_rows": bid_delete_count,
        "result_rows": result_count,
        "opportunity_rows": opportunity_count,
    }
