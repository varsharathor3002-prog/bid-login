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

    # Optional ports — filled by analyser only during re-analyze (when admin requests via admin_note)
    optional_ports = models.TextField(blank=True, null=True)

    model_number = models.CharField(max_length=255, blank=True, null=True)

    analyser_note = models.TextField(blank=True, null=True)
    analyser_username = models.CharField(max_length=100, blank=True, null=True)
    review_status = models.CharField(max_length=20, default="pending")

    admin_note = models.TextField(blank=True, null=True)
    admin_username = models.CharField(max_length=100, blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.bid_no} - {self.dept_name}"




class WorkstationBid(models.Model):
    # ==========================================
    # USER & BID META (Same as DesktopBid)
    # ==========================================
    user = models.ForeignKey(
        User, on_delete=models.CASCADE,
        related_name="workstation_bids", null=True, blank=True
    )

    bid_no = models.CharField(max_length=100)
    dept_name = models.CharField(max_length=200)
    qty = models.IntegerField(default=1)
    address = models.TextField()
    organization = models.CharField(max_length=255, blank=True, null=True)
    pincode = models.CharField(max_length=10)
    atc = models.TextField(blank=True, null=True)

    atc_special_document = models.FileField(
        upload_to="atc_special_workstation/",
        blank=True,
        null=True
    )

    selected_general_docs = models.JSONField(default=list, blank=True)
    selected_general_doc_labels = models.JSONField(default=list, blank=True)

    status = models.CharField(max_length=50, default="draft")

    # ==========================================
    # PROCESSOR (Threadripper / Xeon / Core i9)
    # ==========================================
    processor_type = models.CharField(max_length=30, default="intel_xeon")  # intel_xeon, intel_core, amd_threadripper
    processor = models.CharField(max_length=255)
    pro_descp = models.TextField(blank=True, null=True)
    pro_descp_price = models.FloatField(default=0)
    processor_price = models.FloatField(default=0)

    # ==========================================
    # MOTHERBOARD (WRX80 / W790 / W680 / C621)
    # ==========================================
    motherboard_type = models.CharField(max_length=30, default="intel_w790")  # amd_wrx80, intel_w790, intel_w680, intel_c621
    motherboard = models.CharField(max_length=255)
    motherboard_descp = models.TextField(blank=True, null=True)
    motherboard_descp_price = models.FloatField(default=0)
    motherboard_price = models.FloatField(default=0)

    # ==========================================
    # RAM (DDR4 / DDR5 / Registered ECC)
    # ==========================================
    ram = models.CharField(max_length=100)
    ram_price = models.FloatField(default=0)

    # ==========================================
    # STORAGE (SSD & HDD)
    # ==========================================
    ssd1 = models.CharField(max_length=100, blank=True, null=True)
    ssd1_price = models.FloatField(default=0)

    ssd2 = models.CharField(max_length=100, blank=True, null=True)
    ssd2_price = models.FloatField(default=0)

    hdd = models.CharField(max_length=100, blank=True, null=True)
    hdd_price = models.FloatField(default=0)

    # ==========================================
    # GRAPHIC CARD (RTX Ada / A-Series / Quadro / GeForce)
    # ==========================================
    graphic_card = models.CharField(max_length=255, blank=True, null=True)
    graphic_card_price = models.FloatField(default=0)
    graphics_description = models.TextField(blank=True, null=True, help_text="Technical description of GPU")

    # ==========================================
    # PERIPHERALS & CHASSIS
    # ==========================================
    cabinet = models.CharField(max_length=100)
    cabinet_price = models.FloatField(default=0)

    keyboard = models.CharField(max_length=100, blank=True, null=True)
    keyboard_price = models.FloatField(default=0)

    power_supply = models.CharField(max_length=100, blank=True, null=True)
    power_supply_price = models.FloatField(default=0)

    monitor = models.CharField(max_length=100)
    monitor_price = models.FloatField(default=0)

    # ==========================================
    # SOFTWARE, OS & CONNECTIVITY
    # ==========================================
    os = models.CharField(max_length=100)
    os_price = models.FloatField(default=0)

    additional_software = models.TextField(blank=True, null=True, help_text="MS Office, Antivirus, etc.")

    wifi = models.CharField(max_length=100, blank=True, null=True)
    wifi_price = models.FloatField(default=0)

    dvd = models.CharField(max_length=50, blank=True, null=True)
    dvd_price = models.FloatField(default=0)

    # ==========================================
    # WARRANTY & SERVICES
    # ==========================================
    warranty = models.CharField(max_length=50)
    warranty_price = models.FloatField(default=0)

    freightInstallation = models.CharField(max_length=50, default="Yes")
    freightInstallation_price = models.FloatField(default=1000)

    # ==========================================
    # SPECIAL CONDITIONS (Workstation Specific)
    # ==========================================
    hdd_non_return = models.CharField(max_length=50, default="No", help_text="Yes/No (Data Security)")
    hdd_non_return_price = models.FloatField(default=0)

    extra_requirements = models.TextField(blank=True, null=True, help_text="TPM 2.0, RAID Card, Stands, etc.")
    extra_requirements_price = models.FloatField(default=0)

    # ==========================================
    # FINANCIALS & BID STATUS
    # ==========================================
    date = models.DateField()
    epbg = models.FloatField(default=0)

    total_price = models.FloatField(default=0)
    add_amount = models.FloatField(default=0, help_text="Margin/Profit added")
    final_amount = models.FloatField(default=0)

    special_terms = models.TextField(blank=True, null=True)
    bid_status = models.CharField(max_length=100, blank=True, null=True, help_text="Active, Won, Lost, Expired")
    remarks = models.TextField(blank=True, null=True)

    # ==========================================
    # ANALYSER & ADMIN TRACKING (Same as DesktopBid)
    # ==========================================
    optional_ports = models.TextField(blank=True, null=True)
    model_number = models.CharField(max_length=255, blank=True, unique=True, null=True)

    analyser_note = models.TextField(blank=True, null=True)
    analyser_username = models.CharField(max_length=100, blank=True, null=True)
    review_status = models.CharField(max_length=20, default="pending")

    admin_note = models.TextField(blank=True, null=True)
    admin_username = models.CharField(max_length=100, blank=True, null=True)

    # ==========================================
    # TIMESTAMPS
    # ==========================================
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.bid_no} - {self.dept_name} (Workstation)"