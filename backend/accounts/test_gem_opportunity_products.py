from django.test import SimpleTestCase

from .views.GemOpportunityRules import classify_opportunity_item


class GemOpportunityProductRulesTests(SimpleTestCase):
    def test_accepts_exact_single_categories(self):
        cases = {
            "Entry and Mid Level Desktop Computer (Q2)": "desktop",
            "High End Desktop Computer (Q2)": "desktop",
            "All in One PC (V2) (Q2)": "aio",
            "Fixed Computer Workstation (Q2)": "workstation",
            "Toner Cartridges / Ink Cartridges (Q2)": "toner",
            "A4 and Legal Size Multifunction Printer (MFP) (Q2)": "printer",
        }
        for item, product_type in cases.items():
            with self.subTest(item=item):
                result = classify_opportunity_item(item)
                self.assertIsNotNone(result)
                self.assertEqual(result["product_type"], product_type)

    def test_accepts_known_pdf_text_clipping_for_approved_categories(self):
        for item in [
            "Entry and Mid Level Desktop Com",
            "A4 and Legal Size Multifunction P (MFP)",
            "A4 an Multifunction Printer (MFP)",
        ]:
            with self.subTest(item=item):
                self.assertIsNotNone(classify_opportunity_item(item))

    def test_accepts_bunch_only_when_every_category_is_approved(self):
        valid = classify_opportunity_item(
            "All in One PC (V2) (Q2), Entry and Mid Level Desktop Computer (Q2), "
            "A4 and Legal Size Multifunction Printer (MFP) (Q2)"
        )
        self.assertEqual(valid["product_type"], "bunch_bid")

        invalid = [
            "A3 Size Multifunction Printer (MFP), A4 and Legal Size Multifunction Printer (MFP)",
            "All in One PC (V2), A4 and Legal Size Multifunction Printer (MFP), Line Interactive UPS with AVR (V2)",
            "All in One PC (V2), Entry and Mid Level Desktop Computer, A4 and Legal Size Multifunction Printer (MFP), A3 Printer (MFP)",
        ]
        for item in invalid:
            with self.subTest(item=item):
                self.assertIsNone(classify_opportunity_item(item))

    def test_rejects_pac_only_after_q_marker(self):
        self.assertIsNone(classify_opportunity_item(
            "A4 and Legal Size Multifunction Printer (MFP) (Q2) ( PAC Only )"
        ))

