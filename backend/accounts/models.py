from django.db import models

class User(models.Model):
    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('analyser', 'Analyzer'),
        ('user', 'User'),
    ]

    username = models.CharField(max_length=100)
    email = models.EmailField()
    password = models.CharField(max_length=255)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='user')

    def __str__(self):
        return self.username
        



class BidProduct(models.Model):
    bid_no = models.CharField(max_length=100)
    model = models.CharField(max_length=100)
    remark = models.TextField(null=True, blank=True)
    date = models.DateField()
    status = models.CharField(max_length=20)

    # L1 Update
    bid_qualify = models.CharField(max_length=50, null=True, blank=True)
    bid_disqualify_reason = models.TextField(null=True, blank=True)
    dealer_name = models.CharField(max_length=100, null=True, blank=True)
    price = models.FloatField(null=True, blank=True)
    brand = models.CharField(max_length=100, null=True, blank=True)

    def __str__(self):
        return self.bid_no

from django.db import models

class AIOProduct(models.Model):
    user_name = models.CharField(max_length=100)
    bid_no = models.CharField(max_length=100)
    model = models.CharField(max_length=100)
    qty = models.IntegerField()
    date = models.DateField()

    status = models.CharField(max_length=50, default="Pending")
    remark = models.TextField(blank=True, null=True)

    # pricing fields
    pro_price = models.FloatField(default=0)
    ram_price = models.FloatField(default=0)
    hdd_price = models.FloatField(default=0)
    ssd_price = models.FloatField(default=0)

    dealer_name = models.CharField(max_length=100, blank=True, null=True)
    brand = models.CharField(max_length=100, blank=True, null=True)
    price = models.FloatField(default=0)

    total = models.FloatField(default=0)

    def __str__(self):
        return self.bid_no



class Price(models.Model):
    processor = models.CharField(max_length=100)
    pro_price = models.IntegerField()

    ram = models.CharField(max_length=50)
    ram_price = models.IntegerField()

    hdd = models.CharField(max_length=50, null=True, blank=True)
    hdd_price = models.IntegerField(null=True, blank=True)

    ssd = models.CharField(max_length=50, null=True, blank=True)
    ssd_price = models.IntegerField(null=True, blank=True)

    gp = models.CharField(max_length=50, null=True, blank=True)
    gp_price = models.IntegerField(null=True, blank=True)

    os = models.CharField(max_length=100)
    os_price = models.IntegerField()

    motherboard = models.CharField(max_length=100)
    motherboard_price = models.IntegerField()

    dvd = models.CharField(max_length=20, null=True, blank=True)
    dvd_price = models.IntegerField(null=True, blank=True)

    wifi = models.CharField(max_length=100)
    wifi_price = models.IntegerField()

    software1 = models.CharField(max_length=100, null=True, blank=True)
    software1_price = models.IntegerField(null=True, blank=True)

    software2 = models.CharField(max_length=100, null=True, blank=True)
    software2_price = models.IntegerField(null=True, blank=True)

    date = models.DateField()

    def __str__(self):
        return self.processor

# models.py
class PriceItem(models.Model):
    TYPE_CHOICES = [
        ("monitor", "Monitor"),
        ("AIOM", "AIO Monitor"),
        ("cabinet", "Cabinet"),
        ("processor", "Processor"),
        ("ram", "RAM"),
        ("hdd", "HDD"),
        ("ssd", "SSD"),
        ("gp", "Graphics Card"),
        ("os", "Operating System"),
        ("motherboard", "Motherboard"),
        ("AIOMotherboard", "AIO Motherboard"),
        ("dvd", "DVD"),
        ("wifi", "WiFi"),
        ("keyboard", "Keyboard"),
        ("warranty", "Warranty"),
        ("software1", "Software 1"),
        ("software2", "Software 2"),
    ]

    type = models.CharField(max_length=50, choices=TYPE_CHOICES)
    name = models.CharField(max_length=200)
    price = models.IntegerField()
    date = models.DateField()

    def __str__(self):
        return f"{self.type} - {self.name}"