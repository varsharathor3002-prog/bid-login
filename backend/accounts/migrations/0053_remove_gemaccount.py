from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0052_delete_gemsession"),
    ]

    operations = [
        migrations.RemoveIndex(
            model_name="gemuploadjob",
            name="accounts_ge_account_276803_idx",
        ),
        migrations.RemoveField(
            model_name="gemuploadjob",
            name="account",
        ),
        migrations.DeleteModel(
            name="GemAccount",
        ),
    ]
