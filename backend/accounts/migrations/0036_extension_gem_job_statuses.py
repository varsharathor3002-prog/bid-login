from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("accounts", "0035_gem_automation_models")]

    operations = [
        migrations.AlterField(
            model_name="gemuploadjob",
            name="status",
            field=models.CharField(
                choices=[
                    ("queued", "Queued"),
                    ("ready_for_fill", "Ready for extension fill"),
                    ("filled", "Filled in GeM"),
                    ("retrying", "Retrying"),
                    ("submitted", "Submitted"),
                    ("published", "Published"),
                    ("rejected", "Rejected"),
                    ("failed", "Failed"),
                    ("cancelled", "Cancelled"),
                ],
                default="queued",
                max_length=30,
            ),
        ),
        migrations.RunSQL(
            "UPDATE accounts_gemuploadjob SET status='failed', "
            "error=CONCAT('Legacy backend automation stopped. ', error) "
            "WHERE status IN ('running','waiting_captcha')",
            migrations.RunSQL.noop,
        ),
    ]
