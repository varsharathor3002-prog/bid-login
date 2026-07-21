from django.urls import path
from . import views
from .views.Workstation import (
    create_workstation_bid,
    update_workstation_bid,
    list_workstation_bids,
    get_workstation_bid,
    review_workstation_bid,
    admin_review_workstation_bid,
    generate_workstation_certificates,
    update_workstation_docs,
    save_workstation_model_number,
    match_workstation_catalogue_models,
    list_workstation_catalogue_products,
)


from .views.Printer import (
    create_printer_bid,
    list_printer_bids,
    update_printer_bid,
    get_printer_bid,
    save_printer_model_number,
    match_printer_catalogue_models,
    list_printer_catalogue_products,
    review_printer_bid,
    admin_review_printer_bid,
    delete_printer_bid,
    update_printer_docs,
    generate_printer_certificates,
)
from .views import ProductDashboard as product_dashboard



urlpatterns = [

    path('register/', views.register),
    path("user-list/", views.user_list),
    path("delete-user/<int:id>/", views.delete_user),
    path("analyser-list/", views.analyser_list),
    path("register-analyser/", views.register_analyser),
    path("delete-analyser/<int:id>/", views.delete_analyser),
    path('login/', views.login),
    path("forgot-password/", views.forgot_password),


    path("catalogue/", views.list_catalogue_products, name="list_catalogue_products"),
    path("catalogue/create/", views.create_catalogue_product, name="create_catalogue_product"),
    path("catalogue/extract-pdf/", views.extract_catalogue_pdf, name="extract_catalogue_pdf"),
    path("catalogue/delete-all/", views.delete_all_catalogue_products, name="delete_all_catalogue_products"),
    path("catalogue/<int:product_id>/", views.get_catalogue_product, name="get_catalogue_product"),
    path("catalogue/<int:product_id>/update/", views.update_catalogue_product, name="update_catalogue_product"),
    path("catalogue/<int:product_id>/delete/", views.delete_catalogue_product, name="delete_catalogue_product"),


    path("check_processor/", views.check_processor, name="check_processor"),
    path("check_ram/", views.check_ram, name="check_ram"),
    path("check_hdd/", views.check_hdd, name="check_hdd"),
    path("check_ssd/", views.check_ssd, name="check_ssd"),
    path("check_os/", views.check_os, name="check_os"),
    path("check_dvd/", views.check_dvd, name="check_dvd"),
    path("check_wifi/", views.check_wifi, name="check_wifi"),
    path("check_motherboard/", views.check_motherboard, name="check_motherboard"),
    path("check_monitor_size/", views.check_monitor_size, name="check_monitor_size"),
    path("check_cabinet_type/", views.check_cabinet_type, name="check_cabinet_type"),
    path("check_keyboard/", views.check_keyboard, name="check_keyboard"),
    path("check_warranty/", views.check_warranty, name="check_warranty"),
    path("desktop-bids/<int:bid_id>/match-catalogue/", views.match_catalogue_models),


    path("desktop-bids/create/", views.create_desktop_bid, name="create_desktop_bid"),


    path("desktop-bids/list/", views.list_desktop_bids, name="list_desktop_bids"),


    path("desktop-bids/<int:bid_id>/update/", views.update_desktop_bid, name="update_desktop_bid"),
    path("desktop-bids/<int:bid_id>/save-model-number/", views.save_model_number, name="save_model_number"),
    path("desktop-bids/<int:bid_id>/", views.get_desktop_bid, name="get_desktop_bid"),
    path("desktop-bids/<int:bid_id>/review/", views.review_desktop_bid, name="review_desktop_bid"),
    path("desktop-bids/<int:bid_id>/admin-review/", views.admin_review_desktop_bid, name="admin_review_desktop_bid"),
    path("desktop-bids/<int:bid_id>/delete/", views.delete_desktop_bid, name="delete_desktop_bid"),


    path("desktop-bids/<int:bid_id>/generate-docs/", views.generate_certificates, name="generate-certificates"),
    path("desktop-bids/<int:bid_id>/update-docs/", views.update_desktop_docs, name="update_desktop_docs"),


    path("desktop-bids/dashboard-years/", views.desktop_dashboard_years, name="desktop_dashboard_years"),
    path("desktop-bids/monthly-performance/", views.desktop_monthly_performance, name="desktop_monthly_performance"),
    path("desktop-bids/daily-activity/", views.desktop_daily_activity, name="desktop_daily_activity"),
    path("desktop-bids/re-analyze-count/", views.desktop_re_analyze_count, name="desktop_re_analyze_count"),


    path("admin/desktop-bids/dashboard-years/", views.admin_desktop_dashboard_years, name="admin_desktop_dashboard_years"),
    path("admin/desktop-bids/monthly-performance/", views.admin_desktop_monthly_performance, name="admin_desktop_monthly_performance"),
    path("admin/desktop-bids/daily-activity/", views.admin_desktop_daily_activity, name="admin_desktop_daily_activity"),
    path("admin/desktop-bids/stats/", views.admin_desktop_stats, name="admin_desktop_stats"),


    path("workstation-bids/create/", create_workstation_bid, name="create_workstation_bid"),
    path("workstation-bids/<int:bid_id>/update/", update_workstation_bid, name="update_workstation_bid"),
    path("workstation-bids/<int:bid_id>/match-catalogue/", match_workstation_catalogue_models, name="match_workstation_catalogue_models"),
    path("workstation-bids/<int:bid_id>/save-model-number/", save_workstation_model_number, name="save_workstation_model_number"),
    path("workstation-bids/list/", list_workstation_bids, name="list_workstation_bids"),
    path("workstation-bids/<int:bid_id>/", get_workstation_bid, name="get_workstation_bid"),
    path("workstation-bids/<int:bid_id>/review/", review_workstation_bid, name="review_workstation_bid"),
    path("workstation-bids/<int:bid_id>/admin-review/", admin_review_workstation_bid, name="admin_review_workstation_bid"),
    path("workstation-bids/<int:bid_id>/generate-docs/", generate_workstation_certificates, name="generate_workstation_certificates"),
    path("workstation-bids/<int:bid_id>/update-docs/", update_workstation_docs, name="update_workstation_docs"),
    path("workstation-catalogue/", list_workstation_catalogue_products, name="list_workstation_catalogue_products"),




    path("printer-bids/create/", create_printer_bid, name="create_printer_bid"),
    path("printer-bids/list/", list_printer_bids, name="list_printer_bids"),
    path("printer-bids/<int:bid_id>/update/", update_printer_bid, name="update_printer_bid"),
    path("printer-bids/<int:bid_id>/save-model-number/", save_printer_model_number, name="save_printer_model_number"),
    path("printer-bids/<int:bid_id>/match-catalogue/", match_printer_catalogue_models, name="match_printer_catalogue_models"),
    path("printer-bids/<int:bid_id>/", get_printer_bid, name="get_printer_bid"),
    path("printer-bids/<int:bid_id>/review/", review_printer_bid, name="review_printer_bid"),
    path("printer-bids/<int:bid_id>/admin-review/", admin_review_printer_bid, name="admin_review_printer_bid"),
    path("printer-bids/<int:bid_id>/delete/", delete_printer_bid, name="delete_printer_bid"),
    path("printer-bids/<int:bid_id>/generate-docs/", generate_printer_certificates, name="generate_printer_certificates"),
    path("printer-bids/<int:bid_id>/update-docs/", update_printer_docs, name="update_printer_docs"),
    path("printer-catalogue/", list_printer_catalogue_products, name="list_printer_catalogue_products"),
    path("workstation-bids/dashboard-years/", product_dashboard.workstation_dashboard_years),
    path("workstation-bids/monthly-performance/", product_dashboard.workstation_monthly_performance),
    path("workstation-bids/daily-activity/", product_dashboard.workstation_daily_activity),
    path("admin/workstation-bids/dashboard-years/", product_dashboard.admin_workstation_dashboard_years),
    path("admin/workstation-bids/monthly-performance/", product_dashboard.admin_workstation_monthly_performance),
    path("admin/workstation-bids/daily-activity/", product_dashboard.admin_workstation_daily_activity),
    path("admin/workstation-bids/stats/", product_dashboard.admin_workstation_stats),
    path("printer-bids/dashboard-years/", product_dashboard.printer_dashboard_years),
    path("printer-bids/monthly-performance/", product_dashboard.printer_monthly_performance),
    path("printer-bids/daily-activity/", product_dashboard.printer_daily_activity),
    path("admin/printer-bids/dashboard-years/", product_dashboard.admin_printer_dashboard_years),
    path("admin/printer-bids/monthly-performance/", product_dashboard.admin_printer_monthly_performance),
    path("admin/printer-bids/daily-activity/", product_dashboard.admin_printer_daily_activity),
    path("admin/printer-bids/stats/", product_dashboard.admin_printer_stats),
]
