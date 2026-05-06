from django.db import models



class User(models.Model):
    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('analyser', 'Analyzer'),
        ('user', 'User'),
    ]

    username = models.CharField(max_length=100, unique=True)
    email = models.EmailField()
    password = models.CharField(max_length=255)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='user')

    def __str__(self):
        return self.username




class Product(models.Model):
    name = models.CharField(max_length=200, unique=True)

    def __str__(self):
        return self.name

# 🔹 1. MAIN BID (Step 1)


class Bid(models.Model):
    bid_no = models.CharField(max_length=100)
    dept_name = models.CharField(max_length=200)
    qty = models.IntegerField()
    atc = models.TextField(blank=True, null=True)
    address = models.TextField()
    pincode = models.CharField(max_length=10)

    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('submitted', 'Submitted'),
        ('analyzer_review', 'Analyzer Review'),
        ('admin_review', 'Admin Review'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('final_submitted', 'Final Submitted'),
    ]

    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='draft')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.bid_no


# ✅ STEP 2 - SPECIFICATION (FULL PHP MATCH)


class DesktopBid(models.Model):
    # ───── Step 1: Bid Info ─────
    bid_no = models.CharField(max_length=100)
    deptName = models.CharField(max_length=255)
    qty = models.IntegerField()
    address = models.TextField()
    pincode = models.CharField(max_length=10)
    atc = models.TextField(blank=True, null=True)

    # ───── Step 2: Desktop Config ─────
    processor = models.CharField(max_length=255)
    pro_descp = models.TextField(blank=True, null=True)
    processor_price = models.FloatField(default=0)

    ram = models.CharField(max_length=100)
    ram_price = models.FloatField(default=0)

    hdd = models.CharField(max_length=100, blank=True, null=True)
    hdd_price = models.FloatField(default=0)

    ssd = models.CharField(max_length=100, blank=True, null=True)
    ssd_price = models.FloatField(default=0)

    software1 = models.TextField()
    gp = models.TextField()

    os = models.CharField(max_length=100)
    os_price = models.FloatField(default=0)

    dvd = models.CharField(max_length=50, blank=True, null=True)
    dvd_price = models.FloatField(default=0)

    wifi = models.CharField(max_length=100, blank=True, null=True)
    wifi_price = models.FloatField(default=0)

    monitor = models.CharField(max_length=100)
    monitor_price = models.FloatField(default=0)

    cabinet = models.CharField(max_length=50)
    cabinet_price = models.FloatField(default=0)

    keyboard = models.CharField(max_length=100, blank=True, null=True)
    keyboard_price = models.FloatField(default=0)

    warranty = models.CharField(max_length=50)
    warranty_price = models.FloatField(default=0)

    motherboard = models.CharField(max_length=255)
    motherboard_descp = models.TextField(blank=True, null=True)
    motherboard_price = models.FloatField(default=0)

    date = models.DateField()

    epbg = models.FloatField(default=0)

    freightInstallation = models.CharField(max_length=50, default="Yes")
    freightInstallation_price = models.FloatField(default=1000)

    hddreturnable = models.CharField(max_length=50, default="Yes")
    hddreturnable_price = models.FloatField(default=0)

    # ───── Step 3: Model ─────
    model_number = models.CharField(max_length=255)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.bid_no


        
# 🔹 3. MODEL NUMBER (Step 3)
class BidModel(models.Model):
    bid = models.OneToOneField(Bid, on_delete=models.CASCADE, related_name="model")

    model_no = models.CharField(max_length=200)

    def __str__(self):
        return self.model_no


# 🔹 4. Pricing + Admin (Future use)
class BidPricing(models.Model):
    bid = models.OneToOneField(Bid, on_delete=models.CASCADE, related_name="pricing")

    total_price = models.FloatField(null=True, blank=True)
    remark = models.TextField(blank=True, null=True)

    approved = models.BooleanField(default=False)

    def __str__(self):
        return f"Pricing - {self.bid.bid_no}"

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