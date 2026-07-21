from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0032_alter_user_username"),
    ]

    operations = [
        migrations.AddField(
            model_name="desktopbid",
            name="total_price",
            field=models.FloatField(default=0),
        ),
    ]
