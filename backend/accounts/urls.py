from django.urls import path
from . import views

urlpatterns = [
    # ── AUTH ────────────────────────────────────────────────────────
    path('register/', views.register),
    path("user-list/", views.user_list),
    path("delete-user/<int:id>/", views.delete_user),
    path("analyser-list/", views.analyser_list),
    path("register-analyser/", views.register_analyser),
    path("delete-analyser/<int:id>/", views.delete_analyser),
    path('login/', views.login),
    path("forgot-password/", views.forgot_password),

    # ── PRODUCTS ────────────────────────────────────────────────────
    path('products/', views.get_products),
    path('products/add/', views.add_product),

    # ── PRICE CHECK ENDPOINTS ────────────────────────────────────────
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

    # ── 3-STEP BID CREATION ──────────────────────────────────────────
    # STEP 1: Bid create karo (basic info)
    path("desktop-bids/create/", views.create_desktop_bid, name="create_desktop_bid"),

    # ── BID LIST (Admin + Analyser dono use karte hain) ─────────────
    # GET /api/desktop-bids/list/?status=pending&role=admin
    # GET /api/desktop-bids/list/?status=pending&role=analyser
    path("desktop-bids/list/", views.list_desktop_bids, name="list_desktop_bids"),

    # ── SINGLE BID — STEP 2, 3, DETAIL ──────────────────────────────
    # NOTE: Ye path <int:bid_id>/ use karta hai — 'list/' se PEHLE aana chahiye
    # STEP 2: Specs/config update karo
    path("desktop-bids/<int:bid_id>/update/", views.update_desktop_bid, name="update_desktop_bid"),

    # STEP 3: Model number save karo
    path("desktop-bids/<int:bid_id>/model/", views.save_model_number, name="save_model_number"),

    # Single bid detail — pre-fill ke liye
    # GET /api/desktop-bids/<id>/
    path("desktop-bids/<int:bid_id>/", views.get_desktop_bid, name="get_desktop_bid"),

    # Analyser review submit — PATCH
    # PATCH /api/desktop-bids/<id>/review/
    path("desktop-bids/<int:bid_id>/review/", views.review_desktop_bid, name="review_desktop_bid"),

    # ✅ ADMIN review — Approve ya Re-Analyze
    # PATCH /api/desktop-bids/<id>/admin-review/
    path("desktop-bids/<int:bid_id>/admin-review/", views.admin_review_desktop_bid, name="admin_review_desktop_bid"),
]