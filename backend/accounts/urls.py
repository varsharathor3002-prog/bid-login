from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.register),
    path('login/', views.login),

    path("forgot-password/", views.forgot_password),
    path('products/', views.get_products),
    path('products/add/', views.add_product),

    # 📊 Bid APIs
    path("create-bid/", views.create_bid),
    path("desktop-bid/", views.create_desktop_bid),
    path("add-model/", views.add_model),
    path('bids/approved/', views.approved_bids),  
    path('bids/update/', views.update_bid),       
    path('aio-bids/', views.aio_bids),
    path('approve-aio/', views.approve_aio_bid),
    path("add-price/", views.add_price),
    path("price/<str:type>/", views.get_prices),

]