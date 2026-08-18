from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0046_gembidopportunity"),
    ]

    operations = [
        migrations.AddField(
            model_name="gembidopportunity",
            name="is_deleted",
            field=models.BooleanField(default=False),
        ),
    ]
