from django.db import migrations, models


class Migration(migrations.Migration):
    """EPBG (%) becomes text so a bid can say "NA" (Not Applicable)."""

    dependencies = [
        ("accounts", "0065_bid_start_date"),
    ]

    operations = [
        migrations.AlterField(
            model_name=model_name,
            name="epbg",
            field=models.CharField(blank=True, default="0", max_length=20),
        )
        for model_name in ("desktopbid", "workstationbid", "printerbid")
    ]
