from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0029_printerbid_frontend_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="printerbid",
            name="local_content",
            field=models.CharField(blank=True, max_length=20, null=True),
        ),
    ]
