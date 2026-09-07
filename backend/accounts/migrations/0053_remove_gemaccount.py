from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0052_delete_gemsession"),
    ]

    operations = [
        # NOTE: the RemoveIndex("gemuploadjob", "accounts_ge_account_276803_idx")
        # and RemoveField("gemuploadjob", "account") operations originally ran
        # as real database operations here — but neither the index nor the
        # account_id column actually exist on this database's
        # accounts_gemuploadjob table (both already gone before this migration
        # ever ran here), so running them for real always raised MySQL error
        # 1091. They still need to happen against Django's internal migration
        # *state* though (otherwise GemUploadJob.account is left as a dangling
        # reference to the GemAccount model being deleted below) — so this is
        # state-only, no SQL executed.
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.RemoveField(
                    model_name="gemuploadjob",
                    name="account",
                ),
            ],
            database_operations=[],
        ),
        migrations.DeleteModel(
            name="GemAccount",
        ),
    ]
