from django.contrib import admin
from .models import (
    User, CatalogueProduct, DesktopBid, WorkstationBid,
    GemUploadJob, GemAuditLog,
)


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("id", "username", "email", "role")
    search_fields = ("username", "email")
    list_filter = ("role",)


@admin.register(CatalogueProduct)
class CatalogueProductAdmin(admin.ModelAdmin):
    list_display = ("id", "model_no", "category", "processor", "ram", "storage", "created_at")
    search_fields = ("model_no", "category", "processor")
    list_filter = ("category",)
    ordering = ("-created_at",)


@admin.register(DesktopBid)
class DesktopBidAdmin(admin.ModelAdmin):
    list_display = (
        "id", "bid_no", "dept_name", "qty", "status",
        "review_status", "model_number", "user", "created_at",
    )
    search_fields = ("bid_no", "dept_name", "model_number", "organization")
    list_filter = ("status", "review_status", "processor_type")
    ordering = ("-created_at",)


@admin.register(WorkstationBid)
class WorkstationBidAdmin(admin.ModelAdmin):
    list_display = (
        "id", "bid_no", "dept_name", "qty", "status",
        "review_status", "model_number", "user", "created_at",
    )
    search_fields = ("bid_no", "dept_name", "model_number", "organization")
    list_filter = ("status", "review_status", "processor_type")
    ordering = ("-created_at",)


@admin.register(GemUploadJob)
class GemUploadJobAdmin(admin.ModelAdmin):
    list_display = ("id", "bid", "status", "attempts", "triggered_by", "updated_at")
    list_filter = ("status",)
    search_fields = ("bid__bid_no", "bid__model_number", "gem_product_id")


@admin.register(GemAuditLog)
class GemAuditLogAdmin(admin.ModelAdmin):
    list_display = ("id", "job", "event", "actor", "created_at")
    list_filter = ("event",)
