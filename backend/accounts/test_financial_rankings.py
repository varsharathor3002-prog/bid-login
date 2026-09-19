import json
from datetime import date
from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase, RequestFactory
from django.utils import timezone

from .views.GemFinancialRanking import financial_rankings, delete_financial_ranking, result_data, company_key


class FinancialRankingTests(SimpleTestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.sellers = [
            {"sellerName": "SAMA SMART SOLUTIONS(MII)", "offeredItem": "Desktop", "totalPrice": "847203.00", "rank": 1, "status": "qualified"},
            {"sellerName": "LAPS N TABS TECHNOLOGY PRIVATE LIMITED (MSE)", "offeredItem": "Desktop", "totalPrice": "847203.00", "rank": 2, "status": "not_evaluated"},
        ]

    def row(self):
        return SimpleNamespace(
            id=1, ra_no="GEM/2026/R/123", source_type="bid_ra_awarded",
            technical_status="qualified", bid_no="GEM/2026/B/123", lot_key="",
            item_name="Desktop", start_date=date(2026, 9, 14), end_date=date(2026, 9, 24),
            sellers=self.sellers, last_synced_at=timezone.now(),
        )

    def test_published_rank_and_unknown_company(self):
        row = self.row()
        self.assertEqual(result_data(row)["company_rank"], 2)
        row.sellers = row.sellers[:1]
        self.assertIsNone(result_data(row)["company_rank"])

    def test_company_key_strips_under_pma_suffix_after_badge(self):
        # GeM now appends "Under PMA" after the MSE/MII badge, so the badge is
        # no longer the last thing in the name (seen live on GEM/2026/B/7430505).
        self.assertEqual(company_key("LAPS N TABS TECHNOLOGY PRIVATE LIMITED (MSE) Under PMA"), "LAPS N TABS TECHNOLOGY PRIVATE LIMITED")
        self.assertEqual(company_key("LAPS N TABS TECHNOLOGY PRIVATE LIMITED (MSE,MII) Under PMA"), "LAPS N TABS TECHNOLOGY PRIVATE LIMITED")
        self.assertEqual(company_key("LAPS N TABS TECHNOLOGY PRIVATE LIMITED Under PMA"), "LAPS N TABS TECHNOLOGY PRIVATE LIMITED")

    def test_company_key_matches_arbitrary_trailing_decorations(self):
        # Live example (GEM/2026/B/7834880): two bracket groups plus "Under PMA".
        self.assertEqual(
            company_key("LAPS N TABS TECHNOLOGY PRIVATE LIMITED(MSE)( MSE Social Category: General ) Under PMA"),
            "LAPS N TABS TECHNOLOGY PRIVATE LIMITED",
        )
        # A genuinely different, longer company name must not match.
        self.assertNotEqual(company_key("LAPS N TABS TECHNOLOGY PRIVATE LIMITED AND CO"), "LAPS N TABS TECHNOLOGY PRIVATE LIMITED")

    def test_published_rank_found_beyond_top_three_with_pma_suffix(self):
        row = self.row()
        row.sellers = [
            {"sellerName": "DATACENTRIC NETWORK SOLUTIONS LLP(MII) Under PMA", "offeredItem": "Desktop", "totalPrice": "5973000.00", "rank": 1},
            {"sellerName": "GRAY TECHNOLOGIES PRIVATE LIMITED (MSE,MII) Under PMA", "offeredItem": "Desktop", "totalPrice": "5980400.00", "rank": 2},
            {"sellerName": "YURATECH GLOBAL PRIVATE LIMITED (MSE,MII) Under PMA", "offeredItem": "Desktop", "totalPrice": "6426200.00", "rank": 3},
            {"sellerName": "LAPS N TABS TECHNOLOGY PRIVATE LIMITED (MSE) Under PMA", "offeredItem": "Desktop", "totalPrice": "6500000.00", "rank": 5},
        ]
        self.assertEqual(result_data(row)["company_rank"], 5)

    def test_authentication_required(self):
        self.assertEqual(financial_rankings(self.factory.get("/" )).status_code, 401)

    @patch("accounts.views.GemFinancialRanking._require_role", return_value=(None, None))
    def test_technically_qualified_without_company_price_remains_in_report(self, _role):
        row = self.row()
        row.sellers = self.sellers[:1]
        with patch("accounts.views.GemFinancialRanking.GemFinancialRanking.objects.order_by", return_value=[row]):
            response = financial_rankings(self.factory.get("/", {"qualified_only": "1"}))
            results = json.loads(response.content)["results"]
            self.assertEqual(len(results), 1)
            self.assertIsNone(results[0]["company_rank"])

    @patch("accounts.views.GemFinancialRanking._require_role", return_value=(None, None))
    def test_qualified_report_excludes_unknown_and_disqualified_status(self, _role):
        qualified = self.row()
        missing = self.row()
        missing.technical_status = "unknown"
        ambiguous = self.row()
        ambiguous.technical_status = "disqualified"
        with patch("accounts.views.GemFinancialRanking.GemFinancialRanking.objects.order_by", return_value=[qualified, missing, ambiguous]):
            response = financial_rankings(self.factory.get("/", {"qualified_only": "1"}))
            results = json.loads(response.content)["results"]
            self.assertEqual(len(results), 1)
            self.assertEqual(results[0]["company_rank"], 2)
            self.assertEqual(len(results[0]["sellers"]), 2)

    @patch("accounts.views.GemFinancialRanking._require_role", return_value=(None, None))
    def test_invalid_payloads_never_write(self, _role):
        with patch("accounts.views.GemFinancialRanking.GemFinancialRanking.objects.update_or_create") as save:
            for body in [[], {}, {"bid_no": "GEM/2026/B/123", "sellers": []}, {"bid_no": "GEM/2026/B/123", "sellers": [dict(self.sellers[0], rank=True)]}]:
                response = financial_rankings(self.factory.post("/", data=json.dumps(body), content_type="application/json"))
                self.assertEqual(response.status_code, 400)
            save.assert_not_called()

    @patch("accounts.views.GemFinancialRanking._require_role", return_value=(None, None))
    def test_save_uses_bid_lot_and_ignores_client_company_rank(self, _role):
        with patch("accounts.views.GemFinancialRanking.GemFinancialRanking.objects.update_or_create", return_value=(self.row(), True)) as save:
            body = {"bid_no": "GEM/2026/B/123", "lot_key": "lot-2", "sellers": self.sellers, "company_rank": 1}
            response = financial_rankings(self.factory.post("/", data=json.dumps(body), content_type="application/json"))
            self.assertEqual(response.status_code, 201)
            payload = json.loads(response.content)
            self.assertEqual(payload["company_rank"], 2)
            self.assertEqual(payload["saved"], 1)
            self.assertEqual(payload["created"], 1)
            self.assertEqual(payload["updated"], 0)
            self.assertTrue(payload["frontend_visible"])
            self.assertEqual(save.call_args.kwargs["lot_key"], "lot-2")

    @patch("accounts.views.GemFinancialRanking._require_role", return_value=(None, None))
    def test_refresh_confirms_frontend_visible_update(self, _role):
        with patch("accounts.views.GemFinancialRanking.GemFinancialRanking.objects.update_or_create", return_value=(self.row(), False)):
            body = {"bid_no": "GEM/2026/B/123", "lot_key": "", "sellers": self.sellers}
            response = financial_rankings(self.factory.post("/", data=json.dumps(body), content_type="application/json"))
            payload = json.loads(response.content)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(payload["saved"], 1)
            self.assertEqual(payload["created"], 0)
            self.assertEqual(payload["updated"], 1)
            self.assertTrue(payload["frontend_visible"])

    @patch("accounts.views.GemFinancialRanking._require_role", return_value=(None, None))
    def test_awarded_save_requires_dates_and_preserves_statuses(self, _role):
        body = {
            "bid_no": "GEM/2026/B/123", "source_type": "bid_ra_awarded",
            "technical_status": "not_evaluated", "sellers": self.sellers,
        }
        with patch("accounts.views.GemFinancialRanking.GemFinancialRanking.objects.update_or_create") as save:
            response = financial_rankings(self.factory.post("/", data=json.dumps(body), content_type="application/json"))
            self.assertEqual(response.status_code, 400)
            save.assert_not_called()

        body.update({"start_date": "2026-09-14", "end_date": "2026-09-24"})
        with patch("accounts.views.GemFinancialRanking.GemFinancialRanking.objects.update_or_create", return_value=(self.row(), True)) as save:
            response = financial_rankings(self.factory.post("/", data=json.dumps(body), content_type="application/json"))
            self.assertEqual(response.status_code, 201)
            defaults = save.call_args.kwargs["defaults"]
            self.assertEqual(defaults["source_type"], "bid_ra_awarded")
            self.assertEqual(defaults["technical_status"], "not_evaluated")
            self.assertEqual(defaults["start_date"], date(2026, 9, 14))
            self.assertEqual(defaults["sellers"][1]["status"], "not_evaluated")

    def test_delete_requires_authentication(self):
        self.assertEqual(delete_financial_ranking(self.factory.delete("/"), result_id=1).status_code, 401)

    @patch("accounts.views.GemFinancialRanking._require_role", return_value=(None, None))
    def test_delete_missing_record_returns_404(self, _role):
        with patch("accounts.views.GemFinancialRanking.GemFinancialRanking.objects.filter") as manager:
            manager.return_value.first.return_value = None
            response = delete_financial_ranking(self.factory.delete("/"), result_id=999)
            self.assertEqual(response.status_code, 404)

    @patch("accounts.views.GemFinancialRanking._require_role", return_value=(None, None))
    def test_delete_removes_the_record(self, _role):
        row = self.row()
        with patch("accounts.views.GemFinancialRanking.GemFinancialRanking.objects.filter") as manager:
            manager.return_value.first.return_value = row
            row.delete = lambda: None
            response = delete_financial_ranking(self.factory.delete("/"), result_id=row.id)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(json.loads(response.content), {"deleted": True, "bid_no": row.bid_no})
