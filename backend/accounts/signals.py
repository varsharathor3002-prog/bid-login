from django.db import transaction
from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from . import desktop_excel
from .models import CatalogueProduct


@receiver(pre_save, sender=CatalogueProduct, dispatch_uid="desktop_excel_rename")
def remember_old_key(sender, instance, **kwargs):
    old = (
        CatalogueProduct.objects.filter(pk=instance.pk).values_list("model_no", "gem_product_id").first()
        if instance.pk and not desktop_excel.is_paused() else None
    )
    instance._excel_old_key = desktop_excel.product_key(*old) if old else None


# Every Desktop product change (UI, bid flow, GeM extension) is mirrored into
# Desktop_Product.xlsx once the database transaction commits.
@receiver(post_save, sender=CatalogueProduct, dispatch_uid="desktop_excel_save")
def mirror_saved_product(sender, instance, **kwargs):
    if desktop_excel.is_paused() or not desktop_excel.is_desktop(instance):
        return
    product_id = instance.pk
    old_key = getattr(instance, "_excel_old_key", None)

    def write():
        product = CatalogueProduct.objects.filter(pk=product_id).first()
        if not product:
            return
        # A renamed model must not leave its old row behind, or the next
        # Excel import would bring the old model back.
        if old_key and old_key != desktop_excel.product_key(product.model_no, product.gem_product_id):
            desktop_excel.remove_products([old_key])
        desktop_excel.save_product(product)

    transaction.on_commit(write)


@receiver(post_delete, sender=CatalogueProduct, dispatch_uid="desktop_excel_delete")
def mirror_deleted_product(sender, instance, **kwargs):
    if desktop_excel.is_paused() or not desktop_excel.is_desktop(instance):
        return
    key = desktop_excel.product_key(instance.model_no, instance.gem_product_id)
    transaction.on_commit(lambda: desktop_excel.remove_products([key]))
