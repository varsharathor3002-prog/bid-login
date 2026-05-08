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



class DesktopBid(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="desktop_bids",
        null=True,
        blank=True
    )

    # 🔹 STEP 1 (Basic Info)
    bid_no = models.CharField(max_length=100)
    dept_name = models.CharField(max_length=200)
    qty = models.IntegerField()
    address = models.TextField()
    pincode = models.CharField(max_length=10)
    atc = models.TextField(blank=True, null=True)

    status = models.CharField(max_length=50, default='draft')

    # 🔹 STEP 2 (Specs)
    processor_type = models.CharField(max_length=20, default="intel")
    processor = models.CharField(max_length=255)
    pro_descp = models.TextField(blank=True, null=True)
    processor_price = models.FloatField(default=0)

    ram = models.CharField(max_length=100)
    ram_price = models.FloatField(default=0)

    hdd = models.CharField(max_length=100, blank=True, null=True)
    hdd_price = models.FloatField(default=0)

    ssd1 = models.CharField(max_length=100, blank=True, null=True)
    ssd1_price = models.FloatField(default=0)

    ssd2 = models.CharField(max_length=100, blank=True, null=True)
    ssd2_price = models.FloatField(default=0)

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

    motherboard_type = models.CharField(max_length=20, default="intel")
    motherboard = models.CharField(max_length=255)
    motherboard_descp = models.TextField(blank=True, null=True)
    motherboard_price = models.FloatField(default=0)

    date = models.DateField()
    epbg = models.FloatField(default=0)

    freightInstallation = models.CharField(max_length=50, default="Yes")
    freightInstallation_price = models.FloatField(default=1000)

    hddreturnable = models.CharField(max_length=50, default="Yes")
    hddreturnable_price = models.FloatField(default=0)

    # 🔹 STEP 3 (Model Number)
    model_number = models.CharField(max_length=255, blank=True, null=True)

    # 🔹 ANALYSER
    analyser_note = models.TextField(blank=True, null=True)
    analyser_username = models.CharField(max_length=100, blank=True, null=True)

    review_status = models.CharField(max_length=20, default="pending")

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.bid_no