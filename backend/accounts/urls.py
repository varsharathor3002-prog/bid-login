from django.urls import path
from . import views

urlpatterns = [

    # 🔐 Auth APIs
    path('register/', views.register),
    path('login/', views.login),
    path("api/forgot-password/", views.forgot_password),

    # 📊 Bid APIs
    path('bids/approved/', views.approved_bids),   # GET all approved bids
    path('bids/update/', views.update_bid),        # POST update bid (L1 etc.)
    path('aio-bids/', views.aio_bids),
    path('approve-aio/', views.approve_aio_bid),
    path("api/add-price/", views.add_price),
    path("api/price/<str:type>/", views.get_prices),

]