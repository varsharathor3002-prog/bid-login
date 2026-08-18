from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0047_gembidopportunity_is_deleted"),
    ]

    operations = [
        migrations.AddField(
            model_name="gembidopportunity",
            name="pdf_url",
            field=models.URLField(blank=True, default="", max_length=1000),
        ),
    ]
