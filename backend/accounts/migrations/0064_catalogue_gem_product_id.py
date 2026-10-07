from django.db import migrations, models


class Migration(migrations.Migration):
    """One product per GeM listing: a model number may repeat across GeM
    configurations, unique together with the GeM product id."""

    dependencies = [
        ("accounts", "0063_epbg_optional_ports_price"),
    ]

    operations = [
        migrations.AddField(
            model_name="catalogueproduct",
            name="gem_product_id",
            field=models.CharField(blank=True, default="", max_length=64),
        ),
        migrations.AlterField(
            model_name="catalogueproduct",
            name="model_no",
            field=models.CharField(db_index=True, max_length=255),
        ),
        migrations.AddConstraint(
            model_name="catalogueproduct",
            constraint=models.UniqueConstraint(fields=("model_no", "gem_product_id"), name="catalogue_model_gem_product_unique"),
        ),
    ]
