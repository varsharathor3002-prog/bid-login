import base64
import json
import os
from datetime import datetime

from django.core import signing
from django.test import TestCase
from django.utils import timezone

from .models import DesktopBid, GemBidResult, GemUploadJob, User
from .views.Desktop import _extract_motherboard_features_from_text


class CreateDesktopBidTests(TestCase):
    def setUp(self):
        self.user = User.objects.create(
            username="bid-user",
            email="bid-user@example.com",
            password="test-password",
            role="user",
        )
        self.url = "/api/desktop-bids/create/"
        self.step_one_data = {
            "user_id": str(self.user.id),
            "bid_no": "BID-001",
            "dept_name": "IT",
            "organization": "Example Org",
            "qty": "5",
            "address": "Example address",
            "pincode": "110001",
            "atc": "Standard ATC",
        }

    def create_bid(self, status):
        return DesktopBid.objects.create(
            user=self.user,
            bid_no=f"OLD-{status}",
            dept_name="Old department",
            qty=1,
            address="Old address",
            pincode="000000",
            status=status,
            processor="",
            ram="",
            os="",
            monitor="",
            cabinet="",
            warranty="",
            motherboard="",
            date="2000-01-01",
        )

    def test_first_step_creates_a_draft_when_none_exists(self):
        response = self.client.post(self.url, self.step_one_data)

        self.assertEqual(response.status_code, 201)
        payload = json.loads(response.content)
        self.assertFalse(payload["reused"])
        self.assertEqual(DesktopBid.objects.filter(user=self.user, status="draft").count(), 1)

    def test_first_step_reuses_latest_incomplete_bid_and_removes_duplicates(self):
        self.create_bid("draft")
        latest = self.create_bid("configured")
        completed = self.create_bid("complete")

        response = self.client.post(self.url, self.step_one_data)

        self.assertEqual(response.status_code, 200)
        payload = json.loads(response.content)
        self.assertTrue(payload["reused"])
        self.assertEqual(payload["bid_id"], latest.id)
        self.assertEqual(
            DesktopBid.objects.filter(
                user=self.user,
                status__in=("draft", "configured"),
            ).count(),
            1,
        )
        latest.refresh_from_db()
        self.assertEqual(latest.bid_no, self.step_one_data["bid_no"])
        self.assertEqual(latest.qty, 5)
        self.assertTrue(DesktopBid.objects.filter(id=completed.id, status="complete").exists())


class GemAutomationApiTests(TestCase):
    @classmethod
    def setUpClass(cls):
        cls._previous_key = os.environ.get("GEM_ENCRYPTION_KEY")
        os.environ["GEM_ENCRYPTION_KEY"] = "test-only-gem-encryption-key"
        super().setUpClass()

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        if cls._previous_key is None:
            os.environ.pop("GEM_ENCRYPTION_KEY", None)
        else:
            os.environ["GEM_ENCRYPTION_KEY"] = cls._previous_key

    def setUp(self):
        self.admin = User.objects.create(
            username="admin-user", email="admin@example.com",
            password="password", role="admin",
        )
        self.analyser = User.objects.create(
            username="analyser-user", email="analyser@example.com",
            password="password", role="analyser",
        )
        self.bid_user = User.objects.create(
            username="bid-owner", email="owner@example.com",
            password="password", role="user",
        )
        self.bid = DesktopBid.objects.create(
            user=self.bid_user, bid_no="GEM-001", dept_name="IT", qty=2,
            address="Delhi", pincode="110001", status="complete",
            review_status="approved", processor="Intel", ram="8 GB",
            os="Windows", monitor="Yes", cabinet="SFF", warranty="3",
            motherboard="Q670", date="2026-07-25", model_number="ACL-1060DS-25DE-TEST",
        )

    def test_motherboard_option_counts_are_extracted(self):
        cases = [
            (
                "AMD B650, DDR5, 4 USB 2.0, 2 USB 3.0, PCI16*2, PCI4*2",
                {"pcie_x1": 0, "pcie_x4": 2, "pcie_x16": 2, "m2_ssd": 0, "m2_wifi": 0, "tpm": 1},
            ),
            (
                "AMD A520, 4 USB 2.0, 2 USB 3.0, PCI16*1, PCI4*1",
                {"pcie_x1": 0, "pcie_x4": 1, "pcie_x16": 1, "m2_ssd": 0, "m2_wifi": 0, "tpm": 1},
            ),
            (
                "H810 With DDR5 DP, HDMI, USB 3.1 -2, USB 2.0 -6 PCI16-1 PCI-1, M.2 -1",
                {"pcie_x1": 1, "pcie_x4": 0, "pcie_x16": 1, "m2_ssd": 1, "m2_wifi": 0, "tpm": 1},
            ),
            (
                "H610, PCI X 16- 1 PCI 4 X1, M.2 1, 4 USB 2.0, 2USB 3.0, VGA, HDMI",
                {"pcie_x1": 0, "pcie_x4": 1, "pcie_x16": 1, "m2_ssd": 1, "m2_wifi": 0, "tpm": 1},
            ),
            (
                "Q670 DDR4 2 DIMM, PCI X 16- 1 PCI 4 X2, M.2 2, 4 USB 2.0, 4 USB 3.0 TYPE C 1, VGA, HDMI",
                {"pcie_x1": 0, "pcie_x4": 2, "pcie_x16": 1, "m2_ssd": 2, "m2_wifi": 0, "tpm": 1},
            ),
        ]
        for motherboard, expected in cases:
            features = _extract_motherboard_features_from_text(motherboard)
            for key, value in expected.items():
                self.assertEqual(features[key], value, motherboard)

    def test_analyser_can_queue_approved_desktop_job(self):
        token = signing.dumps(
            {"user_id": self.analyser.id, "role": self.analyser.role},
            salt="gem-api-auth",
        )
        response = self.client.post(
            f"/api/desktop-bids/{self.bid.id}/gem-jobs/",
            data=json.dumps({}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        self.assertEqual(response.status_code, 201)
        job = GemUploadJob.objects.get()
        self.assertEqual(job.triggered_by, self.analyser)
        self.assertEqual(job.status, "queued")
        extension_payload = signing.loads(
            response.json()["extension_token"],
            salt="gem-api-auth",
        )
        self.assertEqual(extension_payload["user_id"], self.analyser.id)
        self.assertEqual(extension_payload["role"], "analyser")
        self.assertNotIn("password", json.dumps(job.payload_snapshot).lower())
        self.assertEqual(
            job.payload_snapshot["specifications"]["Computer Type"],
            "Entry Level",
        )

    def test_admin_can_queue_approved_desktop_job(self):
        token = signing.dumps(
            {"user_id": self.admin.id, "role": self.admin.role},
            salt="gem-api-auth",
        )
        response = self.client.post(
            f"/api/desktop-bids/{self.bid.id}/gem-jobs/",
            data=json.dumps({}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        self.assertEqual(response.status_code, 201)

    def test_extension_can_claim_and_report_assigned_job_without_credentials(self):
        job = GemUploadJob.objects.create(
            bid=self.bid,
            triggered_by=self.analyser,
            payload_snapshot={
                "model_number": self.bid.model_number,
                "specifications": {"Computer Type": "Desktop"},
            },
        )
        token = signing.dumps(
            {"user_id": self.analyser.id, "role": self.analyser.role},
            salt="gem-api-auth",
        )
        auth = {"HTTP_AUTHORIZATION": f"Bearer {token}"}
        response = self.client.post(
            f"/api/gem/extension/jobs/{job.id}/claim/",
            data="{}",
            content_type="application/json",
            **auth,
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ready_for_fill")
        self.assertNotIn("password", json.dumps(response.json()).lower())
        self.assertEqual(
            response.json()["payload"]["specifications"]["Computer Type"],
            "Entry Level",
        )
        response = self.client.get(
            f"/api/gem/extension/jobs/{job.id}/mrp-document/",
            **auth,
        )
        self.assertEqual(response.status_code, 200)
        document = response.json()
        self.assertIn(self.bid.model_number, document["filename"])
        self.assertTrue(base64.b64decode(document["base64"]).startswith(b"%PDF"))
        response = self.client.post(
            f"/api/gem/extension/jobs/{job.id}/report/",
            data=json.dumps({"status": "filled", "progress": "Form filled"}),
            content_type="application/json",
            **auth,
        )
        self.assertEqual(response.status_code, 200)
        job.refresh_from_db()
        self.assertEqual(job.status, "filled")

    def test_extension_can_claim_another_analysers_job(self):
        other = User.objects.create(
            username="other-analyser", email="other@example.com",
            password="password", role="analyser",
        )
        job = GemUploadJob.objects.create(
            bid=self.bid, triggered_by=other,
        )
        token = signing.dumps(
            {"user_id": self.analyser.id, "role": self.analyser.role},
            salt="gem-api-auth",
        )
        response = self.client.post(
            f"/api/gem/extension/jobs/{job.id}/claim/",
            data="{}",
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ready_for_fill")

    def test_confirmed_disqualification_cannot_be_overwritten_by_later_scan(self):
        disqualified_at = timezone.make_aware(datetime(2026, 8, 6, 14, 0, 51))
        result = GemBidResult.objects.create(
            bid_no="GEM/2026/B/7831142",
            is_disqualified=True,
            is_final=True,
            technical_status="Disqualified",
            disqualified_at=disqualified_at,
        )
        token = signing.dumps(
            {"user_id": self.analyser.id, "role": self.analyser.role},
            salt="gem-api-auth",
        )
        response = self.client.post(
            "/api/gem/bid-results/",
            data=json.dumps({"results": [{
                "bid_no": result.bid_no,
                "evaluation_read": True,
                "is_disqualified": False,
                "technical_status": "Qualified",
                "history": [],
            }]}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        self.assertEqual(response.status_code, 200)
        result.refresh_from_db()
        self.assertTrue(result.is_disqualified)
        self.assertEqual(result.technical_status, "Disqualified")
        self.assertEqual(result.disqualified_at, disqualified_at)

    def test_disqualified_record_can_be_permanently_deleted(self):
        result = GemBidResult.objects.create(
            bid_no="GEM/2026/B/PERMANENT",
            is_disqualified=True,
            technical_status="Disqualified",
        )
        token = signing.dumps(
            {"user_id": self.analyser.id, "role": self.analyser.role},
            salt="gem-api-auth",
        )
        response = self.client.delete(
            f"/api/gem/bid-results/{result.id}/",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(GemBidResult.objects.filter(pk=result.pk).exists())

    def test_multiple_disqualified_records_can_be_deleted_together(self):
        rows = [
            GemBidResult.objects.create(
                bid_no=f"GEM/2026/B/BULK-{index}",
                is_disqualified=True,
                technical_status="Disqualified",
            )
            for index in range(2)
        ]
        token = signing.dumps(
            {"user_id": self.analyser.id, "role": self.analyser.role},
            salt="gem-api-auth",
        )
        response = self.client.delete(
            "/api/gem/bid-results/",
            data=json.dumps({"ids": [row.id for row in rows]}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["deleted"], 2)
        self.assertFalse(GemBidResult.objects.filter(id__in=[row.id for row in rows]).exists())
