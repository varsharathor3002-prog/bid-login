import json, os, re, shutil, time
from django.conf import settings
from django.db import connection, models
from django.http import JsonResponse
from django.test import RequestFactory
from django.views.decorators.csrf import csrf_exempt
from ..models import User, CatalogueProduct
# Pure text/scoring helpers, reused as-is (same pattern AIO/Workstation use)
# so Toner's model search behaves the same way as every other product line.
from .Desktop import _match_is_blank, _values_overlap_score, _catalogue_values_for_keys, _catalogue_extra_specs
from django.db import IntegrityError, transaction

# Everything imported here from Aio.py is generic to any Acxxel bid — the
# recipient-block/tender-no fill, the MAF body (already lists "Printer
# Toner" as one of Acxxel's own OEM product lines), the Service & Support
# escalation table/availability paragraph, page-numbering, and small PDF
# text-layout utilities. None of it mentions "All in One PC" specifically,
# so it's reused unchanged rather than re-written here. Only the pieces that
# actually hardcode AIO's product name (warranty/make-in-india paragraphs,
# the on-site note, and the technical-compliance/data-sheet tables) get
# Toner-specific twins further down.
from .Aio import (
    _fill_recipient_block, _erase_tender, _force_tender_no_date, _replace_bidder_financial_heading,
    _add_aio_page_numbers as _add_page_numbers, _fill_manufacturer_auth_body,
    _fill_service_support_escalation, _add_service_support_bid_date, _add_service_support_last_page_bid_date,
    _format_aio_service_center_heading as _format_service_center_heading,
    _add_aio_service_support_table_note as _add_service_support_table_note,
    _fill_service_support_availability, _format_model_number, _normalize_warranty_text,
    _shrink_for_cell, _get_cell_bg_color, _text_width, _draw_inline_paragraph, _add_authorized_signatory,
)

# Same to same as AioBid (Aio.py) — Config-step fields swapped for Toner's
# own (brand/cartridge_type/... instead of processor/ram/...), everything
# else (model number split, documents, review workflow, GeM columns) copied
# field-for-field so Toner can grow through the same lifecycle AIO already has.
class TonerBid(models.Model):
    user=models.ForeignKey(User,null=True,blank=True,on_delete=models.SET_NULL); username=models.CharField(max_length=150,blank=True,default="")
    bid_no=models.CharField(max_length=150); dept_name=models.CharField(max_length=255,blank=True,default=""); organization=models.CharField(max_length=255,blank=True,default="")
    model_no=models.CharField(max_length=50,blank=True,default="AXL-TNR000-"); model=models.CharField(max_length=100,blank=True,default="")
    qty=models.PositiveIntegerField(default=1); date=models.DateField(null=True,blank=True)
    atc=models.TextField(blank=True,default=""); address=models.TextField(blank=True,default=""); pincode=models.CharField(max_length=20,blank=True,default="")
    # ---- Config step fields ----
    brand=models.CharField(max_length=100,blank=True,default=""); cartridge_type=models.CharField(max_length=100,blank=True,default=""); product_class=models.CharField(max_length=20,blank=True,default="")
    colour=models.CharField(max_length=50,blank=True,default="")
    compatibility=models.TextField(blank=True,default=""); technology=models.CharField(max_length=50,blank=True,default="")
    cartridge_quality=models.CharField(max_length=50,blank=True,default=""); page_yield=models.CharField(max_length=50,blank=True,default="")
    yield_standard=models.CharField(max_length=100,blank=True,default=""); toner_capacity=models.CharField(max_length=50,blank=True,default="")
    yield_type=models.CharField(max_length=50,blank=True,default=""); drum=models.CharField(max_length=50,blank=True,default="")
    chip=models.CharField(max_length=50,blank=True,default=""); print_coverage=models.CharField(max_length=50,blank=True,default="")
    packaging=models.CharField(max_length=50,blank=True,default=""); shelf_life=models.CharField(max_length=50,blank=True,default="")
    warranty=models.CharField(max_length=50,blank=True,default=""); warranty_type=models.CharField(max_length=50,blank=True,default="")
    oem_equivalent=models.CharField(max_length=10,blank=True,default=""); refillable=models.CharField(max_length=10,blank=True,default="")
    qty_per_pack=models.CharField(max_length=20,blank=True,default=""); hsn_code=models.CharField(max_length=50,blank=True,default="")
    compliance=models.CharField(max_length=100,blank=True,default=""); replacement_policy=models.CharField(max_length=50,blank=True,default="")
    # Admin-only field (no Config-step input, same as AIO's local_content) —
    # only editable from TonerBidApproval.jsx, needed for the Make in India cert.
    local_content=models.CharField(max_length=20,blank=True,default="")
    unit_price=models.DecimalField(max_digits=12,decimal_places=2,default=0); total_price=models.DecimalField(max_digits=14,decimal_places=2,default=0)
    # ---- Documents step + review workflow (same shape as AioBid) ----
    upload_document=models.FileField(upload_to="toner_bid_documents/",null=True,blank=True); atc_special_document=models.FileField(upload_to="toner_bid_documents/special/",null=True,blank=True)
    selected_general_docs=models.TextField(blank=True,default="[]"); verified_fields=models.TextField(blank=True,default="[]"); status=models.CharField(max_length=30,default="draft")
    analyser_username=models.CharField(max_length=150,blank=True,default=""); analyser_note=models.TextField(blank=True,default=""); admin_username=models.CharField(max_length=150,blank=True,default=""); admin_note=models.TextField(blank=True,default="")
    # Same fields as AioBid/DesktopBid's own gem_* columns.
    gem_status=models.CharField(max_length=30,default="not_started"); gem_account=models.CharField(max_length=100,blank=True,null=True)
    gem_product_id=models.CharField(max_length=255,blank=True,null=True); gem_product_url=models.URLField(max_length=1000,blank=True,null=True)
    gem_error=models.TextField(blank=True,null=True); gem_uploaded_at=models.DateTimeField(blank=True,null=True)
    created_at=models.DateTimeField(auto_now_add=True); updated_at=models.DateTimeField(auto_now=True)
    class Meta: app_label="accounts"; db_table="accounts_tonerbid"; ordering=["-created_at"]

class TonerGemUploadJob(models.Model):
    STATUS_CHOICES=[("queued","Queued"),("ready_for_fill","Ready for extension fill"),("filled","Filled in GeM"),("retrying","Retrying"),("submitted","Submitted"),("published","Published"),("rejected","Rejected"),("failed","Failed"),("cancelled","Cancelled")]
    bid=models.ForeignKey(TonerBid,on_delete=models.CASCADE,related_name="gem_upload_jobs")
    triggered_by=models.ForeignKey(User,on_delete=models.SET_NULL,null=True,blank=True,related_name="triggered_toner_gem_upload_jobs")
    status=models.CharField(max_length=30,choices=STATUS_CHOICES,default="queued")
    progress=models.CharField(max_length=255,default="Waiting for worker")
    error=models.TextField(blank=True,default=""); rejection_reason=models.TextField(blank=True,default="")
    attempts=models.PositiveIntegerField(default=0); max_attempts=models.PositiveIntegerField(default=3); next_attempt_at=models.DateTimeField(blank=True,null=True)
    gem_product_id=models.CharField(max_length=255,blank=True,default=""); gem_product_url=models.URLField(max_length=1000,blank=True,default="")
    payload_snapshot=models.JSONField(default=dict,blank=True)
    created_at=models.DateTimeField(auto_now_add=True); started_at=models.DateTimeField(blank=True,null=True)
    submitted_at=models.DateTimeField(blank=True,null=True); completed_at=models.DateTimeField(blank=True,null=True); updated_at=models.DateTimeField(auto_now=True)
    class Meta: app_label="accounts"; db_table="accounts_tonergemuploadjob"; ordering=["-created_at"]
    def __str__(self):return f"Toner GeM job {self.id}: {self.bid.bid_no}"

class TonerGemAuditLog(models.Model):
    job=models.ForeignKey(TonerGemUploadJob,on_delete=models.CASCADE,related_name="audit_logs")
    actor=models.ForeignKey(User,on_delete=models.SET_NULL,null=True,blank=True)
    event=models.CharField(max_length=100); message=models.TextField(blank=True,default=""); metadata=models.JSONField(default=dict,blank=True)
    created_at=models.DateTimeField(auto_now_add=True)
    class Meta: app_label="accounts"; db_table="accounts_tonergemauditlog"; ordering=["-created_at"]
    def __str__(self):return f"{self.job_id}: {self.event}"

FIELDS=["bid_no","dept_name","organization","model_no","model","qty","date","atc","address","pincode",
    "brand","cartridge_type","product_class","colour","compatibility","technology","cartridge_quality","page_yield",
    "yield_standard","toner_capacity","yield_type","drum","chip","print_coverage","packaging","shelf_life",
    "warranty","warranty_type","oem_equivalent","refillable","qty_per_pack","hsn_code","compliance",
    "replacement_policy","unit_price","total_price","local_content"]
PRICES={"unit_price","total_price"}

# Same lazy-create-the-table approach as AIO's _ensure_table (Aio.py) — no
# formal migration for these models, the schema is created/patched here at
# request time instead.
def _ensure_model_table(model):
    table=model._meta.db_table
    if table not in connection.introspection.table_names():
        with connection.schema_editor() as e:e.create_model(model)
        return
    with connection.cursor() as c: existing={x.name for x in connection.introspection.get_table_description(c,table)}
    with connection.schema_editor() as e:
        for f in model._meta.local_fields:
            if f.column not in existing:e.add_field(model,f)
def _ensure_table():
    _ensure_model_table(TonerBid)
def _ensure_gem_tables():
    _ensure_model_table(TonerGemUploadJob);_ensure_model_table(TonerGemAuditLog)

def _data(r):
    if "application/json" in (r.content_type or ""):
        try:return json.loads(r.body or "{}")
        except:return {}
    return r.POST

def _assign(b,d):
    for n in FIELDS:
        if n not in d:continue
        v=d.get(n)
        if n=="qty":
            try:v=max(1,int(v or 1))
            except:continue
        elif n in PRICES:v=0 if v in (None,"") else v
        setattr(b,n,v)

def _json(b,r=None):
    out={}
    for f in b._meta.concrete_fields:
        k=f.attname if isinstance(f,models.ForeignKey) else f.name; v=getattr(b,k)
        if isinstance(f,models.FileField):
            v=v.url if v else ""; v=r.build_absolute_uri(v) if v and r else v
        elif hasattr(v,"isoformat"):v=v.isoformat()
        elif v is not None and f.get_internal_type()=="DecimalField":v=float(v)
        out[k]=v
    model_number=f"{b.model_no}{b.model}"
    # Same signal as AIO's is_new_product: a model number auto-created off
    # this bid (via save_toner_model_number, not from an imported catalogue)
    # still needs manual GeM catalogue creation — surfaced on the Analyser's
    # "Transfer Catalogue to GeM" tab.
    is_new_product=False
    if model_number:
        cp=CatalogueProduct.objects.filter(model_no__iexact=model_number,category="toner").first()
        if cp:is_new_product=_catalogue_extra_specs(cp).get("_source")=="toner_bid"
    out.update(model_number=model_number,submitted_by=b.username,user_name=b.username,is_new_product=is_new_product)
    return out

@csrf_exempt
def create_toner_bid(r):
    if r.method!="POST":return JsonResponse({"error":"POST required"},status=405)
    _ensure_table();d=_data(r)
    if not d.get("bid_no"):return JsonResponse({"error":"Bid number is required"},status=400)
    b=TonerBid(user=User.objects.filter(id=d.get("user_id")).first(),username=d.get("username",""),bid_no=d["bid_no"]);_assign(b,d);b.save()
    return JsonResponse({"message":"Toner bid created","bid_id":b.id},status=201)

@csrf_exempt
def update_toner_bid(r,bid_id):
    if r.method not in ("POST","PUT","PATCH"):return JsonResponse({"error":"POST, PUT or PATCH required"},status=405)
    _ensure_table();b=TonerBid.objects.filter(id=bid_id).first()
    if not b:return JsonResponse({"error":"Toner bid not found"},status=404)
    _assign(b,_data(r)); b.upload_document=r.FILES.get("upload_document",b.upload_document); b.status="submitted";b.save()
    return JsonResponse({"message":"Toner bid saved","bid":_json(b,r)})

def list_toner_bids(r):
    _ensure_table();q=TonerBid.objects.all();s=r.GET.get("status");role=r.GET.get("role")
    if role=="admin":
        db_status={"pending":["analyzed"],"re-analyze":["rejected","re-analyze"],"approved":["approved"]}.get(s,["analyzed"])
        q=q.filter(status__in=db_status)
    elif s=="pending":q=q.filter(status__in=["submitted","complete"])
    elif s=="approved":q=q.filter(status="approved")
    elif s=="re-analyze":q=q.filter(status__in=["rejected","re-analyze"])
    elif role=="analyser":q=q.exclude(status="draft")
    rows=[_json(x,r) for x in q]
    if s:
        for x in rows:
            if s in ("pending","re-analyze"):x["status"]=s
        return JsonResponse(rows,safe=False)
    return JsonResponse({"bids":rows})

def get_toner_bid(r,bid_id):
    _ensure_table();b=TonerBid.objects.filter(id=bid_id).first();return JsonResponse(_json(b,r) if b else {"error":"Toner bid not found"},status=200 if b else 404)

@csrf_exempt
def review_toner_bid(r,bid_id):
    if r.method not in ("POST","PATCH"):return JsonResponse({"error":"POST or PATCH required"},status=405)
    _ensure_table();b=TonerBid.objects.filter(id=bid_id).first()
    if not b:return JsonResponse({"error":"Toner bid not found"},status=404)
    d=_data(r);s="analyzed" if d.get("status")=="reviewed" else d.get("status")
    if s not in ("analyzed","rejected","re-analyze"):return JsonResponse({"error":"Invalid analyser status"},status=400)
    # model_no/model are only ever meant to change via save_toner_model_number
    # — same stale-payload wipe risk as AIO's review_aio_bid, guarded the same way.
    saved_model_no,saved_model=b.model_no,b.model
    _assign(b,d);b.model_no,b.model=saved_model_no,saved_model
    b.verified_fields=json.dumps(d.get("verified_fields",[]));b.status=s;b.analyser_note=d.get("analyser_note","");b.analyser_username=d.get("analyser_username","");b.save();return JsonResponse({"message":"Analyser review saved","bid":_json(b,r)})

@csrf_exempt
def admin_review_toner_bid(r,bid_id):
    if r.method!="POST":return JsonResponse({"error":"POST required"},status=405)
    _ensure_table();b=TonerBid.objects.filter(id=bid_id).first();d=_data(r)
    if not b:return JsonResponse({"error":"Toner bid not found"},status=404)
    status=d.get("status")
    if status not in ("approved","rejected","re-analyze"):return JsonResponse({"error":"Invalid admin status"},status=400)
    if status=="approved":
        local_content=str(d.get("local_content") or "").strip().rstrip("%")
        if not local_content:return JsonResponse({"error":"Local Content (%) is mandatory."},status=400)
        try:local_content_number=float(local_content)
        except (TypeError,ValueError):return JsonResponse({"error":"Local Content must be a valid number."},status=400)
        if local_content_number<0 or local_content_number>100:return JsonResponse({"error":"Local Content must be between 0 and 100."},status=400)
        try:total_price=float(d.get("total_price") or 0)
        except (TypeError,ValueError):total_price=0
        if total_price<=0:
            return JsonResponse({"error":"Bid Approved Price is mandatory and must be greater than 0."},status=400)
    # model_no has no input field on the Admin form (only "model" is editable
    # there) — same preserve-across-payload guard as review_toner_bid, for
    # the other half of the split field.
    saved_model_no=b.model_no
    _assign(b,d);b.model_no=saved_model_no
    if "total_price" in d:
        try:b.total_price=float(d.get("total_price") or 0)
        except (TypeError,ValueError):pass
    b.status=status;b.admin_note=d.get("admin_note","");b.admin_username=d.get("admin_username","");b.save()
    return JsonResponse({"message":"Admin review saved","bid":_json(b,r)})

@csrf_exempt
def delete_toner_bid(r,bid_id):
    from .bid_cleanup import delete_bid_with_related_data
    # Also ensure the GeM job tables exist before deleting — TonerBid.delete()
    # cascades through TonerGemUploadJob's FK, and Django's cascade collector
    # queries that table even when no GeM job was ever created for this bid,
    # which errors out if the lazily-created table doesn't exist yet.
    _ensure_table();_ensure_gem_tables();bid=TonerBid.objects.filter(id=bid_id).first()
    if not bid:return JsonResponse({"error":"Toner bid not found"},status=404)
    delete_bid_with_related_data(bid,"toner")
    return JsonResponse({"message":"Toner bid and related data deleted"})

# ---- Analyser's Catalogue Products page: same pattern as
# list_aio_catalogue_products (Aio.py) — hands back raw extra_specs instead
# of routing through Desktop's list_catalogue_products (which drops any
# spec key not on Desktop's own fixed field list).
def list_toner_catalogue_products(r):
    search=(r.GET.get("search") or "").strip().lower()
    products=[]
    for cp in CatalogueProduct.objects.filter(category__iexact="toner").order_by("-created_at"):
        extra_specs=_catalogue_extra_specs(cp)
        product={
            "id":f"toner-catalogue-{cp.id}","catalogue_id":cp.id,"model_no":cp.model_no or "",
            "category":cp.category or "toner",
            "brand":extra_specs.get("Brand",""),"cartridge_type":extra_specs.get("Cartridge Type",""),
            "product_class":extra_specs.get("Product Class",""),"colour":extra_specs.get("Colour",""),
            "technology":extra_specs.get("Technology",""),"page_yield":extra_specs.get("Page Yield",""),
            "yield_standard":extra_specs.get("Yield Standard",""),"compatibility":extra_specs.get("Compatibility",""),
            "description":cp.description or "Toner Cartridge",
            "extra_specs":extra_specs,"source":"catalogue",
        }
        products.append(product)
    if search:
        products=[p for p in products if search in p["model_no"].lower() or search in p["description"].lower()]
    return JsonResponse(products,safe=False,status=200)

# ---- Catalogue model matching ("Find Model"), same approach as AIO but
# scoped to Toner's own catalogue category. Toner has no direct-column
# equivalents on CatalogueProduct (no processor/ram/storage/os concept), so
# every field is compared purely against extra_specs — no special-casing
# needed the way AIO's screen_size/keyboard/ssd matching requires.
TONER_CATALOGUE_FIELD_MAP={
    "brand":["Brand"],"cartridge_type":["Cartridge Type"],"colour":["Colour"],
    "technology":["Technology"],"page_yield":["Page Yield"],"yield_standard":["Yield Standard"],
}
MIN_STRONG_MATCH_FIELDS_TONER=4

def _best_catalogue_match_toner(bid_key,bid_value,product,catalogue_keys):
    if _match_is_blank(bid_value):return None,"","",-1
    candidates=_catalogue_values_for_keys(product,catalogue_keys)
    if not candidates:return False,"","",-1
    best_key=best_value="";best_score=-1
    for key_label,value in candidates:
        score=_values_overlap_score(bid_value,value)
        if score>best_score:best_score,best_key,best_value=score,key_label,value
    return best_score>=100,best_key,best_value,best_score

def _score_fields_toner(bid_specs,scorer):
    matched_count=checked_count=0;total_score=0
    for bid_key in TONER_CATALOGUE_FIELD_MAP:
        bid_value=bid_specs.get(bid_key,"")
        if _match_is_blank(bid_value):continue
        matched,_,_,best_score=scorer(bid_key,bid_value)
        checked_count+=1
        if matched:matched_count+=1;total_score+=max(float(best_score or 0),0)
        else:total_score+=max(float(best_score or 0),0)*0.25
    return matched_count,checked_count,round(total_score,2)

@csrf_exempt
def match_toner_catalogue_models(r,bid_id):
    if r.method!="POST":return JsonResponse({"error":"POST required"},status=405)
    _ensure_table();b=TonerBid.objects.filter(id=bid_id).first()
    if not b:return JsonResponse({"error":"Toner bid not found"},status=404)
    body=_data(r)
    bid_specs={k:str((body.get(k) if body.get(k) not in (None,"") else getattr(b,k,"")) or "").strip() for k in TONER_CATALOGUE_FIELD_MAP}

    results=[]
    for product in CatalogueProduct.objects.filter(category="toner"):
        matched_count,checked_count,total_score=_score_fields_toner(
            bid_specs,lambda k,v,p=product:_best_catalogue_match_toner(k,v,p,TONER_CATALOGUE_FIELD_MAP[k])
        )
        if checked_count==0:continue
        is_perfect=checked_count>=MIN_STRONG_MATCH_FIELDS_TONER and matched_count==checked_count
        results.append({"model_no":product.model_no or "","product_id":product.id,"bid_id":None,"source":"catalogue","match_count":matched_count,"total_checked":checked_count,"total_score":total_score,"is_perfect":is_perfect})

    other_bids=TonerBid.objects.exclude(id=b.id).exclude(model="").exclude(model__isnull=True)
    for other in other_bids:
        def _other_scorer(k,v,o=other):
            ov=str(getattr(o,k,"") or "")
            if _match_is_blank(ov):return False,"","",-1
            score=_values_overlap_score(v,ov)
            return score>=100,k,ov,score
        matched_count,checked_count,total_score=_score_fields_toner(bid_specs,_other_scorer)
        if checked_count==0:continue
        is_perfect=checked_count>=MIN_STRONG_MATCH_FIELDS_TONER and matched_count==checked_count
        results.append({"model_no":f"{other.model_no}{other.model}","product_id":None,"bid_id":other.id,"source":"bid","match_count":matched_count,"total_checked":checked_count,"total_score":total_score,"is_perfect":is_perfect})

    perfect=[x for x in results if x["is_perfect"]]
    perfect.sort(key=lambda x:(-x["match_count"],-x["total_score"],x["model_no"]))
    if perfect:
        best=perfect[0]
        return JsonResponse({"match":{"model_no":best["model_no"],"product_id":best.get("product_id"),"bid_id":best.get("bid_id"),"category":"toner"},"matches":[best]})
    return JsonResponse({"match":None,"matches":[]})

@csrf_exempt
def save_toner_model_number(r,bid_id):
    if r.method!="POST":return JsonResponse({"error":"POST required"},status=405)
    _ensure_table();b=TonerBid.objects.filter(id=bid_id).first()
    if not b:return JsonResponse({"error":"Toner bid not found"},status=404)
    d=_data(r)
    model_number=str(d.get("model_number") or d.get("model") or d.get("model_no") or d.get("modelNo") or "").strip().upper()
    if not model_number:return JsonResponse({"error":"Model number required"},status=400)
    b.model_no="";b.model=model_number;b.save()
    # Same to same as AIO's save_aio_model_number: auto-create a catalogue
    # entry tagged "_source":"toner_bid" if this model isn't already one, so
    # it surfaces under the Analyser's "Transfer Catalogue to GeM" tab.
    extra_specs={
        "_source":"toner_bid","Product Type":"Toner Cartridge",
        "Brand":b.brand or "","Cartridge Type":b.cartridge_type or "","Product Class":b.product_class or "",
        "Colour":b.colour or "","Technology":b.technology or "","Compatibility":b.compatibility or "",
        "Page Yield":b.page_yield or "","Yield Standard":b.yield_standard or "",
        "Chip":b.chip or "","Print Coverage":b.print_coverage or "","Warranty":b.warranty or "",
    }
    try:
        with transaction.atomic():
            cp=CatalogueProduct.objects.filter(model_no__iexact=model_number).first()
            if cp is None:
                try:
                    with transaction.atomic():
                        CatalogueProduct.objects.create(model_no=model_number,category="toner",description="Toner Cartridge",extra_specs=extra_specs)
                except IntegrityError:
                    pass
            else:
                existing=_catalogue_extra_specs(cp)
                if existing.get("_source")=="toner_bid":
                    existing.update(extra_specs)
                    cp.category="toner";cp.extra_specs=existing
                    cp.save(update_fields=["category","extra_specs","updated_at"])
    except Exception:
        pass
    return JsonResponse({"success":True,"bid_id":b.id,"model_number":model_number,"model":model_number})

@csrf_exempt
def update_toner_docs(r,bid_id):
    if r.method!="POST":return JsonResponse({"error":"POST required"},status=405)
    _ensure_table();b=TonerBid.objects.filter(id=bid_id).first()
    if not b:return JsonResponse({"error":"Toner bid not found"},status=404)
    b.atc_special_document=r.FILES.get("atc_special_document",b.atc_special_document);b.selected_general_docs=r.POST.get("selected_general_docs","[]");b.status="complete";b.save()
    from .GemAssignments import complete_user_assignment_for_bid
    complete_user_assignment_for_bid(b.bid_no,b.user)
    return JsonResponse({"message":"Toner documents saved successfully","bid":_json(b,r)})

# These narrative certificate pages are shared with Desktop/AIO's own
# template and default to "desktop computer"/AIO phrasing in a few plain-text
# sentences — swap that to Toner's actual product name.
_TONER_WORDING_FIXES=[
    (re.compile(r'\bAcxxel\s+Desktops\b',re.I),'Acxxel Toner Cartridges'),
    (re.compile(r'\bdesktop\s+computer\b',re.I),'Toner Cartridge'),
    (re.compile(r'\bSince\s+desktop\s+has\b',re.I),'Since Toner Cartridge has'),
    (re.compile(r'\bACXXEL\b'),'acxxel'),
    (re.compile(r'\bAcxxel\b'),'acxxel'),
    # Non-Obsolete certificate's residual-market-life guarantee — only appears
    # on that one page in the template.
    (re.compile(r'\b3\s*\(Three\)',re.I),'5 (Five)'),
    # Service Support certificate's escalation-matrix intro line — only
    # appears on that one page in the template.
    (re.compile(r'\bEscalation matrix below reference\s*:',re.I),'Escalation matrix for service support is as follows:'),
]
def _fix_toner_product_wording(page,fitz):
    edits=[]
    for block in page.get_text("dict").get("blocks",[]):
        for line in block.get("lines",[]):
            for span in line.get("spans",[]):
                text=span.get("text","")
                if not text.strip():continue
                new_text=text
                for pat,repl in _TONER_WORDING_FIXES:new_text=pat.sub(repl,new_text)
                if new_text!=text:
                    is_bold=bool(span.get("flags",0)&16)
                    edits.append((fitz.Rect(span["bbox"]),text,new_text,span.get("size",10.5),is_bold))
    if not edits:return
    for rect,old_text,new_text,size,is_bold in edits:
        extra=max(0,len(new_text)-len(old_text))*size*0.6
        redact_rect=fitz.Rect(rect.x0,rect.y0,min(page.rect.width-36,rect.x1+extra),rect.y1)
        bg=(1,1,1)
        try:
            for dwg in page.get_drawings():
                if not dwg.get("fill"):continue
                drect=fitz.Rect(dwg["rect"])
                if drect.get_area()<=100 or not drect.intersects(redact_rect):continue
                fill=dwg["fill"]
                if fill and len(fill)>=3 and not (fill[0]>0.97 and fill[1]>0.97 and fill[2]>0.97):
                    bg=fill;break
        except Exception:pass
        page.add_redact_annot(redact_rect,fill=bg)
    page.apply_redactions()
    for rect,old_text,new_text,size,is_bold in edits:
        page.insert_text((rect.x0,rect.y1-2),new_text,fontsize=size,fontname="hebo" if is_bold else "helv",color=(0,0,0))

def _fix_toner_service_support_onsite_note(page,fitz):
    # Same idea as AIO's _fix_aio_service_support_onsite_note — the intro
    # line under "TO WHOMSOEVER IT MAY CONCERN" still reads with the
    # template's product wording after _fix_toner_product_wording's
    # word-level swap; replace the whole sentence with Toner's own wording.
    lines=[]
    for block in page.get_text("dict").get("blocks",[]):
        if block.get("type")!=0:continue
        for line in block.get("lines",[]):
            text=" ".join(s.get("text","") for s in line.get("spans",[])).strip()
            if text:lines.append((fitz.Rect(line["bbox"]),text))
    lines.sort(key=lambda item:item[0].y0)
    start_idx=next((i for i,(_,t) in enumerate(lines) if re.search(r"this\s+is\s+certifying",t,re.I)),None)
    if start_idx is None:return
    end_idx=start_idx
    for i in range(start_idx,min(start_idx+3,len(lines))):
        end_idx=i
        if re.search(r"\bdocument\.?\s*$",lines[i][1],re.I):break
    region_rects=[lines[i][0] for i in range(start_idx,end_idx+1)]
    region=fitz.Rect(
        min(r.x0 for r in region_rects)-2,region_rects[0].y0-2,
        page.rect.width-36,region_rects[-1].y1+3,
    )
    page.add_redact_annot(region,fill=(1,1,1))
    page.apply_redactions(images=0,graphics=0)
    page.insert_textbox(
        fitz.Rect(region.x0,region.y0+1,region.x1,region.y1+24),
        "This is to certify that the acxxel Toner Cartridge offered in the bid carries an on-site "
        "warranty as per the terms and conditions of the bid document.",
        fontsize=10.5,fontname="helv",color=(0,0,0),align=0,lineheight=1.15,
    )

def _fill_toner_warranty_page(page,fitz,bid_no,model_number,warranty_text):
    page_text=page.get_text("text")
    for m in re.finditer(r"For\s+warranty\s+confirmation\s+visit[^\n]*",page_text,re.I):
        for area in page.search_for(m.group(0)):
            page.add_redact_annot(fitz.Rect(area.x0-2,area.y0-2,page.rect.width-36,area.y1+2),fill=(1,1,1))
    url_patterns=[r"https?://[^\s]+",r"www\.[^\s]+",r"[a-zA-Z0-9-]+\.html[^\s]*",r"[a-zA-Z0-9-]+#variant_id=[^\s]+",r"mkp\.gem\.gov\.in[^\s]*"]
    for pattern in url_patterns:
        for m in re.finditer(pattern,page_text,re.I):
            for area in page.search_for(m.group(0)):page.add_redact_annot(area,fill=(1,1,1))
    page.apply_redactions()

    formatted_model=_format_model_number(model_number) or "quoted model"
    normalized_warranty=_normalize_warranty_text(warranty_text) or "standard warranty"
    paragraph=(
        "This is to certify that Laps N Tabs Technology Pvt. Ltd. is the OEM of acxxel "
        f"Toner Cartridge Brand and will provide comprehensive warranty during entire standard "
        f"warranty period i.e. {normalized_warranty} for quoted acxxel Toner Cartridge "
        f"{formatted_model}, if the said bid award to us."
    )
    para_rect=fitz.Rect(82,314,page.rect.width-42,374)
    page.add_redact_annot(para_rect,fill=(1,1,1));page.apply_redactions()
    page.insert_textbox(para_rect,paragraph,fontsize=10.5,fontname="hebo",color=(0,0,0),align=0)

def _fill_toner_make_in_india_page(page,fitz,bid_no,model_number,dept_name,organization,full_address,bid_date_formatted,local_content):
    def _lines():
        out=[]
        for block in page.get_text("dict")["blocks"]:
            if block.get("type")!=0:continue
            for line in block.get("lines",[]):
                text=" ".join(s["text"] for s in line.get("spans",[]))
                out.append((line["bbox"],text.strip()))
        out.sort(key=lambda lx:lx[0][1]);return out

    all_lines=_lines()
    intro_start=intro_end=None
    for i,(bbox,text) in enumerate(all_lines):
        if "This is to certify" in text and intro_start is None:intro_start=i
        if intro_start is not None and ("content details are as below" in text.lower() or "local content details" in text.lower()):
            intro_end=i;break

    intro_region_y0=None
    if intro_start is not None and intro_end is not None:
        intro_lines=all_lines[intro_start:intro_end+1]
        region_x0=min(b[0] for b,t in intro_lines);region_y0=intro_lines[0][0][1]
        region_x1=page.rect.width-36;region_y1=intro_lines[-1][0][3]+6
        intro_region_y0=region_y0
        page.add_redact_annot(fitz.Rect(region_x0-2,region_y0-2,region_x1,region_y1),fill=(1,1,1));page.apply_redactions()

        formatted_model=_format_model_number(model_number)
        segments=[
            ("This is to certify that ",False),("acxxel Toner Cartridge ",True),
            (formatted_model+" ",True),("Quoted under ",False),("GeM Bid No. – ",True),
            ((bid_no if bid_no else "N/A")+" ",True),
            ("is getting manufactured in India. Local content details are as below:",False),
        ]
        _draw_inline_paragraph(page,region_x0,region_y0+11,17,region_x1-region_x0-4,segments,fitz,fontsize=11)

    page_text=page.get_text("text")
    for pattern in [r"https?://[^\s]+",r"www\.[^\s]+",r"[a-zA-Z0-9-]+\.html[^\s]*",r"[a-zA-Z0-9-]+#variant_id=[^\s]+",r"mkp\.gem\.gov\.in[^\s]*"]:
        for m in re.finditer(pattern,page_text,re.I):
            for area in page.search_for(m.group(0)):page.add_redact_annot(area,fill=(1,1,1))
    page.apply_redactions()

    all_lines2=_lines()
    config_link_idx=next((i for i,(b,t) in enumerate(all_lines2) if "config link" in t.lower()),None)
    if config_link_idx is not None:
        erase_rects=[fitz.Rect(*all_lines2[config_link_idx][0])]
        for j in range(config_link_idx+1,min(config_link_idx+8,len(all_lines2))):
            bbox_j,text_j=all_lines2[j]
            if text_j and (any(tok in text_j.lower() for tok in ["http","www",".com",".in",".html","variant_id","mkp"]) or re.match(r"^[a-zA-Z0-9\-_/#.:]+$",text_j)):
                erase_rects.append(fitz.Rect(*bbox_j))
            else:break
        for rect in erase_rects:page.add_redact_annot(rect,fill=(1,1,1))
        page.apply_redactions()

    all_lines3=_lines()
    to_idx=next((i for i,(b,t) in enumerate(all_lines3) if t=="To,"),None)
    mfg_block_bottom_y=None
    if to_idx is not None:
        table_start_idx=next((i for i in range(to_idx+1,len(all_lines3)) if "Sr. No." in all_lines3[i][1] or "Description" in all_lines3[i][1]),None)
        if table_start_idx is not None:
            mfg_start=mfg_end=None
            for i in range(to_idx+1,table_start_idx):
                bbox,text=all_lines3[i]
                if "Manufacturing" in text or "Laps N Tabs" in text:
                    if mfg_start is None:mfg_start=i
                    mfg_end=i
            address_lines=[]
            for i in range(to_idx+1,table_start_idx):
                bbox,text=all_lines3[i]
                if mfg_start is not None and mfg_start<=i<=mfg_end:continue
                if re.search(r"make\s*in\s*india\s*certificate",text,re.I):continue
                if intro_region_y0 is not None and bbox[1]>=intro_region_y0-1:continue
                if text and "Sr. No." not in text and "Description" not in text:address_lines.append((bbox,text,i))

            if len(address_lines)>=1 and dept_name:
                bbox=address_lines[0][0]
                page.add_redact_annot(fitz.Rect(bbox[0],bbox[1],page.rect.width-36,bbox[3]),fill=(1,1,1));page.apply_redactions()
                page.insert_text((bbox[0],bbox[1]+10),dept_name,fontsize=12,fontname="hebo",color=(0,0,0))
            if len(address_lines)>=2 and organization:
                bbox=address_lines[1][0]
                page.add_redact_annot(fitz.Rect(bbox[0],bbox[1],page.rect.width-36,bbox[3]),fill=(1,1,1));page.apply_redactions()
                page.insert_text((bbox[0],bbox[1]+10),organization,fontsize=12,fontname="hebo",color=(0,0,0))
            if len(address_lines)>=3 and full_address:
                for i in range(2,min(len(address_lines),8)):
                    bbox=address_lines[i][0]
                    page.add_redact_annot(fitz.Rect(bbox[0],bbox[1],page.rect.width-36,bbox[3]),fill=(1,1,1))
                page.apply_redactions()
                ax,ay=address_lines[2][0][0],address_lines[2][0][1]
                page.insert_textbox(fitz.Rect(ax,ay,page.rect.width-36,ay+100),full_address,fontsize=11.5,fontname="hebo",color=(0,0,0),align=0)
                if bid_no or bid_date_formatted:
                    page.insert_text((ax,ay+45),f"Bid No: {bid_no or ''} Dated: {bid_date_formatted or ''}",fontsize=10,fontname="hebo",color=(0,0,0))
            if mfg_start is not None:mfg_block_bottom_y=all_lines3[table_start_idx][0][1]

    min_table_y=mfg_block_bottom_y if mfg_block_bottom_y is not None else 0
    formatted_model=_format_model_number(model_number)
    all_lines_final=_lines()
    percent_cells=[(fitz.Rect(bbox),text) for bbox,text in all_lines_final
                   if re.fullmatch(r"\d{1,3}\s*%",text.strip()) and fitz.Rect(bbox).y0>=min_table_y]
    for pct_rect,pct_text in percent_cells:
        row_y=(pct_rect.y0+pct_rect.y1)/2
        desc_candidates=[(fitz.Rect(bbox),text) for bbox,text in all_lines_final
                         if fitz.Rect(bbox).y0>=min_table_y and abs((fitz.Rect(bbox).y0+fitz.Rect(bbox).y1)/2-row_y)<=10
                         and fitz.Rect(bbox).x1<=pct_rect.x0
                         and not re.fullmatch(r"\d+",text.strip())]
        desc_rect=max(desc_candidates,key=lambda item:item[0].x1-item[0].x0,default=(None,None))[0]

        if formatted_model and desc_rect is not None:
            shrunk=_shrink_for_cell(desc_rect,fitz);cell_bg=_get_cell_bg_color(page,shrunk,fitz)
            page.add_redact_annot(shrunk,fill=cell_bg);page.apply_redactions()
            page.insert_text((desc_rect.x0+2,(desc_rect.y0+desc_rect.y1)/2+4),formatted_model,fontsize=9,fontname="hebo",color=(0,0,0))
        if local_content:
            shrunk=_shrink_for_cell(pct_rect,fitz);cell_bg=_get_cell_bg_color(page,shrunk,fitz)
            page.add_redact_annot(shrunk,fill=cell_bg);page.apply_redactions()
            lc=local_content if str(local_content).endswith("%") else f"{local_content}%"
            page.insert_text((pct_rect.x0+2,(pct_rect.y0+pct_rect.y1)/2+4),lc,fontsize=9,fontname="hebo",color=(0,0,0))

    if formatted_model:
        for bbox,text in _lines():
            if re.search(r"ACXXEL",text,re.I) and re.search(r"MODEL",text,re.I) and fitz.Rect(bbox).y0>=min_table_y:
                area=fitz.Rect(bbox)
                page.add_redact_annot(fitz.Rect(area.x0-1,area.y0-1,page.rect.width-36,area.y1+1),fill=(1,1,1))
                page.apply_redactions()
                page.insert_text((area.x0,area.y1-2),f"acxxel TONER CARTRIDGE MODEL {formatted_model}",fontsize=10.5,fontname="hebo",color=(0,0,0))
                break

# --- Technical Compliance Certificate / Product Data Sheet -----------------
# Same as AIO's own versions (Aio.py): drawn entirely from code onto blank
# pages (only the header banner image is reused from the shared template),
# so nothing here is locked to AIO's hardware fields — every row here comes
# from Toner's own captured spec fields (brand/cartridge_type/colour/...).
# "Allowed Values" columns reuse the exact same option vocabulary offered at
# the Config step (TonerConfig.jsx), same as AIO reusing its own dropdown lists.
_TC_BRAND_ALLOWED="HP | Canon | Brother | Epson | Samsung | Xerox | Ricoh | Kyocera | Acxxel | Nargle"
_TC_CARTRIDGE_TYPE_ALLOWED="Toner Cartridge | Laser Toner | Colour Toner"
_TC_PRODUCT_CLASS_ALLOWED="OEM | Compatible"
_TC_COLOUR_ALLOWED="Black | Cyan | Magenta | Yellow | All Colour"
_TC_TECHNOLOGY_ALLOWED="Laser"
_TC_PAGE_YIELD_ALLOWED="1,000 to 10,000 Pages | 30,000 Pages | 30,000+ Pages"
_TC_YIELD_STANDARD_ALLOWED="ISO/IEC 19752 | ISO/IEC 19798 | Manufacturer Rated"
_TC_CHIP_ALLOWED="With Chip | Without Chip"
_TC_PRINT_COVERAGE_ALLOWED="5%"
_TC_WARRANTY_ALLOWED="6 Months | 1-5 Years"
_TC_WARRANTY_TYPE_ALLOWED="Manufacturer Warranty | Seller Warranty | Replacement | On-site | Carry-in"
_TC_REFILLABLE_ALLOWED="Yes | No"
_TC_REPLACEMENT_POLICY_ALLOWED="7 / 15 / 30 Days | Defective Replacement"

def _fill_toner_technical_compliance_page1(page,fitz,bid_no,b):
    heading="Technical Compliance Certificate";hw=fitz.get_text_length(heading,fontname="hebo",fontsize=14)
    page.insert_text(((page.rect.width-hw)/2,122),heading,fontsize=14,fontname="hebo",color=(0,0,0))
    if bid_no:
        bt=f"Bid No: {bid_no}";bw=fitz.get_text_length(bt,fontname="hebo",fontsize=9)
        page.insert_text(((page.rect.width-bw)/2,143),bt,fontsize=9,fontname="hebo",color=(0.2,0.2,0.2))
    columns=[52,115,220,395,543];header_top,header_bottom=160,190;headers=["Specification","Title","Allowed Values","Offered"]
    for i,h in enumerate(headers):
        rect=fitz.Rect(columns[i],header_top,columns[i+1],header_bottom)
        page.draw_rect(rect,color=(0.35,0.35,0.35),fill=(0.92,0.94,0.97),width=0.7)
        page.insert_textbox(rect+(5,8,-4,-3),h,fontsize=8.5,fontname="hebo",color=(0,0,0))
    model_number=_format_model_number(f"{b.model_no}{b.model}".strip())
    description=f"{(b.product_class or '').strip()} {(b.cartridge_type or 'Toner Cartridge').strip()}".strip()
    if model_number and model_number not in description:description=f"{description} Model: {model_number}".strip()
    rows=[
        (190,240,"Description of Store","Toner Cartridge / Laser Toner / Colour Toner as per Buyer requirement",description,8.0),
        (240,286,"Brand",_TC_BRAND_ALLOWED,b.brand,7.6),
        (286,332,"Cartridge Type",_TC_CARTRIDGE_TYPE_ALLOWED,b.cartridge_type,8.3),
        (332,378,"Product Class",_TC_PRODUCT_CLASS_ALLOWED,b.product_class,8.3),
        (378,424,"Colour",_TC_COLOUR_ALLOWED,b.colour,8.3),
        (424,470,"Technology",_TC_TECHNOLOGY_ALLOWED,b.technology,8.3),
        (470,560,"Compatibility","Compatible Printer / MFP Models or Series as declared by bidder",b.compatibility,7.4),
    ]
    groups=[("DESCRIPTION",190,240),("BRAND",240,286),("CARTRIDGE",286,378),("COLOUR &\nTECHNOLOGY",378,470),("COMPATIBILITY",470,560)]
    for g,top,bottom in groups:
        rect=fitz.Rect(columns[0],top,columns[1],bottom)
        page.draw_rect(rect,color=(0.45,0.45,0.45),width=0.65)
        page.insert_textbox(rect+(5,8,-5,-5),g,fontsize=6.8,fontname="hebo",color=(0,0,0))
    for top,bottom,title,allowed,offered,afs in rows:
        for idx,val in enumerate([title,allowed,offered],start=1):
            rect=fitz.Rect(columns[idx],top,columns[idx+1],bottom)
            page.draw_rect(rect,color=(0.45,0.45,0.45),width=0.65)
            page.insert_textbox(rect+(5,8,-5,-5),str(val or ""),fontsize=afs if idx==2 else 8.3,fontname="helv",color=(0,0,0),align=0)

def _fill_toner_technical_compliance_page2(page,fitz,b):
    heading="Technical Compliance Certificate";hw=fitz.get_text_length(heading,fontname="hebo",fontsize=14)
    page.insert_text(((page.rect.width-hw)/2,150),heading,fontsize=14,fontname="hebo",color=(0,0,0))
    columns=[52,115,220,395,543];header_top,header_bottom=178,208;headers=["Specification","Title","Allowed Values","Offered"]
    for i,h in enumerate(headers):
        rect=fitz.Rect(columns[i],header_top,columns[i+1],header_bottom)
        page.draw_rect(rect,color=(0.35,0.35,0.35),fill=(0.92,0.94,0.97),width=0.7)
        page.insert_textbox(rect+(5,8,-4,-3),h,fontsize=8.5,fontname="hebo",color=(0,0,0))
    rows=[
        (208,254,"PAGE YIELD","Print Yield",_TC_PAGE_YIELD_ALLOWED,b.page_yield),
        (254,300,"YIELD STANDARD","Print Yield Test Standard",_TC_YIELD_STANDARD_ALLOWED,b.yield_standard),
        (300,346,"CHIP","Smart Chip",_TC_CHIP_ALLOWED,b.chip),
        (346,392,"PRINT COVERAGE","Standard Test Coverage",_TC_PRINT_COVERAGE_ALLOWED,b.print_coverage),
        (392,438,"WARRANTY","On Site / Replacement Warranty",_TC_WARRANTY_ALLOWED,b.warranty),
        (438,484,"WARRANTY TYPE","Type of Warranty",_TC_WARRANTY_TYPE_ALLOWED,b.warranty_type),
        (484,530,"REFILLABLE","Refillable Cartridge",_TC_REFILLABLE_ALLOWED,b.refillable),
        (530,576,"REPLACEMENT","Replacement Policy",_TC_REPLACEMENT_POLICY_ALLOWED,b.replacement_policy),
    ]
    for top,bottom,spec,title,allowed,offered in rows:
        for idx,val in enumerate([spec,title,allowed,offered]):
            rect=fitz.Rect(columns[idx],top,columns[idx+1],bottom)
            page.draw_rect(rect,color=(0.45,0.45,0.45),width=0.65)
            page.insert_textbox(rect+(5,8,-5,-5),str(val or ""),fontsize=8.5 if idx!=2 else 8.0,fontname="hebo" if idx==0 else "helv",color=(0,0,0),align=0)

def _fill_toner_data_sheet_page(page,fitz,page_index,b):
    heading="Toner Cartridge Product Data Sheet";hw=fitz.get_text_length(heading,fontname="hebo",fontsize=14)
    page.insert_text(((page.rect.width-hw)/2,122),heading,fontsize=14,fontname="hebo",color=(0,0,0))
    model_number=_format_model_number(f"{b.model_no}{b.model}".strip())
    if page_index==0:
        sections=[
            ("PRODUCT DETAILS",[("Model Number",model_number),("Brand",b.brand),("Product Type","Toner Cartridge"),("Cartridge Type",b.cartridge_type),("Product Class",b.product_class)]),
            ("COMPATIBILITY",[("Colour",b.colour),("Technology",b.technology),("Compatibility",b.compatibility)]),
        ]
    else:
        sections=[
            ("PERFORMANCE",[("Page Yield",b.page_yield),("Yield Standard",b.yield_standard),("Chip",b.chip),("Print Coverage",b.print_coverage)]),
            ("COMMERCIAL",[("Warranty",b.warranty),("Warranty Type",b.warranty_type),("Refillable",b.refillable),("Replacement Policy",b.replacement_policy),("Qty per Pack",b.qty_per_pack),("HSN Code",b.hsn_code)]),
        ]
    left,split,right=52,255,543;y=160;section_height=24;row_height=22
    for title,rows in sections:
        section_rect=fitz.Rect(left,y,right,y+section_height)
        page.draw_rect(section_rect,color=(0.35,0.35,0.35),fill=(0.9,0.9,0.9),width=0.7)
        page.insert_textbox(section_rect+(7,6,-5,-3),title,fontsize=8.5,fontname="hebo",color=(0,0,0))
        y+=section_height
        for label,value in rows:
            label_rect=fitz.Rect(left,y,split,y+row_height);value_rect=fitz.Rect(split,y,right,y+row_height)
            page.draw_rect(label_rect,color=(0.55,0.55,0.55),fill=(0.97,0.97,0.97),width=0.55)
            page.draw_rect(value_rect,color=(0.55,0.55,0.55),width=0.55)
            page.insert_textbox(label_rect+(7,5,-5,-1),label,fontsize=7.6,fontname="hebo",color=(0.15,0.15,0.15))
            page.insert_textbox(value_rect+(7,5,-5,-1),str(value).strip() if value not in (None,"") else "Not Specified",fontsize=7.8,fontname="helv",color=(0,0,0))
            y+=row_height
        y+=3
    return y

@csrf_exempt
def generate_toner_documents(r,bid_id):
    if r.method!="POST":return JsonResponse({"error":"POST required"},status=405)
    _ensure_table();b=TonerBid.objects.filter(id=bid_id).first()
    if not b:return JsonResponse({"error":"Toner bid not found"},status=404)
    typ=_data(r).get("doc_type","");ranges={"manufacturer_auth":(2,4),"make_in_india":(5,5),"warranty":(6,6),"bidder_financial":(7,7),"non_obsolete":(8,8),"non_malicious":(16,16),"non_return_hdd":(17,17),"technical_compliance":(18,18),"non_blacklisting":(20,20),"ipv6":(21,21),"preloaded_os":(22,22),"service_support":(25,30),"data_sheet":(31,32)}
    static={"experience_certificate":"experience_certificate.pdf","past_performance":"past_performance.pdf","oem_annual_turnover":"oem_annual_turnover.pdf","atc_acceptance_letter":"atc_acceptance_letter.pdf"}
    # experience_certificate/past_performance use Acxxel's own real GeM
    # contract history export (Aioexp.pdf) — same file AIO points at, same
    # explicit reuse (the company's contract history is not product-specific).
    toner_static_overrides={"experience_certificate":"Aioexp.pdf","past_performance":"Aioexp.pdf"}
    if typ in ("approved_all_documents","approved_atc_documents") and b.status!="approved":
        return JsonResponse({"error":"Only approved bids can be downloaded"},status=403)
    try:
        import fitz
        out=os.path.join(settings.MEDIA_ROOT,"generated","toner");os.makedirs(out,exist_ok=True);name=f"toner_{b.id}_{typ}.pdf";path=os.path.join(out,name);date=b.date.strftime("%d-%m-%Y") if b.date else "";addr=f"{b.address} - {b.pincode}" if b.pincode else str(b.address or "")
        model_number=f"{b.model_no}{b.model}".strip()
        local_content=str(_data(r).get("local_content") or b.local_content or "").strip()
        if typ in static:
            src=(os.path.join(settings.MEDIA_ROOT,"templates",toner_static_overrides[typ]) if typ in toner_static_overrides
                 else os.path.join(settings.MEDIA_ROOT,"templates","static_documents",static[typ]))
            if typ!="atc_acceptance_letter":shutil.copyfile(src,path)
            else:
                d=fitz.open(src);p=d[0];p.add_redact_annot(fitz.Rect(65,96,535,235),fill=(1,1,1));p.apply_redactions();p.insert_textbox(fitz.Rect(72,102,525,235),"\n".join(["To,",b.dept_name,b.organization,str(b.address or ""),"",f"Bid No:- {b.bid_no}",f"Dated:- {date}"]),fontsize=10.5,fontname="hebo",lineheight=1.28);d.save(path);d.close()
        elif typ in ("warranty","make_in_india"):
            src=os.path.join(settings.MEDIA_ROOT,"templates","documents.pdf");m=fitz.open(src);d=fitz.open();start,end=ranges[typ];d.insert_pdf(m,from_page=start-1,to_page=end-1)
            p=d[0]
            if typ=="warranty":
                recipient_bottom=_fill_recipient_block(p,fitz,b.dept_name,b.organization,addr)
                _force_tender_no_date(p,fitz,b.bid_no,date,recipient_bottom)
                _fill_toner_warranty_page(p,fitz,b.bid_no,model_number,b.warranty)
            else:
                _fill_toner_make_in_india_page(p,fitz,b.bid_no,model_number,b.dept_name,b.organization,addr,date,local_content)
            d.save(path);d.close();m.close()
        elif typ in ("technical_compliance","data_sheet"):
            src=os.path.join(settings.MEDIA_ROOT,"templates","documents.pdf");m=fitz.open(src)
            header_page=m[17] if len(m)>17 else m[0]  # page 18 = shared GeM header banner
            header_image=header_page.get_pixmap(matrix=fitz.Matrix(2,2),clip=fitz.Rect(18,12,header_page.rect.width-18,80),alpha=False).tobytes("png")
            signature_image=None
            if len(m)>5:
                sig_imgs=m[5].get_images(full=True)
                if len(sig_imgs)>1:signature_image=m.extract_image(sig_imgs[1][0]).get("image")
            d=fitz.open()
            for _ in range(2):
                gp_page=d.new_page(width=header_page.rect.width,height=header_page.rect.height)
                gp_page.insert_image(fitz.Rect(18,12,gp_page.rect.width-18,80),stream=header_image,keep_proportion=False)
            if typ=="technical_compliance":
                _fill_toner_technical_compliance_page1(d[0],fitz,b.bid_no,b)
                _fill_toner_technical_compliance_page2(d[1],fitz,b)
                _add_authorized_signatory(d[1],fitz,signature_image,y=605)
            else:
                _fill_toner_data_sheet_page(d[0],fitz,0,b)
                bottom=_fill_toner_data_sheet_page(d[1],fitz,1,b)
                _add_authorized_signatory(d[1],fitz,signature_image,y=min(bottom+8,720),compact=True)
            d.save(path);d.close();m.close()
        elif typ in ranges:
            src=os.path.join(settings.MEDIA_ROOT,"templates","documents.pdf");m=fitz.open(src);d=fitz.open();start,end=ranges[typ];d.insert_pdf(m,from_page=start-1,to_page=end-1)
            for pidx,p in enumerate(d):
                if typ=="service_support" and pidx==1:_format_service_center_heading(p,fitz)
                if not (typ=="manufacturer_auth" and pidx==2):_fix_toner_product_wording(p,fitz)
                if typ=="bidder_financial":_replace_bidder_financial_heading(p,fitz)
                if typ=="service_support":
                    _erase_tender(p,fitz);_fill_service_support_escalation(p,fitz);_fill_service_support_availability(p,fitz)
                    if pidx==0:_fix_toner_service_support_onsite_note(p,fitz)
                    if pidx==4:_add_service_support_table_note(p,fitz)
                    for block in p.get_text("dict").get("blocks",[]):
                        for line in block.get("lines",[]):
                            t=" ".join(s.get("text","") for s in line.get("spans",[]));n=re.sub(r"\s+"," ",re.sub(r"[^A-Za-z\s]"," ",t).upper()).strip()
                            if re.search(r"TO\s+WHOM.*MAY\s+CONCERN",n):
                                x=fitz.Rect(line["bbox"]);p.add_redact_annot(fitz.Rect(x.x0-4,x.y0-3,p.rect.width-36,x.y1+3),fill=(1,1,1));p.apply_redactions();y=max(92,x.y0-24);p.insert_textbox(fitz.Rect(62,y,p.rect.width-62,y+110),"\n".join(v for v in ["To,",b.dept_name,b.organization,addr] if v),fontsize=11,fontname="hebo",lineheight=1.15);break
                    if pidx==0:_add_service_support_bid_date(p,fitz,b.bid_no,date)
                    if pidx==len(d)-1:_add_service_support_last_page_bid_date(p,fitz,b.bid_no,date,b.dept_name,b.organization,addr)
                elif typ=="manufacturer_auth" and pidx==2:
                    # Template page 4 = the official Trade Mark Certificate, a legal
                    # source document — must stay byte-for-byte visually unchanged.
                    pass
                elif typ=="manufacturer_auth" and pidx==1:
                    _erase_tender(p,fitz)
                else:
                    recipient_bottom=_fill_recipient_block(p,fitz,b.dept_name,b.organization,addr)
                    _force_tender_no_date(p,fitz,b.bid_no,date,recipient_bottom)
                    if typ=="manufacturer_auth" and pidx==0:
                        _fill_manufacturer_auth_body(p,fitz)
            d.save(path);d.close();m.close()
        elif typ=="approved_price_paper":
            try:final_price=float(str(b.total_price or "").replace(",","").strip())
            except (TypeError,ValueError):final_price=0
            if final_price<=0:return JsonResponse({"error":"A valid final approved price is required."},status=400)
            price_doc=fitz.open();p=price_doc.new_page(width=595,height=842)
            template_path=os.path.join(settings.MEDIA_ROOT,"templates","documents.pdf");signature_image=None
            if os.path.exists(template_path):
                template_doc=fitz.open(template_path)
                source_page=template_doc[5] if len(template_doc)>5 else template_doc[0]
                header=source_page.get_pixmap(matrix=fitz.Matrix(2,2),clip=fitz.Rect(0,0,source_page.rect.width,112),alpha=False).tobytes("png")
                p.insert_image(fitz.Rect(18,12,577,112),stream=header,keep_proportion=False)
                signature_images=source_page.get_images(full=True)
                if len(signature_images)>1:signature_image=template_doc.extract_image(signature_images[1][0]).get("image")
                template_doc.close()
            p.insert_textbox(fitz.Rect(45,135,550,165),"APPROVED DETAILS FOR BIDDING",fontsize=14,fontname="hebo",align=1)
            x_positions=[48,390,547];y,row_height=190,28
            for column,heading in enumerate(("APPROVED BID DETAIL","VALUE")):
                rect=fitz.Rect(x_positions[column],y,x_positions[column+1],y+row_height)
                p.draw_rect(rect,color=(0.3,0.3,0.3),fill=(0.9,0.93,0.96),width=0.7)
                p.insert_textbox(rect+(4,6,-4,-3),heading,fontsize=9,fontname="hebo",align=column)
            y+=row_height
            for label,value in (("Bid No.",str(b.bid_no or "")),("Model No.",model_number),("Final Price",f"Rs. {final_price:,.2f}")):
                for column,text in enumerate((label,value)):
                    rect=fitz.Rect(x_positions[column],y,x_positions[column+1],y+row_height)
                    p.draw_rect(rect,color=(0.55,0.55,0.55),width=0.5)
                    p.insert_textbox(rect+(4,7,-4,-3),text,fontsize=9.5,fontname="hebo" if column==0 else "helv",align=2 if column else 0)
                y+=row_height
            sign_x,sign_y=72,430
            p.draw_line(fitz.Point(sign_x,sign_y-12),fitz.Point(345,sign_y-12),color=(0.75,0.79,0.84),width=0.8)
            p.insert_textbox(fitz.Rect(sign_x,sign_y,550,sign_y+28),"Auth. Signatory\nFor Laps N Tabs Technology Pvt. Ltd.",fontsize=9,fontname="hebo",lineheight=1.15)
            if signature_image:p.insert_image(fitz.Rect(sign_x,sign_y+30,sign_x+145,sign_y+70),stream=signature_image,keep_proportion=False)
            p.insert_textbox(fitz.Rect(sign_x,sign_y+74,550,sign_y+132),"Name:- Devank Rastogi\nDesignation:- Director\nEmail:- lapsntabs123@gmail.com\nContact No.:- 9918200166",fontsize=9,fontname="hebo",lineheight=1.15)
            price_doc.save(path);price_doc.close()
        elif typ in ("approved_all_documents","approved_atc_documents"):
            try:selected=json.loads(b.selected_general_docs or "[]")
            except Exception:selected=[]
            atc_labels={
                "warranty":"WARRANTY","bidder_financial":"BIDDER FINANCIAL STANDING","non_obsolete":"NON OBSOLETE",
                "data_sheet":"DATA SHEET","non_malicious":"NON MALICIOUS CODE","non_return_hdd":"NON RETURN OF HARD DISK",
                "technical_compliance":"TECHNICAL COMPLIANCE","non_blacklisting":"NON BLACKLISTING",
                "service_support":"SERVICE SUPPORT CONSIGNEE LOCATION","ipv6":"IPV6","preloaded_os":"PRELOADED OPERATING SYSTEM",
            }
            selected_atc_ids=list(dict.fromkeys(cid for cid in selected if cid in atc_labels))
            factory=RequestFactory()
            def _gen_child(child_id):
                child_request=factory.post(f"/api/toner-bids/{bid_id}/generate-docs/",data=json.dumps({"doc_type":child_id}),content_type="application/json",HTTP_HOST=r.get_host())
                child_response=generate_toner_documents(child_request,bid_id)
                if child_response.status_code!=200:return None
                child_path=os.path.join(out,f"toner_{bid_id}_{child_id}.pdf")
                return fitz.open(child_path) if os.path.exists(child_path) else None

            def _build_index_and_bundle(index_title,index_groups,section_headers,out_name):
                generated_groups=[]
                for section,docs in index_groups:
                    generated=[]
                    for child_id,label in docs:
                        child_doc=_gen_child(child_id)
                        if child_doc is not None:generated.append((label,child_doc))
                    if generated:generated_groups.append((section,generated))
                if not generated_groups:return None
                index_rows,page_number=[],1
                for section,docs in generated_groups:
                    rows=[]
                    for label,child_doc in docs:
                        start=page_number;end=start+len(child_doc)-1;rows.append((label,start,end));page_number=end+1
                    index_rows.append((section,rows))

                bundle=fitz.open();index_page=bundle.new_page(width=595,height=842)
                index_page.insert_textbox(fitz.Rect(45,60,550,100),index_title,fontsize=17,fontname="hebo",align=1)
                index_page.insert_text((48,127),f"Bid Number: {b.bid_no}",fontsize=12,fontname="hebo")
                columns,y,row_height=[48,92,380,462,547],152,32
                headings=("S.NO.","DOCUMENTS","PAGE FROM","PAGE TO")
                for col,heading in enumerate(headings):
                    rect=fitz.Rect(columns[col],y,columns[col+1],y+row_height)
                    index_page.draw_rect(rect,color=(0.45,0.45,0.45),fill=(0.92,0.94,0.96),width=0.6)
                    index_page.insert_textbox(rect+(4,9,-4,-3),heading,fontsize=9.2,fontname="hebo",align=1 if col!=1 else 0)
                y+=row_height

                serial=1
                for section,rows in index_rows:
                    if section_headers:
                        section_rect=fitz.Rect(columns[0],y,columns[-1],y+row_height)
                        index_page.draw_rect(section_rect,color=(0.35,0.35,0.35),fill=(0.85,0.88,0.92),width=0.7)
                        index_page.insert_textbox(section_rect+(5,9,-5,-3),section,fontsize=9.5,fontname="hebo",align=0)
                        y+=row_height
                    for label,start,end in rows:
                        values=(str(serial),label,str(start),str(end))
                        for col,val in enumerate(values):
                            rect=fitz.Rect(columns[col],y,columns[col+1],y+row_height)
                            index_page.draw_rect(rect,color=(0.55,0.55,0.55),width=0.5)
                            index_page.insert_textbox(rect+(4,9,-4,-3),val,fontsize=9.2,fontname="hebo",align=1 if col!=1 else 0)
                        serial+=1;y+=row_height

                for _,docs in generated_groups:
                    for _,child_doc in docs:
                        bundle.insert_pdf(child_doc);child_doc.close()
                for pidx in range(1,len(bundle)):
                    pg=bundle[pidx]
                    for block in pg.get_text("dict").get("blocks",[]):
                        if block.get("type")!=0:continue
                        for line in block.get("lines",[]):
                            text=" ".join(s.get("text","") for s in line.get("spans",[])).strip()
                            if line["bbox"][1]>pg.rect.height-60 and re.fullmatch(r"(?:Page\s*)?\d+",text,re.IGNORECASE):
                                pg.add_redact_annot(fitz.Rect(line["bbox"])+(-3,-2,3,2),fill=(1,1,1))
                    pg.apply_redactions()
                    pg.insert_textbox(fitz.Rect(pg.rect.width-60,pg.rect.height-28,pg.rect.width-18,pg.rect.height-8),str(pidx),fontsize=9,fontname="hebo",align=2)
                bundle.save(os.path.join(out,out_name));bundle.close()
                return out_name

            if typ=="approved_all_documents":
                non_atc_documents=[
                    ("manufacturer_auth","MAF CERTIFICATE"),("experience_certificate","EXPERIENCE CERTIFICATE"),
                    ("past_performance","PAST PERFORMANCE"),("oem_annual_turnover","OEM ANNUAL TURNOVER"),
                    ("make_in_india","MAKE IN INDIA"),("atc_acceptance_letter","ATC ACCEPTANCE LETTER"),
                ]
                groups=[("NON-ATC DOCUMENTS",non_atc_documents),("ATC DOCUMENTS",[(cid,atc_labels[cid]) for cid in selected_atc_ids])]
                out_name=_build_index_and_bundle("Index of all approved documents",groups,True,f"toner_{bid_id}_all_approved_documents.pdf")
                if out_name is None:return JsonResponse({"error":"No approved documents available"},status=400)
            else:
                if not selected_atc_ids:return JsonResponse({"error":"No ATC-related documents selected"},status=400)
                groups=[("ATC DOCUMENTS",[(cid,atc_labels[cid]) for cid in selected_atc_ids])]
                out_name=_build_index_and_bundle("Index of documents file with ATC",groups,False,f"toner_{bid_id}_approved_atc_documents.pdf")
                if out_name is None:return JsonResponse({"error":"No ATC-related documents selected"},status=400)
            return JsonResponse({"message":f"{typ} generated","pdf_url":r.build_absolute_uri(f"{settings.MEDIA_URL}generated/toner/{out_name}")+f"?v={int(time.time())}"})
        else:return JsonResponse({"error":f"Invalid doc_type: '{typ}'"},status=400)
        _add_page_numbers(path,fitz)
        return JsonResponse({"message":f"{typ} generated","pdf_url":r.build_absolute_uri(f"{settings.MEDIA_URL}generated/toner/{name}")+f"?v={int(time.time())}"})
    except Exception as e:return JsonResponse({"error":f"Document generation failed: {e}"},status=500)
