from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("accounts", "0036_extension_gem_job_statuses")]

    operations = [
        migrations.AlterField(
            model_name="gemuploadjob",
            name="account",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="upload_jobs",
                to="accounts.gemaccount",
            ),
        ),
    ]
