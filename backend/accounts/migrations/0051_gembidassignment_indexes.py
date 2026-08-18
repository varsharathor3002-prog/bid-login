from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("accounts", "0050_gembidassignment_dashboard_visibility")]

    operations = [
        migrations.AddIndex(model_name="gembidassignment", index=models.Index(fields=["assigned_to", "status"], name="gem_assign_user_status_idx")),
        migrations.AddIndex(model_name="gembidassignment", index=models.Index(fields=["status", "assigned_at"], name="gem_assign_status_date_idx")),
    ]
