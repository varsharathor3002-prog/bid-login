from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.register),
    path('login/', views.login),

    path("forgot-password/", views.forgot_password),
    path('products/', views.get_products),
    path('products/add/', views.add_product),

    # 📊 Bid APIs
  # ── 3-STEP BID CREATION ──────────────────────────────────────────
    # STEP 1: Bid create karo (basic info)
    path("desktop-bids/create/", views.create_desktop_bid, name="create_desktop_bid"),
 
    # STEP 2: Specs/config update karo (bid_id se)
    path("desktop-bids/<int:bid_id>/update/", views.update_desktop_bid, name="update_desktop_bid"),
 
    # STEP 3: Model number save karo
    path("desktop-bids/<int:bid_id>/model/", views.save_model_number, name="save_model_number"),
 
 
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
path(
        "desktop-bids/list/",
        views.list_desktop_bids,
        name="list_desktop_bids",
    ),
 
    # Single bid detail — pre-fill ke liye
    # GET /api/desktop-bids/<id>/
    path(
        "desktop-bids/<int:bid_id>/",
        views.get_desktop_bid,
        name="get_desktop_bid",
    ),
 
    # Analyser review submit — PATCH
    # PATCH /api/desktop-bids/<id>/review/
    path(
        "desktop-bids/<int:bid_id>/review/",
        views.review_desktop_bid,
        name="review_desktop_bid",
    ),
 


]