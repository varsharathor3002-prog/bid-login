from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0051_gembidassignment_indexes"),
    ]

    operations = [
        migrations.DeleteModel(
            name="GemSession",
        ),
    ]
