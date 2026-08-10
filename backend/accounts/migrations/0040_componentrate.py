from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0041_preserve_disqualified_results"),
    ]

    operations = [
        migrations.CreateModel(
            name="ComponentRate",
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
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "ordering": ["product", "category", "component_name"],
                "constraints": [
                    models.UniqueConstraint(
                        fields=("product", "category", "component_name"),
                        name="unique_component_rate",
                    )
                ],
            },
        ),
    ]
