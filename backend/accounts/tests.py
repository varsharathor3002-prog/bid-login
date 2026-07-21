import json

from django.test import TestCase

from .models import DesktopBid, User


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
