from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),

    # ✅ All API routes from accounts app
    path('api/', include('accounts.urls')),
]