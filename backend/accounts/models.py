from django.db import models


class User(models.Model):

    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('analyser', 'Analyzer'),
        ('user', 'User'),
    ]

    username = models.CharField(max_length=100, unique=True)
    email = models.EmailField(unique=True)
    password = models.CharField(max_length=255)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='user')

    def __str__(self):
        return self.username


class Product(models.Model):
    name = models.CharField(max_length=200, unique=True)

    def __str__(self):
        return self.name


class CatalogueProduct(models.Model):
    model_no = models.CharField(max_length=255, unique=True)
    processor = models.TextField(blank=True, null=True)
    ram = models.CharField(max_length=100, blank=True, null=True)
    storage = models.CharField(max_length=200, blank=True, null=True)
    os = models.TextField(blank=True, null=True)
    category = models.CharField(max_length=100, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    extra_specs = models.JSONField(blank=True, null=True)
    image = models.ImageField(upload_to='catalogue_images/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.model_no} — {self.processor}"


class DesktopBid(models.Model):

    # USER RELATION
    user = models.ForeignKey(
        User, on_delete=models.CASCADE,
        related_name="desktop_bids", null=True, blank=True
    )

    # ───────── BASIC INFO ─────────
    bid_no      = models.CharField(max_length=100)
    dept_name   = models.CharField(max_length=200)
    qty         = models.IntegerField(default=1)
    address     = models.TextField()
    organization = models.CharField(max_length=255, blank=True, null=True)  # ← NAYA
    pincode     = models.CharField(max_length=10)
    atc         = models.TextField(blank=True, null=True)

    upload_document = models.FileField(
        upload_to="desktop_bid_documents/", blank=True, null=True
    )

    # ───────── ATC DOCUMENTS ─────────  ← NAYE
    atc_special_document = models.FileField(
        upload_to="atc_special/", blank=True, null=True
    )
    general_exp  = models.FileField(upload_to="general/", blank=True, null=True)
    general_perf = models.FileField(upload_to="general/", blank=True, null=True)
    general_turn = models.FileField(upload_to="general/", blank=True, null=True)
    general_cert = models.FileField(upload_to="general/", blank=True, null=True)
    general_oem  = models.FileField(upload_to="general/", blank=True, null=True)
    general_oemT = models.FileField(upload_to="general/", blank=True, null=True)

    status = models.CharField(max_length=50, default='draft')

    # ───────── PROCESSOR ─────────
    processor_type  = models.CharField(max_length=20, default="intel")
    processor       = models.CharField(max_length=255)
    pro_descp       = models.TextField(blank=True, null=True)
    processor_price = models.FloatField(default=0)

    # ───────── RAM ─────────
    ram       = models.CharField(max_length=100)
    ram_price = models.FloatField(default=0)

    # ───────── HDD ─────────
    hdd       = models.CharField(max_length=100, blank=True, null=True)
    hdd_price = models.FloatField(default=0)

    # ───────── SSD 1 ─────────
    ssd1       = models.CharField(max_length=100, blank=True, null=True)
    ssd1_price = models.FloatField(default=0)

    # ───────── SSD 2 ─────────
    ssd2       = models.CharField(max_length=100, blank=True, null=True)
    ssd2_price = models.FloatField(default=0)

    # ───────── SOFTWARE ─────────
    software1 = models.TextField(blank=True, null=True)
    gp        = models.TextField(blank=True, null=True)

    # ───────── OS ─────────
    os       = models.CharField(max_length=100)
    os_price = models.FloatField(default=0)

    # ───────── DVD ─────────
    dvd       = models.CharField(max_length=50, blank=True, null=True)
    dvd_price = models.FloatField(default=0)

    # ───────── WIFI ─────────
    wifi       = models.CharField(max_length=100, blank=True, null=True)
    wifi_price = models.FloatField(default=0)

    # ───────── MONITOR ─────────
    monitor       = models.CharField(max_length=100)
    monitor_price = models.FloatField(default=0)

    # ───────── CABINET ─────────
    cabinet       = models.CharField(max_length=50)
    cabinet_price = models.FloatField(default=0)

    # ───────── KEYBOARD ─────────
    keyboard       = models.CharField(max_length=100, blank=True, null=True)
    keyboard_price = models.FloatField(default=0)

    # ───────── WARRANTY ─────────
    warranty       = models.CharField(max_length=50)
    warranty_price = models.FloatField(default=0)

    # ───────── MOTHERBOARD ─────────
    motherboard_type  = models.CharField(max_length=20, default="intel")
    motherboard       = models.CharField(max_length=255)
    motherboard_descp = models.TextField(blank=True, null=True)
    motherboard_price = models.FloatField(default=0)

    # ───────── EXTRA ─────────
    date                     = models.DateField()
    epbg                     = models.FloatField(default=0)
    freightInstallation      = models.CharField(max_length=50, default="Yes")
    freightInstallation_price = models.FloatField(default=1000)
    hddreturnable            = models.CharField(max_length=50, default="Yes")
    hddreturnable_price      = models.FloatField(default=0)

    # ───────── MODEL NUMBER ─────────
    model_number = models.CharField(max_length=255, blank=True, null=True)

    # ───────── ANALYSER ─────────
    analyser_note     = models.TextField(blank=True, null=True)
    analyser_username = models.CharField(max_length=100, blank=True, null=True)
    review_status     = models.CharField(max_length=20, default="pending")

    # ───────── ADMIN ─────────
    admin_note     = models.TextField(blank=True, null=True)
    admin_username = models.CharField(max_length=100, blank=True, null=True)

    # ───────── TIMESTAMPS ─────────
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.bid_no} - {self.dept_name}"