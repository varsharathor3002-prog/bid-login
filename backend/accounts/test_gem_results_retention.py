import json
from datetime import timedelta

from django.core import signing
from django.test import TestCase
from django.utils import timezone

from .models import GemBidResult, User
from .views.GemResults import _retention_cutoff


class GemBidResultRetentionTests(TestCase):
    def setUp(self):
        self.analyser = User.objects.create(
            username="result-retention-analyser",
            email="result-retention@example.com",
            password="password",
            role="analyser",
        )
        token = signing.dumps(
            {"user_id": self.analyser.id, "role": self.analyser.role},
            salt="gem-api-auth",
        )
        self.auth = {"HTTP_AUTHORIZATION": f"Bearer {token}"}

    @staticmethod
    def row(bid_no, disqualified_at):
        return {
            "bid_no": bid_no,
            "evaluation_read": True,
            "is_disqualified": True,
            "technical_status": "Disqualified",
            "disqualified_at": disqualified_at.isoformat() if disqualified_at else "",
            "history": [],
        }

    def post_rows(self, rows):
        return self.client.post(
            "/api/gem/bid-results/",
            data=json.dumps({"results": rows}),
            content_type="application/json",
            **self.auth,
        )

    def test_only_dashboard_valid_rows_are_saved_and_counted(self):
        recent = timezone.now() - timedelta(days=1)
        old = _retention_cutoff() - timedelta(seconds=1)
        future = timezone.now() + timedelta(days=1)
        response = self.post_rows([
            self.row("GEM/2026/B/RECENT", recent),
            self.row("GEM/2026/B/OLD", old),
            self.row("GEM/2026/B/UNDATED", None),
            self.row("GEM/2026/B/FUTURE", future),
        ])

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["saved"], 1)
        self.assertEqual(payload["created"], 1)
        self.assertEqual(payload["updated"], 0)
        self.assertEqual(payload["rejected"], 3)
        self.assertTrue(payload["frontend_visible"])
        self.assertEqual(
            {item["reason"] for item in payload["rejections"]},
            {
                "outside_retention_window",
                "missing_disqualified_date",
                "future_disqualified_date",
            },
        )
        self.assertTrue(GemBidResult.objects.filter(bid_no="GEM/2026/B/RECENT").exists())
        self.assertFalse(GemBidResult.objects.filter(bid_no="GEM/2026/B/OLD").exists())
        self.assertFalse(GemBidResult.objects.filter(bid_no="GEM/2026/B/UNDATED").exists())
        self.assertFalse(GemBidResult.objects.filter(bid_no="GEM/2026/B/FUTURE").exists())

    def test_existing_valid_result_is_reported_as_refreshed(self):
        recent = timezone.now() - timedelta(days=1)
        GemBidResult.objects.create(
            bid_no="GEM/2026/B/REFRESH",
            is_disqualified=True,
            technical_status="Disqualified",
            disqualified_at=recent,
        )

        response = self.post_rows([self.row("GEM/2026/B/REFRESH", recent)])

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["saved"], 1)
        self.assertEqual(response.json()["created"], 0)
        self.assertEqual(response.json()["updated"], 1)
        self.assertEqual(GemBidResult.objects.filter(bid_no="GEM/2026/B/REFRESH").count(), 1)

    def test_old_existing_result_is_deleted_and_not_recreated(self):
        old = _retention_cutoff() - timedelta(seconds=1)
        GemBidResult.objects.create(
            bid_no="GEM/2026/B/STALE",
            is_disqualified=True,
            technical_status="Disqualified",
            disqualified_at=old,
        )

        response = self.post_rows([self.row("GEM/2026/B/STALE", old)])

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["saved"], 0)
        self.assertEqual(response.json()["rejected"], 1)
        self.assertFalse(GemBidResult.objects.filter(bid_no="GEM/2026/B/STALE").exists())

    def test_non_disqualified_legacy_rows_are_removed(self):
        GemBidResult.objects.create(
            bid_no="GEM/2026/B/NOT-DISQUALIFIED",
            is_disqualified=False,
            technical_status="Qualified",
        )

        response = self.client.get(
            "/api/gem/bid-results/?status=disqualified",
            **self.auth,
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(
            GemBidResult.objects.filter(bid_no="GEM/2026/B/NOT-DISQUALIFIED").exists()
        )
