import json
from datetime import timedelta

from django.core import signing
from django.test import TestCase
from django.utils import timezone

from .models import GemBidResult, User


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
        old = timezone.now().replace(month=1, day=1, hour=0, minute=0, second=0)
        future = timezone.now() + timedelta(days=1)
        response = self.post_rows([
            self.row("GEM/2026/B/RECENT", recent),
            self.row("GEM/2026/B/OLD", old),
            self.row("GEM/2026/B/UNDATED", None),
            self.row("GEM/2026/B/FUTURE", future),
        ])

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["saved"], 2)
        self.assertEqual(payload["created"], 2)
        self.assertEqual(payload["updated"], 0)
        self.assertEqual(payload["rejected"], 2)
        self.assertTrue(payload["frontend_visible"])
        self.assertEqual(
            {item["reason"] for item in payload["rejections"]},
            {
                "missing_disqualified_date",
                "future_disqualified_date",
            },
        )
        self.assertTrue(GemBidResult.objects.filter(bid_no="GEM/2026/B/RECENT").exists())
        self.assertTrue(GemBidResult.objects.filter(bid_no="GEM/2026/B/OLD").exists())
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

    def test_old_existing_result_is_preserved_and_refreshed(self):
        old = timezone.now().replace(month=1, day=1, hour=0, minute=0, second=0)
        GemBidResult.objects.create(
            bid_no="GEM/2026/B/STALE",
            is_disqualified=True,
            technical_status="Disqualified",
            disqualified_at=old,
        )

        response = self.post_rows([self.row("GEM/2026/B/STALE", old)])

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["saved"], 1)
        self.assertEqual(response.json()["rejected"], 0)
        self.assertTrue(GemBidResult.objects.filter(bid_no="GEM/2026/B/STALE").exists())

    def test_get_does_not_delete_legacy_rows(self):
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
        self.assertTrue(
            GemBidResult.objects.filter(bid_no="GEM/2026/B/NOT-DISQUALIFIED").exists()
        )

    def test_old_result_visible_until_manual_delete(self):
        row = GemBidResult.objects.create(bid_no="GEM/2024/B/KEEP", is_disqualified=True, disqualified_at=timezone.now().replace(month=1, day=1, hour=0, minute=0, second=0))
        response = self.client.get("/api/gem/bid-results/?status=disqualified", **self.auth)
        self.assertIn(row.bid_no, [item["bid_no"] for item in response.json()["results"]])
        self.assertTrue(GemBidResult.objects.filter(pk=row.pk).exists())
        response = self.client.delete("/api/gem/bid-results/", data=json.dumps({"ids": [row.pk]}), content_type="application/json", **self.auth)
        self.assertEqual(response.status_code, 200)
        self.assertFalse(GemBidResult.objects.filter(pk=row.pk).exists())

    def test_invalid_sync_does_not_delete_existing_record(self):
        row = GemBidResult.objects.create(bid_no="GEM/2026/B/KEEP-UNDATED", is_disqualified=True)
        response = self.post_rows([self.row(row.bid_no, None)])
        self.assertEqual(response.json()["rejected"], 1)
        self.assertTrue(GemBidResult.objects.filter(pk=row.pk).exists())

    def test_previous_year_is_hidden_and_rejected_without_deletion(self):
        previous = timezone.now().replace(year=timezone.localdate().year-1, month=1, day=1)
        row = GemBidResult.objects.create(bid_no="GEM/PREVIOUS/KEEP", is_disqualified=True, disqualified_at=previous)
        response = self.client.get("/api/gem/bid-results/?status=disqualified", **self.auth)
        self.assertNotIn(row.bid_no, [item["bid_no"] for item in response.json()["results"]])
        self.assertEqual(response.json()["summary"]["total"], 0)
        response = self.post_rows([self.row(row.bid_no, previous), self.row("GEM/PREVIOUS/NEW", previous)])
        self.assertEqual(response.json()["saved"], 0)
        self.assertEqual(response.json()["rejected"], 2)
        self.assertTrue(GemBidResult.objects.filter(pk=row.pk).exists())
        self.assertFalse(GemBidResult.objects.filter(bid_no="GEM/PREVIOUS/NEW").exists())
