from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0040_componentrate"),
    ]

    operations = [
        migrations.CreateModel(
            name="ComponentRateHistory",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("product", models.CharField(max_length=30)),
                ("category", models.CharField(max_length=60)),
                ("component_name", models.CharField(max_length=500)),
                ("price", models.DecimalField(decimal_places=2, max_digits=14)),
                ("changed_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"ordering": ["changed_at", "id"]},
        ),
    ]
