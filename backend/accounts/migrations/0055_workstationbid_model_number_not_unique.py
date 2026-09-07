from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0054_rename_application_tables'),
    ]

    operations = [
        migrations.AlterField(
            model_name='workstationbid',
            name='model_number',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
    ]
