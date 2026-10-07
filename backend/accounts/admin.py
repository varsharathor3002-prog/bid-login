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


# Every other table also shows in admin, with its first columns listed and
# its text fields searchable.
class AutoAdmin(admin.ModelAdmin):
    list_per_page = 50

    def _fields(self):
        return [f for f in self.model._meta.concrete_fields if not f.many_to_many]

    def get_list_display(self, request):
        names = [f.name for f in self._fields() if f.get_internal_type() not in ("TextField", "JSONField", "FileField")]
        return names[:8] or ["__str__"]

    def get_search_fields(self, request):
        return [f.name for f in self._fields() if f.get_internal_type() == "CharField"][:6]

    def get_list_filter(self, request):
        return [f.name for f in self._fields() if f.name in ("status", "review_status", "role", "category", "product_type", "event")]

    def get_ordering(self, request):
        return ["-id"]


# AIO / Toner tables are created on first use (see _ensure_table in their
# views), so the admin creates them too before listing.
class LazyTableAdmin(AutoAdmin):
    ensure = None

    def get_queryset(self, request):
        if self.ensure:
            self.ensure()
        return super().get_queryset(request)


def _register_rest():
    from django.apps import apps
    from .views import Aio, Toner

    for model in apps.get_app_config("accounts").get_models():
        if not admin.site.is_registered(model):
            admin.site.register(model, AutoAdmin)
    for module in (Aio, Toner):
        for model, ensure in (
            (getattr(module, f"{module.__name__.rsplit('.', 1)[-1]}Bid"), module._ensure_table),
            (getattr(module, f"{module.__name__.rsplit('.', 1)[-1]}GemUploadJob"), module._ensure_gem_tables),
            (getattr(module, f"{module.__name__.rsplit('.', 1)[-1]}GemAuditLog"), module._ensure_gem_tables),
        ):
            if not admin.site.is_registered(model):
                admin.site.register(model, type(f"{model.__name__}Admin", (LazyTableAdmin,), {"ensure": staticmethod(ensure)}))


_register_rest()
