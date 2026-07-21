from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0028_printerbid"),
    ]

    operations = [
        migrations.AddField(
            model_name="printerbid",
            name="a4_scan_speed_colour",
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name="printerbid",
            name="bypass_tray_facility",
            field=models.CharField(blank=True, max_length=20, null=True),
        ),
        migrations.AddField(
            model_name="printerbid",
            name="cartridge_technology",
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name="printerbid",
            name="extra_requirements",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="printerbid",
            name="operating_system_compatibility",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name="printerbid",
            name="printer_type",
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name="printerbid",
            name="reduction_enlarge_features",
            field=models.CharField(blank=True, max_length=20, null=True),
        ),
    ]
