from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0030_printerbid_local_content"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="printerbid",
            name="add_amount",
        ),
        migrations.RemoveField(
            model_name="printerbid",
            name="optional_ports",
        ),
    ]
