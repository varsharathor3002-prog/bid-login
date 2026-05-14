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

    # ── CATALOGUE PRODUCTS (Analyser portal) ────────────────────────
    # GET    /api/catalogue/                  → list all (filterable by ?search= & ?category=)
    # POST   /api/catalogue/create/           → add new product (multipart: image, model_no, ...)
    # GET    /api/catalogue/<id>/             → single product detail
    # POST   /api/catalogue/<id>/update/      → update product fields (multipart)
    # DELETE /api/catalogue/<id>/delete/      → remove product permanently
    path("catalogue/", views.list_catalogue_products, name="list_catalogue_products"),
    path("catalogue/create/", views.create_catalogue_product, name="create_catalogue_product"),
    path("catalogue/<int:product_id>/", views.get_catalogue_product, name="get_catalogue_product"),
    path("catalogue/<int:product_id>/update/", views.update_catalogue_product, name="update_catalogue_product"),
    path("catalogue/<int:product_id>/delete/", views.delete_catalogue_product, name="delete_catalogue_product"),

    # ── ADMIN PRODUCTS ───────────────────────────────────────────────
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
    path("desktop-bids/create/", views.create_desktop_bid, name="create_desktop_bid"),

    # ── BID LIST ─────────────────────────────────────────────────────
    path("desktop-bids/list/", views.list_desktop_bids, name="list_desktop_bids"),

    # ── SINGLE BID — STEP 2, 3, DETAIL ──────────────────────────────
    path("desktop-bids/<int:bid_id>/update/", views.update_desktop_bid, name="update_desktop_bid"),
    path("desktop-bids/<int:bid_id>/model/", views.save_model_number, name="save_model_number"),
    path("desktop-bids/<int:bid_id>/", views.get_desktop_bid, name="get_desktop_bid"),
    path("desktop-bids/<int:bid_id>/review/", views.review_desktop_bid, name="review_desktop_bid"),
    path("desktop-bids/<int:bid_id>/admin-review/", views.admin_review_desktop_bid, name="admin_review_desktop_bid"),
]