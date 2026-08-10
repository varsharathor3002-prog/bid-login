from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("accounts", "0039_gem_bid_results")]

    operations = [
        migrations.AddField(
            model_name="gembidresult",
            name="product_type",
            field=models.CharField(
                choices=[
                    ("desktop", "Desktop"),
                    ("aio", "AIO"),
                    ("workstation", "Workstation"),
                    ("printer", "Printer"),
                    ("other", "Other"),
                ],
                default="desktop",
                max_length=20,
            ),
        ),
        migrations.AddIndex(
            model_name="gembidresult",
            index=models.Index(fields=["product_type", "is_disqualified"], name="accounts_ge_product_disq_idx"),
        ),
    ]
