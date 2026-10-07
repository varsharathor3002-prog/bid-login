from types import SimpleNamespace
from unittest import mock

from django.test import SimpleTestCase

from . import gem_form_fields

DISPLAY = "Display Size - Diagonal (in Inches)"
AIO_LISTINGS = [
    ("AXL-AIO-A", {
        "Processor Number": "Intel Core i5-12400", "RAM Size (GB)": "16",
        DISPLAY: '58.1 - 63 (22.87" - 24.8")', "Stand": "Height Adjustable",
    }, ["Processor Number", "RAM Size (GB)", DISPLAY, "Stand"]),
    ("AXL-AIO-B", {
        "Processor Number": "Intel Core i7-14700", "RAM Size (GB)": "8",
        DISPLAY: '53.1 - 58 (20.91" - 22.83")', "Stand": "Standard",
    }, ["Processor Number", "RAM Size (GB)", DISPLAY, "Stand"]),
]


def aio_bid(**values):
    fields = dict(processor="", ram="", ssd="", os="", screen_size="", wifi="", keyboard="")
    fields.update(values)
    return SimpleNamespace(**fields)


class AioGemFieldsTests(SimpleTestCase):
    def fields(self, bid):
        with mock.patch.object(gem_form_fields, "_listings", return_value=AIO_LISTINGS):
            return {label: (value, source) for label, value, source in gem_form_fields.aio_gem_fields(bid)}

    def test_bid_values_use_gem_wording(self):
        fields = self.fields(aio_bid(
            processor="Intel Core i7 14700", ram="8GB DDR4 3200", ssd="1 TB NVMe",
            screen_size="21 inch", keyboard="Wireless",
        ))
        self.assertEqual(fields["Processor Number"], ("Intel Core i7-14700", "bid"))
        self.assertEqual(fields["RAM Size (GB)"], ("8", "bid"))
        self.assertEqual(fields["Type of RAM"], ("DDR4", "bid"))
        self.assertEqual(fields["Type of Storage Installed with the System"], ("NVMe SSD", "bid"))
        self.assertEqual(fields["Storage Capacity (in GB)"], ("1024", "bid"))
        self.assertEqual(fields[DISPLAY], ('53.1 - 58 (20.91" - 22.83")', "bid"))
        self.assertEqual(fields["Mouse Connectivity"], ("Wireless", "bid"))

    def test_other_fields_come_from_the_closest_listing(self):
        fields = self.fields(aio_bid(processor="Intel Core i7 14700", ram="8GB", screen_size="21"))
        self.assertEqual(fields["Stand"], ("Standard", "listing AXL-AIO-B"))

    def test_unknown_screen_size_is_left_for_review(self):
        fields = self.fields(aio_bid(processor="Intel Core i5 12400", screen_size="32 inch"))
        self.assertEqual(fields[DISPLAY][1], "listing AXL-AIO-A")


class TonerGemFieldsTests(SimpleTestCase):
    def test_page_yield_maps_to_gem_range(self):
        listings = [("AXL-1", {gem_form_fields.TONER_YIELD: "1001 to 2000", "Description of Stores": "OEM Cartridges"},
                     [gem_form_fields.TONER_YIELD, "Description of Stores"])]
        bid = SimpleNamespace(product_class="Compatible", brand="HP", cartridge_type="Laser Toner",
                              colour="Black", compatibility="HP LaserJet 1020", toner_model="HP 12A", page_yield="1,500")
        with mock.patch.object(gem_form_fields, "_listings", return_value=listings):
            fields = {label: value for label, value, _ in gem_form_fields.toner_gem_fields(bid, "AXL-12A")}
        self.assertEqual(fields[gem_form_fields.TONER_YIELD], "1001 to 2000")
        self.assertEqual(fields[gem_form_fields.TONER_PRINTER_BRAND], "HP")
        self.assertEqual(fields["Type of Cartridge/Consumable"], "Toner Cartridge")
        self.assertEqual(fields["Description of Stores"], "OEM Cartridges")
