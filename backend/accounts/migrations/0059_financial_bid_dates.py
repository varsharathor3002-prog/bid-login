from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("accounts", "0058_financial_seller_statuses")]
    operations = [
        migrations.AddField(
            model_name="gemfinancialranking",
            name="start_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="gemfinancialranking",
            name="end_date",
            field=models.DateField(blank=True, null=True),
        ),
    ]
