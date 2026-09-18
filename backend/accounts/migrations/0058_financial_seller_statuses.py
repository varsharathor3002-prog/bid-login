from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("accounts", "0057_financial_technical_status")]
    operations = [
        migrations.AddField(
            model_name="gemfinancialranking",
            name="source_type",
            field=models.CharField(
                max_length=32,
                default="financial_evaluated",
                choices=[
                    ("financial_evaluated", "Financial Evaluated"),
                    ("bid_ra_awarded", "Bid/RA Awarded"),
                ],
            ),
        ),
        migrations.AlterField(
            model_name="gemfinancialranking",
            name="technical_status",
            field=models.CharField(
                max_length=20,
                default="unknown",
                choices=[
                    ("unknown", "Unknown"),
                    ("qualified", "Qualified"),
                    ("not_evaluated", "Not Evaluated"),
                    ("non_qualified", "Non-Qualified"),
                    ("disqualified", "Disqualified"),
                ],
            ),
        ),
    ]
