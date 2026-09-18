from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0059_financial_bid_dates'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='role',
            field=models.CharField(
                choices=[
                    ('admin', 'Admin'),
                    ('analyser', 'Analyzer'),
                    ('user', 'User'),
                    ('management', 'Management'),
                ],
                default='user',
                max_length=20,
            ),
        ),
    ]
