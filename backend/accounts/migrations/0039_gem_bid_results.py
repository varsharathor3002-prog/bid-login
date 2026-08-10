from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("accounts", "0038_desktopbid_local_content")]

    operations = [
        migrations.CreateModel(
            name="GemBidResult",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("bid_no", models.CharField(max_length=100, unique=True)),
                ("item_name", models.CharField(blank=True, default="", max_length=500)),
                ("quantity", models.PositiveIntegerField(blank=True, null=True)),
                ("department", models.TextField(blank=True, default="")),
                ("start_date", models.DateTimeField(blank=True, null=True)),
                ("end_date", models.DateTimeField(blank=True, null=True)),
                ("status", models.CharField(blank=True, default="", max_length=150)),
                ("technical_status", models.CharField(blank=True, default="", max_length=150)),
                ("is_disqualified", models.BooleanField(default=False)),
                ("is_final", models.BooleanField(default=False)),
                ("newly_disqualified", models.BooleanField(default=False)),
                ("disqualified_at", models.DateTimeField(blank=True, null=True)),
                ("last_synced_at", models.DateTimeField(auto_now=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("linked_bid", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="gem_results", to="accounts.desktopbid")),
            ],
            options={"ordering": ["-disqualified_at", "-last_synced_at"]},
        ),
        migrations.CreateModel(
            name="GemBidEvaluationHistory",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("date_time", models.DateTimeField(blank=True, null=True)),
                ("status", models.CharField(blank=True, default="", max_length=150)),
                ("reason", models.TextField(blank=True, default="")),
                ("comment", models.TextField(blank=True, default="")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("bid_result", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="evaluation_history", to="accounts.gembidresult")),
            ],
            options={"ordering": ["-date_time", "-id"]},
        ),
        migrations.AddIndex(model_name="gembidresult", index=models.Index(fields=["is_disqualified", "disqualified_at"], name="accounts_ge_is_disq_idx")),
        migrations.AddIndex(model_name="gembidresult", index=models.Index(fields=["is_final", "last_synced_at"], name="accounts_ge_is_final_idx")),
    ]
