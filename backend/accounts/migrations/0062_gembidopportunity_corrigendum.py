from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0061_gembidassignment_hidden_for_management'),
    ]

    operations = [
        migrations.AddField(
            model_name='gembidopportunity',
            name='has_corrigendum',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='gembidopportunity',
            name='corrigendum_detail',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='gembidopportunity',
            name='corrigendum_found_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
