from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0048_gembidopportunity_pdf_url"),
    ]

    operations = [
        migrations.CreateModel(
            name="GemBidAssignment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("status", models.CharField(choices=[("assigned", "Assigned"), ("in_progress", "In Progress"), ("participated", "Participated"), ("skipped", "Not Eligible / Skipped"), ("expired", "Expired")], default="assigned", max_length=20)),
                ("assigned_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                ("assigned_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="gem_bid_assignments_created", to="accounts.user")),
                ("assigned_to", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="gem_bid_assignments", to="accounts.user")),
                ("opportunity", models.OneToOneField(on_delete=django.db.models.deletion.PROTECT, related_name="assignment", to="accounts.gembidopportunity")),
            ],
            options={"ordering": ["-assigned_at", "-id"]},
        ),
        migrations.CreateModel(
            name="GemBidAssignmentHistory",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("action", models.CharField(max_length=30)),
                ("old_status", models.CharField(blank=True, default="", max_length=20)),
                ("new_status", models.CharField(blank=True, default="", max_length=20)),
                ("changed_at", models.DateTimeField(auto_now_add=True)),
                ("assignment", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="history", to="accounts.gembidassignment")),
                ("changed_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="gem_bid_assignment_changes", to="accounts.user")),
                ("from_user", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="gem_bid_assignment_history_from", to="accounts.user")),
                ("to_user", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="gem_bid_assignment_history_to", to="accounts.user")),
            ],
            options={"ordering": ["-changed_at", "-id"]},
        ),
    ]
