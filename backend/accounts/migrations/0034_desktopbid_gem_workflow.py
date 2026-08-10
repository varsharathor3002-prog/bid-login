from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0033_desktopbid_total_price"),
    ]

    operations = [
        migrations.AddField(
            model_name="desktopbid",
            name="gem_status",
            field=models.CharField(default="not_started", max_length=30),
        ),
        migrations.AddField(
            model_name="desktopbid",
            name="gem_account",
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name="desktopbid",
            name="gem_product_id",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name="desktopbid",
            name="gem_product_url",
            field=models.URLField(blank=True, max_length=1000, null=True),
        ),
        migrations.AddField(
            model_name="desktopbid",
            name="gem_error",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="desktopbid",
            name="gem_uploaded_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
