from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("accounts", "0045_remove_desktopbid_installation_pincode")]
    operations = [
        migrations.CreateModel(
            name="GemBidOpportunity",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("bid_no", models.CharField(max_length=100, unique=True)),
                ("bid_date", models.DateTimeField(blank=True, null=True)),
                ("end_date", models.DateTimeField(blank=True, null=True)),
                ("product_name", models.CharField(max_length=500)),
                ("department", models.TextField(blank=True, default="")),
                ("delivery_pincode", models.CharField(blank=True, default="", max_length=6)),
                ("product_type", models.CharField(blank=True, default="", max_length=40)),
                ("last_seen_at", models.DateTimeField(auto_now=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"ordering": ["-bid_date", "-created_at"]},
        ),
    ]
