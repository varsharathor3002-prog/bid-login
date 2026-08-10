from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0037_gem_job_optional_account"),
    ]

    operations = [
        migrations.AddField(
            model_name="desktopbid",
            name="local_content",
            field=models.CharField(blank=True, max_length=20, null=True),
        ),
    ]
