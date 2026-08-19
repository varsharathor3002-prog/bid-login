from django.db import models


class User(models.Model):

    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('analyser', 'Analyzer'),
        ('user', 'User'),
    ]

    username = models.CharField(max_length=100)
    email = models.EmailField(unique=True)
    password = models.CharField(max_length=255)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='user')

    def __str__(self):
        return self.username

    class Meta:
        db_table = "app_users"




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
        db_table = "product_catalogue"
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
    local_content = models.CharField(max_length=20, blank=True, null=True)

    freightInstallation = models.CharField(max_length=50, default="Yes")
    freightInstallation_price = models.FloatField(default=1000)

    hddreturnable = models.CharField(max_length=50, default="Yes")
    hddreturnable_price = models.FloatField(default=0)

    total_price = models.FloatField(default=0)

    optional_ports = models.TextField(blank=True, null=True)

    model_number = models.CharField(max_length=255, blank=True, null=True)

    analyser_note = models.TextField(blank=True, null=True)
    analyser_username = models.CharField(max_length=100, blank=True, null=True)
    review_status = models.CharField(max_length=20, default="pending")

    admin_note = models.TextField(blank=True, null=True)
    admin_username = models.CharField(max_length=100, blank=True, null=True)

    gem_status = models.CharField(max_length=30, default="not_started")
    gem_account = models.CharField(max_length=100, blank=True, null=True)
    gem_product_id = models.CharField(max_length=255, blank=True, null=True)
    gem_product_url = models.URLField(max_length=1000, blank=True, null=True)
    gem_error = models.TextField(blank=True, null=True)
    gem_uploaded_at = models.DateTimeField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.bid_no} - {self.dept_name}"

    class Meta:
        db_table = "desktop_bid_details"


class GemUploadJob(models.Model):
    STATUS_CHOICES = [
        ("queued", "Queued"),
        ("ready_for_fill", "Ready for extension fill"),
        ("filled", "Filled in GeM"),
        ("retrying", "Retrying"),
        ("submitted", "Submitted"),
        ("published", "Published"),
        ("rejected", "Rejected"),
        ("failed", "Failed"),
        ("cancelled", "Cancelled"),
    ]

    PRODUCT_TYPE_CHOICES = [
        ("desktop", "Desktop"),
        ("printer", "Printer"),
        ("workstation", "Workstation"),
    ]

    product_type = models.CharField(max_length=20, choices=PRODUCT_TYPE_CHOICES, default="desktop")
    bid = models.ForeignKey(
        DesktopBid, on_delete=models.CASCADE, related_name="gem_upload_jobs",
        null=True, blank=True,
    )
    printer_bid = models.ForeignKey(
        "PrinterBid", on_delete=models.CASCADE, related_name="gem_upload_jobs",
        null=True, blank=True,
    )
    workstation_bid = models.ForeignKey(
        "WorkstationBid", on_delete=models.CASCADE, related_name="gem_upload_jobs",
        null=True, blank=True,
    )
    triggered_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="triggered_gem_upload_jobs",
    )
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default="queued")
    progress = models.CharField(max_length=255, default="Waiting for worker")
    error = models.TextField(blank=True, default="")
    rejection_reason = models.TextField(blank=True, default="")
    attempts = models.PositiveIntegerField(default=0)
    max_attempts = models.PositiveIntegerField(default=3)
    next_attempt_at = models.DateTimeField(blank=True, null=True)
    captcha_image = models.TextField(blank=True, default="")
    captcha_response_encrypted = models.TextField(blank=True, default="")
    captcha_attempts = models.PositiveIntegerField(default=0)
    gem_product_id = models.CharField(max_length=255, blank=True, default="")
    gem_product_url = models.URLField(max_length=1000, blank=True, default="")
    payload_snapshot = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(blank=True, null=True)
    submitted_at = models.DateTimeField(blank=True, null=True)
    completed_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "gem_product_upload_jobs"
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["status", "next_attempt_at"],
                name="accounts_ge_status_804a8e_idx",
            ),
        ]

    @property
    def related_bid(self):
        """Whichever product bid this job belongs to (desktop/printer/workstation)."""
        return self.bid or self.printer_bid or self.workstation_bid

    def __str__(self):
        bid = self.related_bid
        return f"GeM job {self.id}: {bid.bid_no if bid else 'unassigned'}"


class GemAuditLog(models.Model):
    job = models.ForeignKey(
        GemUploadJob, on_delete=models.CASCADE, related_name="audit_logs"
    )
    actor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    event = models.CharField(max_length=100)
    message = models.TextField(blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "gem_upload_activity_logs"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.job_id}: {self.event}"


class GemBidResult(models.Model):
    PRODUCT_CHOICES = [
        ("desktop", "Desktop"),
        ("aio", "AIO"),
        ("workstation", "Workstation"),
        ("printer", "Printer"),
        ("other", "Other"),
    ]
    bid_no = models.CharField(max_length=100, unique=True)
    product_type = models.CharField(max_length=20, choices=PRODUCT_CHOICES, default="desktop")
    item_name = models.CharField(max_length=500, blank=True, default="")
    quantity = models.PositiveIntegerField(blank=True, null=True)
    department = models.TextField(blank=True, default="")
    start_date = models.DateTimeField(blank=True, null=True)
    end_date = models.DateTimeField(blank=True, null=True)
    status = models.CharField(max_length=150, blank=True, default="")
    technical_status = models.CharField(max_length=150, blank=True, default="")
    is_disqualified = models.BooleanField(default=False)
    is_final = models.BooleanField(default=False)
    newly_disqualified = models.BooleanField(default=False)
    disqualified_at = models.DateTimeField(blank=True, null=True)
    linked_bid = models.ForeignKey(
        DesktopBid,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="gem_results",
    )
    last_synced_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "gem_disqualified_bid_results"
        ordering = ["-disqualified_at", "-last_synced_at"]
        indexes = [
            models.Index(fields=["product_type", "is_disqualified"], name="accounts_ge_product_disq_idx"),
            models.Index(fields=["is_disqualified", "disqualified_at"], name="accounts_ge_is_disq_idx"),
            models.Index(fields=["is_final", "last_synced_at"], name="accounts_ge_is_final_idx"),
        ]

    def __str__(self):
        return f"{self.bid_no}: {self.technical_status or self.status}"


class GemBidEvaluationHistory(models.Model):
    bid_result = models.ForeignKey(
        GemBidResult, on_delete=models.CASCADE, related_name="evaluation_history"
    )
    date_time = models.DateTimeField(blank=True, null=True)
    status = models.CharField(max_length=150, blank=True, default="")
    reason = models.TextField(blank=True, default="")
    comment = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "gem_disqualification_details"
        ordering = ["-date_time", "-id"]

    def __str__(self):
        return f"{self.bid_result.bid_no}: {self.status}"


class GemBidOpportunity(models.Model):
    bid_no = models.CharField(max_length=100, unique=True)
    bid_date = models.DateTimeField(blank=True, null=True)
    end_date = models.DateTimeField(blank=True, null=True)
    product_name = models.CharField(max_length=500)
    department = models.TextField(blank=True, default="")
    delivery_pincode = models.CharField(max_length=6, blank=True, default="")
    product_type = models.CharField(max_length=40, blank=True, default="")
    pdf_url = models.URLField(max_length=1000, blank=True, default="")
    is_deleted = models.BooleanField(default=False)
    last_seen_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "gem_bids_to_be_participated"
        ordering = ["-bid_date", "-created_at"]

    def __str__(self):
        return f"{self.bid_no}: {self.product_name}"


class GemBidAssignment(models.Model):
    STATUS_CHOICES = [
        ("assigned", "Assigned"),
        ("in_progress", "In Progress"),
        ("participated", "Participated"),
        ("skipped", "Not Eligible / Skipped"),
        ("expired", "Expired"),
    ]

    opportunity = models.OneToOneField(
        GemBidOpportunity, on_delete=models.PROTECT, related_name="assignment"
    )
    assigned_to = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="gem_bid_assignments"
    )
    assigned_by = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="gem_bid_assignments_created"
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="assigned")
    assigned_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(blank=True, null=True)
    hidden_for_user = models.BooleanField(default=False)
    hidden_for_analyser = models.BooleanField(default=False)
    hidden_for_admin = models.BooleanField(default=False)

    class Meta:
        db_table = "gem_bid_user_assignments"
        ordering = ["-assigned_at", "-id"]
        indexes = [
            models.Index(fields=["assigned_to", "status"], name="gem_assign_user_status_idx"),
            models.Index(fields=["status", "assigned_at"], name="gem_assign_status_date_idx"),
        ]


class GemBidAssignmentHistory(models.Model):
    assignment = models.ForeignKey(
        GemBidAssignment, on_delete=models.CASCADE, related_name="history"
    )
    action = models.CharField(max_length=30)
    from_user = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="gem_bid_assignment_history_from",
        blank=True, null=True,
    )
    to_user = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="gem_bid_assignment_history_to",
        blank=True, null=True,
    )
    old_status = models.CharField(max_length=20, blank=True, default="")
    new_status = models.CharField(max_length=20, blank=True, default="")
    changed_by = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="gem_bid_assignment_changes"
    )
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "gem_bid_assignment_history"
        ordering = ["-changed_at", "-id"]




class WorkstationBid(models.Model):



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




    processor_type = models.CharField(max_length=30, default="intel_xeon")
    processor = models.CharField(max_length=255)
    pro_descp = models.TextField(blank=True, null=True)
    pro_descp_price = models.FloatField(default=0)
    processor_price = models.FloatField(default=0)




    motherboard_type = models.CharField(max_length=30, default="intel_w790")
    motherboard = models.CharField(max_length=255)
    motherboard_descp = models.TextField(blank=True, null=True)
    motherboard_descp_price = models.FloatField(default=0)
    motherboard_price = models.FloatField(default=0)




    ram = models.CharField(max_length=100)
    ram_price = models.FloatField(default=0)




    ssd1 = models.CharField(max_length=100, blank=True, null=True)
    ssd1_price = models.FloatField(default=0)

    ssd2 = models.CharField(max_length=100, blank=True, null=True)
    ssd2_price = models.FloatField(default=0)

    hdd = models.CharField(max_length=100, blank=True, null=True)
    hdd_price = models.FloatField(default=0)




    graphic_card = models.CharField(max_length=255, blank=True, null=True)
    graphic_card_price = models.FloatField(default=0)
    graphics_description = models.TextField(blank=True, null=True, help_text="Technical description of GPU")




    cabinet = models.CharField(max_length=100)
    cabinet_price = models.FloatField(default=0)

    keyboard = models.CharField(max_length=100, blank=True, null=True)
    keyboard_price = models.FloatField(default=0)

    power_supply = models.CharField(max_length=100, blank=True, null=True)
    power_supply_price = models.FloatField(default=0)

    monitor = models.CharField(max_length=100)
    monitor_price = models.FloatField(default=0)




    os = models.CharField(max_length=100)
    os_price = models.FloatField(default=0)

    additional_software = models.TextField(blank=True, null=True, help_text="MS Office, Antivirus, etc.")

    wifi = models.CharField(max_length=100, blank=True, null=True)
    wifi_price = models.FloatField(default=0)

    dvd = models.CharField(max_length=50, blank=True, null=True)
    dvd_price = models.FloatField(default=0)




    warranty = models.CharField(max_length=50)
    warranty_price = models.FloatField(default=0)

    freightInstallation = models.CharField(max_length=50, default="Yes")
    freightInstallation_price = models.FloatField(default=1000)




    hdd_non_return = models.CharField(max_length=50, default="No", help_text="Yes/No (Data Security)")
    hdd_non_return_price = models.FloatField(default=0)

    extra_requirements = models.TextField(blank=True, null=True, help_text="TPM 2.0, RAID Card, Stands, etc.")
    extra_requirements_price = models.FloatField(default=0)




    date = models.DateField()
    epbg = models.FloatField(default=0)

    total_price = models.FloatField(default=0)
    add_amount = models.FloatField(default=0, help_text="Margin/Profit added")
    final_amount = models.FloatField(default=0)

    special_terms = models.TextField(blank=True, null=True)
    bid_status = models.CharField(max_length=100, blank=True, null=True, help_text="Active, Won, Lost, Expired")
    remarks = models.TextField(blank=True, null=True)




    optional_ports = models.TextField(blank=True, null=True)
    model_number = models.CharField(max_length=255, blank=True, unique=True, null=True)

    analyser_note = models.TextField(blank=True, null=True)
    analyser_username = models.CharField(max_length=100, blank=True, null=True)
    review_status = models.CharField(max_length=20, default="pending")

    admin_note = models.TextField(blank=True, null=True)
    admin_username = models.CharField(max_length=100, blank=True, null=True)

    gem_status = models.CharField(max_length=30, default="not_started")
    gem_account = models.CharField(max_length=100, blank=True, null=True)
    gem_product_id = models.CharField(max_length=255, blank=True, null=True)
    gem_product_url = models.URLField(max_length=1000, blank=True, null=True)
    gem_error = models.TextField(blank=True, null=True)
    gem_uploaded_at = models.DateTimeField(blank=True, null=True)




    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.bid_no} - {self.dept_name} (Workstation)"

    class Meta:
        db_table = "workstation_bid_details"


class PrinterBid(models.Model):



    user = models.ForeignKey(
        User, on_delete=models.CASCADE,
        related_name="printer_bids", null=True, blank=True
    )

    bid_no = models.CharField(max_length=100)
    dept_name = models.CharField(max_length=200)
    qty = models.IntegerField(default=1)
    address = models.TextField()
    organization = models.CharField(max_length=255, blank=True, null=True)
    pincode = models.CharField(max_length=10)
    atc = models.TextField(blank=True, null=True)

    atc_special_document = models.FileField(
        upload_to="atc_special_printer/",
        blank=True,
        null=True
    )

    selected_general_docs = models.JSONField(default=list, blank=True)
    selected_general_doc_labels = models.JSONField(default=list, blank=True)

    status = models.CharField(max_length=50, default="draft")




    printing_technology = models.CharField(max_length=100, blank=True, null=True)
    cartridge_technology = models.CharField(max_length=100, blank=True, null=True)
    type_of_printing = models.CharField(max_length=50, blank=True, null=True)
    fax_availability = models.CharField(max_length=20, default="No")
    operating_system_compatibility = models.CharField(max_length=255, blank=True, null=True)




    mono_print_speed_ppm = models.CharField(max_length=100, blank=True, null=True, help_text="Mono ISO/IEC 24734 PPM (Laser/LED MFPs)")
    mono_print_speed_ipm = models.CharField(max_length=100, blank=True, null=True, help_text="Mono ISO/IEC 24734 IPM (Inkjet MFPs)")
    colour_print_speed_ppm = models.CharField(max_length=100, blank=True, null=True, help_text="Colour ISO/IEC 24734 PPM (Laser/LED MFPs)")
    colour_print_speed_ipm = models.CharField(max_length=100, blank=True, null=True, help_text="Colour ISO/IEC 24734 IPM (Inkjet MFPs)")




    auto_duplexing = models.CharField(max_length=20, default="Yes")
    reduction_enlarge_features = models.CharField(max_length=20, blank=True, null=True)
    printer_type = models.CharField(max_length=100, blank=True, null=True)




    max_scan_area = models.CharField(max_length=100, blank=True, null=True)
    a4_scan_speed_colour = models.CharField(max_length=100, blank=True, null=True)
    scan_to_functions = models.CharField(max_length=255, blank=True, null=True)




    document_feeder_type = models.CharField(max_length=100, blank=True, null=True)
    feeder_capacity = models.CharField(max_length=100, blank=True, null=True, help_text="Number of Sheets")
    main_paper_tray_count = models.CharField(max_length=50, blank=True, null=True)
    total_paper_tray_capacity = models.CharField(max_length=100, blank=True, null=True, help_text="Combined capacity at 75 GSM")
    bypass_tray_facility = models.CharField(max_length=20, blank=True, null=True)
    bypass_tray_capacity = models.CharField(max_length=100, blank=True, null=True, help_text="Bypass tray capacity at 75 GSM")




    connectivity = models.CharField(max_length=255, blank=True, null=True)
    duty_cycle = models.CharField(max_length=100, blank=True, null=True, help_text="Number of Prints/Month")




    onsite_warranty = models.CharField(max_length=50, blank=True, null=True, help_text="On Site Warranty (in Years)")
    extended_warranty = models.CharField(max_length=50, blank=True, null=True, help_text="Extended Warranty (in Years)")
    extra_requirements = models.TextField(blank=True, null=True)




    software1 = models.TextField(blank=True, null=True)

    model_number = models.CharField(max_length=255, blank=True, null=True)




    date = models.DateField()
    epbg = models.FloatField(default=0)

    freightInstallation = models.CharField(max_length=50, default="Yes")
    local_content = models.CharField(max_length=20, blank=True, null=True)

    final_amount = models.FloatField(default=0)

    special_terms = models.TextField(blank=True, null=True)
    bid_status = models.CharField(max_length=100, blank=True, null=True, help_text="Active, Won, Lost, Expired")
    remarks = models.TextField(blank=True, null=True)




    analyser_note = models.TextField(blank=True, null=True)
    analyser_username = models.CharField(max_length=100, blank=True, null=True)
    review_status = models.CharField(max_length=20, default="pending")

    admin_note = models.TextField(blank=True, null=True)
    admin_username = models.CharField(max_length=100, blank=True, null=True)

    gem_status = models.CharField(max_length=30, default="not_started")
    gem_account = models.CharField(max_length=100, blank=True, null=True)
    gem_product_id = models.CharField(max_length=255, blank=True, null=True)
    gem_product_url = models.URLField(max_length=1000, blank=True, null=True)
    gem_error = models.TextField(blank=True, null=True)
    gem_uploaded_at = models.DateTimeField(blank=True, null=True)




    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.bid_no} - {self.dept_name} (Printer)"

    class Meta:
        db_table = "printer_bid_details"


class ComponentRate(models.Model):
    """Admin-managed price override for a product configuration option."""

    product = models.CharField(max_length=30)
    category = models.CharField(max_length=60)
    component_name = models.CharField(max_length=500)
    price = models.DecimalField(max_digits=14, decimal_places=2)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "current_component_rates"
        constraints = [
            models.UniqueConstraint(
                fields=["product", "category", "component_name"],
                name="unique_component_rate",
            )
        ]
        ordering = ["product", "category", "component_name"]

    def __str__(self):
        return f"{self.product}/{self.category}: {self.component_name}"


class ComponentRateHistory(models.Model):
    """Immutable audit entry created whenever a component price is changed."""

    product = models.CharField(max_length=30)
    category = models.CharField(max_length=60)
    component_name = models.CharField(max_length=500)
    price = models.DecimalField(max_digits=14, decimal_places=2)
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "component_rate_history"
        ordering = ["changed_at", "id"]

    def __str__(self):
        return f"{self.product}/{self.category}: {self.component_name} @ {self.price}"
