from datetime import timedelta
from zoneinfo import ZoneInfo

from django.db import transaction
from django.utils import timezone

from ..models import GemBidAssignment, GemBidOpportunity
from .GemOpportunityRules import classify_opportunity_item


INDIA_TIMEZONE = ZoneInfo("Asia/Kolkata")

# Printer bids are received at any quantity and however far off they end;
# Workstation bids at any quantity. Every other rule still applies to them.
NO_MINIMUM_QUANTITY_PRODUCTS = {"printer", "workstation"}
NO_DAY_LIMIT_PRODUCTS = {"printer"}
MINIMUM_QUANTITY = 5
MAX_DAYS = 120


def valid_opportunity_dates(bid_date, end_date, now=None, product_type=""):
    """Return whether an opportunity belongs in the active frontend window."""
    if not bid_date or not end_date:
        return False
    reference = now or timezone.now()
    local_now = timezone.localtime(reference, INDIA_TIMEZONE)
    local_bid_date = timezone.localtime(bid_date, INDIA_TIMEZONE).date()
    # Every ongoing bid is kept regardless of how long ago it started; the
    # scanner reads all Latest First pages and stops once it reaches bids it
    # has already read.
    if product_type in NO_DAY_LIMIT_PRODUCTS:
        return local_bid_date <= local_now.date() and reference < end_date
    return (
        local_bid_date <= local_now.date()
        and reference < end_date <= reference + timedelta(days=MAX_DAYS)
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
        if not classification or not valid_opportunity_dates(
            row.bid_date, row.end_date, reference, classification["product_type"]
        ):
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
