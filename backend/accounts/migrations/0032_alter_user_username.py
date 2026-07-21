from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0031_remove_printerbid_add_amount_and_optional_ports"),
    ]

    operations = [
        migrations.AlterField(
            model_name="user",
            name="username",
            field=models.CharField(max_length=100),
        ),
    ]
