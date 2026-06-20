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




class CatalogueProduct(models.Model):
    model_no = models.CharField(max_length=255, unique=True)
    processor = models.TextField(blank=True, null=True)
    ram = models.CharField(max_length=100, blank=True, null=True)
    storage = models.CharField(max_length=200, blank=True, null=True)
    os = models.TextField(blank=True, null=True)
    category = models.CharField(max_length=100, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    extra_specs = models.JSONField(blank=True, null=True, default=dict)
    image = models.ImageField(upload_to="catalogue_images/", blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.model_no} — {self.category or ''}"


class DesktopBid(models.Model):

    user = models.ForeignKey(
        User, on_delete=models.CASCADE,
        related_name="desktop_bids", null=True, blank=True
    )

    bid_no = models.CharField(max_length=100)
    dept_name = models.CharField(max_length=200)
    qty = models.IntegerField(default=1)
    address = models.TextField()
    organization = models.CharField(max_length=255, blank=True, null=True)
    pincode = models.CharField(max_length=10)
    atc = models.TextField(blank=True, null=True)

    atc_special_document = models.FileField(
        upload_to="atc_special/",
        blank=True,
        null=True
    )

    selected_general_docs = models.JSONField(default=list, blank=True)
    selected_general_doc_labels = models.JSONField(default=list, blank=True)

    status = models.CharField(max_length=50, default="draft")

    processor_type = models.CharField(max_length=20, default="intel")
    processor = models.CharField(max_length=255)
    pro_descp = models.TextField(blank=True, null=True)
    pro_descp_price = models.FloatField(default=0)
    processor_price = models.FloatField(default=0)

    ram = models.CharField(max_length=100)
    ram_price = models.FloatField(default=0)

    hdd = models.CharField(max_length=100, blank=True, null=True)
    hdd_price = models.FloatField(default=0)

    ssd1 = models.CharField(max_length=100, blank=True, null=True)
    ssd1_price = models.FloatField(default=0)

    ssd2 = models.CharField(max_length=100, blank=True, null=True)
    ssd2_price = models.FloatField(default=0)

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

    motherboard_type = models.CharField(max_length=20, default="intel")
    motherboard = models.CharField(max_length=255)
    motherboard_descp = models.TextField(blank=True, null=True)
    motherboard_descp_price = models.FloatField(default=0)
    motherboard_price = models.FloatField(default=0)

    software1 = models.TextField(blank=True, null=True)
    software1_price = models.FloatField(default=0)

    gp = models.TextField(blank=True, null=True)
    gp_price = models.FloatField(default=0)

    date = models.DateField()
    epbg = models.FloatField(default=0)

    freightInstallation = models.CharField(max_length=50, default="Yes")
    freightInstallation_price = models.FloatField(default=1000)

    hddreturnable = models.CharField(max_length=50, default="Yes")
    hddreturnable_price = models.FloatField(default=0)

    model_number = models.CharField(max_length=255, blank=True, unique=True, null=True)

    analyser_note = models.TextField(blank=True, null=True)
    analyser_username = models.CharField(max_length=100, blank=True, null=True)
    review_status = models.CharField(max_length=20, default="pending")

    admin_note = models.TextField(blank=True, null=True)
    admin_username = models.CharField(max_length=100, blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.bid_no} - {self.dept_name}"