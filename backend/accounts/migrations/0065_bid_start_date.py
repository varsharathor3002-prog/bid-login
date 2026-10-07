from django.db import migrations, models


class Migration(migrations.Migration):
    """Bid Start Date alongside the existing Bid End Date (``date``)."""

    dependencies = [
        ("accounts", "0064_catalogue_gem_product_id"),
    ]

    operations = [
        migrations.AddField(
            model_name="desktopbid",
            name="start_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="workstationbid",
            name="start_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="printerbid",
            name="start_date",
            field=models.DateField(blank=True, null=True),
        ),
    ]
