from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0053_remove_gemaccount"),
    ]

    operations = [
        migrations.AlterModelTable(name="user", table="app_users"),
        migrations.AlterModelTable(name="catalogueproduct", table="product_catalogue"),
        migrations.AlterModelTable(name="desktopbid", table="desktop_bid_details"),
        migrations.AlterModelTable(name="workstationbid", table="workstation_bid_details"),
        migrations.AlterModelTable(name="printerbid", table="printer_bid_details"),
        migrations.AlterModelTable(name="componentrate", table="current_component_rates"),
        migrations.AlterModelTable(name="componentratehistory", table="component_rate_history"),
        migrations.AlterModelTable(name="gemuploadjob", table="gem_product_upload_jobs"),
        migrations.AlterModelTable(name="gemauditlog", table="gem_upload_activity_logs"),
        migrations.AlterModelTable(name="gembidresult", table="gem_disqualified_bid_results"),
        migrations.AlterModelTable(name="gembidevaluationhistory", table="gem_disqualification_details"),
        migrations.AlterModelTable(name="gembidopportunity", table="gem_bids_to_be_participated"),
        migrations.AlterModelTable(name="gembidassignment", table="gem_bid_user_assignments"),
        migrations.AlterModelTable(name="gembidassignmenthistory", table="gem_bid_assignment_history"),
    ]
