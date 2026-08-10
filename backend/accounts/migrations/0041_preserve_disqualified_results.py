from django.db import migrations
from django.db.models import Max, Q


def restore_disqualified_results(apps, schema_editor):
    GemBidResult = apps.get_model("accounts", "GemBidResult")
    rows = GemBidResult.objects.annotate(
        restored_date=Max(
            "evaluation_history__date_time",
            filter=Q(evaluation_history__status__icontains="disqualified"),
        )
    ).filter(evaluation_history__status__icontains="disqualified").distinct()
    for row in rows.iterator():
        updates = {}
        if not row.is_disqualified:
            updates["is_disqualified"] = True
        if not row.disqualified_at:
            updates["disqualified_at"] = row.restored_date
        if not row.technical_status:
            updates["technical_status"] = "Disqualified"
        if updates:
            GemBidResult.objects.filter(pk=row.pk).update(**updates)


class Migration(migrations.Migration):
    dependencies = [("accounts", "0040_gembidresult_product_type")]
    operations = [migrations.RunPython(restore_disqualified_results, migrations.RunPython.noop)]
