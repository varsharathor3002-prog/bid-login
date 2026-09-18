from datetime import timedelta
from zoneinfo import ZoneInfo

from django.db import transaction
from django.utils import timezone

from ..models import GemBidAssignment, GemBidOpportunity
from .GemOpportunityRules import classify_opportunity_item


INDIA_TIMEZONE = ZoneInfo("Asia/Kolkata")


def valid_opportunity_dates(bid_date, end_date, now=None):
    """Return whether an opportunity belongs in the active frontend window."""
    if not bid_date or not end_date:
        return False
    reference = now or timezone.now()
    local_now = timezone.localtime(reference, INDIA_TIMEZONE)
    local_bid_date = timezone.localtime(bid_date, INDIA_TIMEZONE).date()
    first_date = local_now.date() - timedelta(days=3)
    return (
        first_date <= local_bid_date <= local_now.date()
        and reference < end_date <= reference + timedelta(days=120)
    )


def delete_expired_bid_opportunities(now=None):
    """Permanently remove opportunities whose GeM End Date has passed."""
    cutoff = now or timezone.now()
    deleted_opportunities = 0
    deleted_assignments = 0

    with transaction.atomic():
        expired_ids = list(
            GemBidOpportunity.objects.select_for_update()
            .filter(end_date__lte=cutoff)
            .values_list("id", flat=True)
        )
        # Keep each IN query below SQLite's parameter limit while retaining a
        # single transaction on production databases.
        for offset in range(0, len(expired_ids), 500):
            chunk = expired_ids[offset:offset + 500]
            assignments = GemBidAssignment.objects.filter(opportunity_id__in=chunk)
            deleted_assignments += assignments.count()
            assignments.delete()
            opportunities = GemBidOpportunity.objects.filter(id__in=chunk)
            deleted_opportunities += opportunities.count()
            opportunities.delete()

    return {
        "opportunities": deleted_opportunities,
        "assignments": deleted_assignments,
    }


def delete_invalid_unassigned_opportunities(now=None):
    """Delete active, unassigned rows which the opportunity frontend cannot show."""
    reference = now or timezone.now()
    candidates = list(
        GemBidOpportunity.objects.filter(
            is_deleted=False,
            assignment__isnull=True,
        ).only("id", "bid_date", "end_date", "product_name", "product_type")
    )
    invalid_ids = []
    for row in candidates:
        classification = classify_opportunity_item(row.product_name)
        if not valid_opportunity_dates(row.bid_date, row.end_date, reference) or not classification:
            invalid_ids.append(row.id)
            continue
        if (
            row.product_type != classification["product_type"]
            or row.product_name != classification["clean_name"]
        ):
            GemBidOpportunity.objects.filter(id=row.id).update(
                product_type=classification["product_type"],
                product_name=classification["clean_name"],
            )
    deleted = 0
    with transaction.atomic():
        for offset in range(0, len(invalid_ids), 500):
            rows = GemBidOpportunity.objects.filter(
                id__in=invalid_ids[offset:offset + 500],
                assignment__isnull=True,
                is_deleted=False,
            )
            deleted += rows.count()
            rows.delete()
    return deleted
