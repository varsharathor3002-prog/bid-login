from django.db import migrations, models


class Migration(migrations.Migration):
    # Only adds the four new price columns. Written by hand: makemigrations
    # also picks up the AIO/Toner models defined in views (their tables are
    # created at runtime by _ensure_model_table), which must stay out of here.

    dependencies = [
        ("accounts", "0062_gembidopportunity_corrigendum"),
    ]

    operations = [
        migrations.AddField(model_name="desktopbid", name="epbg_price", field=models.FloatField(default=0)),
        migrations.AddField(model_name="desktopbid", name="optional_ports_price", field=models.FloatField(default=0)),
        migrations.AddField(model_name="workstationbid", name="epbg_price", field=models.FloatField(default=0)),
        migrations.AddField(model_name="workstationbid", name="optional_ports_price", field=models.FloatField(default=0)),
    ]
