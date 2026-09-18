from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0060_user_management_role'),
    ]

    operations = [
        migrations.AddField(
            model_name='gembidassignment',
            name='hidden_for_management',
            field=models.BooleanField(default=False),
        ),
    ]
