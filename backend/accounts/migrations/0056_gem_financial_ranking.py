from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("accounts", "0055_workstationbid_model_number_not_unique")]
    operations = [
        migrations.CreateModel(
            name="GemFinancialRanking",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("bid_no", models.CharField(max_length=100)),
                ("lot_key", models.CharField(blank=True, default="", max_length=100)),
                ("item_name", models.CharField(blank=True, max_length=500)),
                ("sellers", models.JSONField(default=list)),
                ("last_synced_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "db_table": "gem_financial_rankings",
                "ordering": ["-last_synced_at", "-id"],
                "constraints": [models.UniqueConstraint(fields=("bid_no", "lot_key"), name="gem_financial_bid_lot_unique")],
            },
        ),
    ]
