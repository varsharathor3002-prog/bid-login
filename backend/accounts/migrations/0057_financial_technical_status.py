from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("accounts", "0056_gem_financial_ranking")]
    operations = [
        migrations.AddField(model_name="gemfinancialranking", name="ra_no", field=models.CharField(max_length=100, blank=True, default="")),
        migrations.AddField(model_name="gemfinancialranking", name="technical_status", field=models.CharField(max_length=20, default="unknown", choices=[("unknown", "Unknown"), ("qualified", "Qualified"), ("disqualified", "Disqualified")])),
    ]
