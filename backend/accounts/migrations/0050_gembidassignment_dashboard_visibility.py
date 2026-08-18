from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("accounts", "0049_gembidassignment_and_history")]

    operations = [
        migrations.AddField(model_name="gembidassignment", name="hidden_for_user", field=models.BooleanField(default=False)),
        migrations.AddField(model_name="gembidassignment", name="hidden_for_analyser", field=models.BooleanField(default=False)),
        migrations.AddField(model_name="gembidassignment", name="hidden_for_admin", field=models.BooleanField(default=False)),
    ]
