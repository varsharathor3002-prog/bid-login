import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0034_desktopbid_gem_workflow"),
    ]

    operations = [
        migrations.CreateModel(
            name="GemAccount",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("label", models.CharField(max_length=150, unique=True)),
                ("username_encrypted", models.TextField()),
                ("password_encrypted", models.TextField()),
                ("category_mapping", models.JSONField(blank=True, default=list)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="created_gem_accounts", to="accounts.user")),
            ],
            options={"ordering": ["label"]},
        ),
        migrations.CreateModel(
            name="GemSession",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("storage_state_encrypted", models.TextField(blank=True, default="")),
                ("expires_at", models.DateTimeField(blank=True, null=True)),
                ("verified_at", models.DateTimeField(blank=True, null=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("account", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="session", to="accounts.gemaccount")),
            ],
        ),
        migrations.CreateModel(
            name="GemUploadJob",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("status", models.CharField(choices=[("queued", "Queued"), ("running", "Running"), ("waiting_captcha", "Waiting for captcha"), ("retrying", "Retrying"), ("submitted", "Submitted"), ("published", "Published"), ("rejected", "Rejected"), ("failed", "Failed"), ("cancelled", "Cancelled")], default="queued", max_length=30)),
                ("progress", models.CharField(default="Waiting for worker", max_length=255)),
                ("error", models.TextField(blank=True, default="")),
                ("rejection_reason", models.TextField(blank=True, default="")),
                ("attempts", models.PositiveIntegerField(default=0)),
                ("max_attempts", models.PositiveIntegerField(default=3)),
                ("next_attempt_at", models.DateTimeField(blank=True, null=True)),
                ("captcha_image", models.TextField(blank=True, default="")),
                ("captcha_response_encrypted", models.TextField(blank=True, default="")),
                ("captcha_attempts", models.PositiveIntegerField(default=0)),
                ("gem_product_id", models.CharField(blank=True, default="", max_length=255)),
                ("gem_product_url", models.URLField(blank=True, default="", max_length=1000)),
                ("payload_snapshot", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("started_at", models.DateTimeField(blank=True, null=True)),
                ("submitted_at", models.DateTimeField(blank=True, null=True)),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("account", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="upload_jobs", to="accounts.gemaccount")),
                ("bid", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="gem_upload_jobs", to="accounts.desktopbid")),
                ("triggered_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="triggered_gem_upload_jobs", to="accounts.user")),
            ],
            options={
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(fields=["status", "next_attempt_at"], name="accounts_ge_status_804a8e_idx"),
                    models.Index(fields=["account", "status"], name="accounts_ge_account_276803_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="GemAuditLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("event", models.CharField(max_length=100)),
                ("message", models.TextField(blank=True, default="")),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("actor", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to="accounts.user")),
                ("job", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="audit_logs", to="accounts.gemuploadjob")),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
