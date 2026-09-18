import json
from datetime import datetime, timedelta, timezone as datetime_timezone
from unittest.mock import patch

from django.test import RequestFactory, TestCase
from django.utils import timezone

from .models import (
    GemBidAssignment,
    GemBidAssignmentHistory,
    GemBidOpportunity,
    User,
)
from .views.GemAssignments import gem_bid_assignments
from .views.GemOpportunities import gem_bid_opportunities
from .views.GemOpportunityCleanup import (
    delete_expired_bid_opportunities,
    delete_invalid_unassigned_opportunities,
    valid_opportunity_dates,
)


class GemOpportunityExpiryCleanupTests(TestCase):
    def setUp(self):
        self.now = timezone.now()
        self.analyser = User.objects.create(
            username="expiry-analyser",
            email="expiry-analyser@example.com",
            password="password",
            role="analyser",
        )
        self.admin = User.objects.create(
            username="opportunity-admin",
            email="opportunity-admin@example.com",
            password="password",
            role="admin",
        )
        self.management = User.objects.create(
            username="opportunity-management",
            email="opportunity-management@example.com",
            password="password",
            role="management",
        )
        self.bid_user = User.objects.create(
            username="expiry-user",
            email="expiry-user@example.com",
            password="password",
            role="user",
        )
        self.factory = RequestFactory()

    def opportunity(self, bid_no, end_date):
        return GemBidOpportunity.objects.create(
            bid_no=bid_no,
            bid_date=self.now - timedelta(days=1),
            end_date=end_date,
            product_name="High End Desktop Computer",
            product_type="desktop",
        )

    def test_cleanup_deletes_expired_opportunities_and_linked_assignment_history(self):
        expired = self.opportunity("GEM/2026/B/9000001", self.now - timedelta(seconds=1))
        active = self.opportunity("GEM/2026/B/9000002", self.now + timedelta(days=1))
        assignment = GemBidAssignment.objects.create(
            opportunity=expired,
            assigned_to=self.bid_user,
            assigned_by=self.analyser,
        )
        GemBidAssignmentHistory.objects.create(
            assignment=assignment,
            action="assigned",
            to_user=self.bid_user,
            new_status="assigned",
            changed_by=self.analyser,
        )

        result = delete_expired_bid_opportunities(self.now)

        self.assertEqual(result, {"opportunities": 1, "assignments": 1})
        self.assertFalse(GemBidOpportunity.objects.filter(id=expired.id).exists())
        self.assertFalse(GemBidAssignment.objects.filter(id=assignment.id).exists())
        self.assertEqual(GemBidAssignmentHistory.objects.count(), 0)
        self.assertTrue(GemBidOpportunity.objects.filter(id=active.id).exists())

    @patch("accounts.views.GemOpportunities._request_user")
    def test_opportunity_refresh_physically_deletes_expired_rows(self, request_user):
        request_user.return_value = self.admin
        expired = self.opportunity("GEM/2026/B/9000003", self.now - timedelta(minutes=1))
        active = self.opportunity("GEM/2026/B/9000004", self.now + timedelta(days=1))

        response = gem_bid_opportunities(self.factory.get("/api/gem/bid-opportunities/"))
        payload = json.loads(response.content)

        self.assertEqual(response.status_code, 200)
        self.assertFalse(GemBidOpportunity.objects.filter(id=expired.id).exists())
        self.assertEqual([row["id"] for row in payload["results"]], [active.id])

    @patch("accounts.views.GemAssignments._require_role")
    def test_assignment_refresh_deletes_an_expired_assigned_bid(self, require_role):
        require_role.return_value = (self.bid_user, None)
        expired = self.opportunity("GEM/2026/B/9000005", self.now - timedelta(minutes=1))
        assignment = GemBidAssignment.objects.create(
            opportunity=expired,
            assigned_to=self.bid_user,
            assigned_by=self.analyser,
        )

        response = gem_bid_assignments(self.factory.get("/api/gem/bid-assignments/"))
        payload = json.loads(response.content)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["results"], [])
        self.assertFalse(GemBidOpportunity.objects.filter(id=expired.id).exists())
        self.assertFalse(GemBidAssignment.objects.filter(id=assignment.id).exists())

    @patch("accounts.views.GemAssignments._require_role")
    def test_admin_can_assign_an_opportunity(self, require_role):
        require_role.return_value = (self.admin, None)
        opportunity = self.opportunity("GEM/2026/B/9000012", self.now + timedelta(days=1))
        request = self.factory.post(
            "/api/gem/bid-assignments/",
            data=json.dumps({
                "action": "assign",
                "assigned_to": self.bid_user.id,
                "opportunity_ids": [opportunity.id],
            }),
            content_type="application/json",
        )

        response = gem_bid_assignments(request)
        payload = json.loads(response.content)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["assigned"], 1)
        assignment = GemBidAssignment.objects.get(opportunity=opportunity)
        self.assertEqual(assignment.assigned_by, self.admin)
        self.assertEqual(assignment.assigned_to, self.bid_user)

    @patch("accounts.views.GemAssignments._require_role")
    def test_analyser_cannot_assign_an_opportunity(self, require_role):
        require_role.return_value = (self.analyser, None)
        opportunity = self.opportunity("GEM/2026/B/9000013", self.now + timedelta(days=1))
        request = self.factory.post(
            "/api/gem/bid-assignments/",
            data=json.dumps({
                "action": "assign",
                "assigned_to": self.bid_user.id,
                "opportunity_ids": [opportunity.id],
            }),
            content_type="application/json",
        )

        response = gem_bid_assignments(request)
        payload = json.loads(response.content)

        self.assertEqual(response.status_code, 403)
        self.assertEqual(payload["error"], "Only an admin or management can assign bids.")
        self.assertFalse(GemBidAssignment.objects.filter(opportunity=opportunity).exists())

    @patch("accounts.views.GemOpportunities._request_user")
    def test_extension_can_save_opportunities_with_every_authenticated_role(self, request_user):
        actors = [self.admin, self.management, self.analyser, self.bid_user]
        for index, actor in enumerate(actors, start=20):
            with self.subTest(role=actor.role):
                request_user.return_value = actor
                request = self.factory.post(
                    "/api/gem/bid-opportunities/",
                    data=json.dumps({"results": [{
                        "bid_no": f"GEM/2026/B/90000{index}",
                        "bid_date": (self.now - timedelta(days=1)).isoformat(),
                        "end_date": (self.now + timedelta(days=10)).isoformat(),
                        "product_name": "High End Desktop Computer",
                        "product_type": "desktop",
                        "offer_validity_days": 120,
                    }]}),
                    content_type="application/json",
                )

                response = gem_bid_opportunities(request)
                payload = json.loads(response.content)

                self.assertEqual(response.status_code, 200)
                self.assertEqual(payload["saved"], 1)

    def test_indian_cutoff_day_is_frontend_valid(self):
        now = datetime(2026, 9, 15, 7, 30, tzinfo=datetime_timezone.utc)
        cutoff_in_india = datetime(2026, 9, 11, 18, 30, tzinfo=datetime_timezone.utc)

        self.assertTrue(valid_opportunity_dates(cutoff_in_india, now + timedelta(days=10), now))
        self.assertFalse(valid_opportunity_dates(cutoff_in_india - timedelta(seconds=1), now + timedelta(days=10), now))
        self.assertFalse(valid_opportunity_dates(cutoff_in_india, now + timedelta(days=121), now))

    def test_invalid_unassigned_rows_are_physically_deleted(self):
        stale = self.opportunity(
            "GEM/2026/B/9000006",
            self.now + timedelta(days=1),
        )
        stale.bid_date = self.now - timedelta(days=4)
        stale.save(update_fields=["bid_date"])
        assigned = self.opportunity(
            "GEM/2026/B/9000007",
            self.now + timedelta(days=1),
        )
        assigned.bid_date = self.now - timedelta(days=4)
        assigned.save(update_fields=["bid_date"])
        GemBidAssignment.objects.create(
            opportunity=assigned,
            assigned_to=self.bid_user,
            assigned_by=self.analyser,
        )

        deleted = delete_invalid_unassigned_opportunities(self.now)

        self.assertEqual(deleted, 1)
        self.assertFalse(GemBidOpportunity.objects.filter(id=stale.id).exists())
        self.assertTrue(GemBidOpportunity.objects.filter(id=assigned.id).exists())

    @patch("accounts.views.GemOpportunities._request_user")
    @patch("accounts.views.GemOpportunities.timezone.now")
    def test_save_counts_only_frontend_valid_opportunities(self, now_mock, request_user):
        now = datetime(2026, 9, 15, 7, 30, tzinfo=datetime_timezone.utc)
        now_mock.return_value = now
        request_user.return_value = self.admin
        valid = {
            "bid_no": "GEM/2026/B/9000008",
            "bid_date": datetime(2026, 9, 11, 18, 30, tzinfo=datetime_timezone.utc).isoformat(),
            "end_date": (now + timedelta(days=10)).isoformat(),
            "product_name": "High End Desktop Computer",
            "product_type": "desktop",
            "offer_validity_days": 120,
        }
        old = dict(valid, bid_no="GEM/2026/B/9000009", bid_date=(now - timedelta(days=4)).isoformat())
        too_long = dict(valid, bid_no="GEM/2026/B/9000010", end_date=(now + timedelta(days=121)).isoformat())
        bad_product = dict(valid, bid_no="GEM/2026/B/9000011", product_type="unsupported")
        request = self.factory.post(
            "/api/gem/bid-opportunities/",
            data=json.dumps({"results": [valid, old, too_long, bad_product]}),
            content_type="application/json",
        )

        response = gem_bid_opportunities(request)
        payload = json.loads(response.content)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["saved"], 1)
        self.assertEqual(payload["created"], 1)
        self.assertEqual(payload["updated"], 0)
        self.assertEqual(payload["rejected"], 3)
        self.assertTrue(payload["frontend_visible"])
        self.assertEqual(GemBidOpportunity.objects.count(), 1)
