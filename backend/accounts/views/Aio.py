import json, os, re, shutil, time
from django.conf import settings
from django.db import connection, models
from django.http import JsonResponse
from django.test import RequestFactory
from django.views.decorators.csrf import csrf_exempt
from ..models import User, CatalogueProduct
# Reused as-is from Desktop's catalogue-matching engine (pure text/scoring
# helpers, no DesktopBid dependency) so AIO's model search behaves the same way.
from .Desktop import (
    _match_is_blank, _values_overlap_score, _catalogue_values_for_keys,
    _monitor_size_match, _keyboard_match, _catalogue_extra_specs, _match_clean,
)
from django.db import IntegrityError, transaction

class AioBid(models.Model):
    user=models.ForeignKey(User,null=True,blank=True,on_delete=models.SET_NULL); username=models.CharField(max_length=150,blank=True,default="")
    bid_no=models.CharField(max_length=150); dept_name=models.CharField(max_length=255,blank=True,default=""); organization=models.CharField(max_length=255,blank=True,default="")
    model_no=models.CharField(max_length=50,blank=True,default="AXL-AIO000-"); model=models.CharField(max_length=100,blank=True,default=""); qty=models.PositiveIntegerField(default=1); date=models.DateField(null=True,blank=True)
    atc=models.TextField(blank=True,default=""); address=models.TextField(blank=True,default=""); pincode=models.CharField(max_length=20,blank=True,default="")
    processor=models.TextField(blank=True,default=""); processor_price=models.DecimalField(max_digits=12,decimal_places=2,default=1000)
    ram=models.TextField(blank=True,default=""); ram_price=models.DecimalField(max_digits=12,decimal_places=2,default=1000); hdd=models.TextField(blank=True,default=""); hdd_price=models.DecimalField(max_digits=12,decimal_places=2,default=1000)
    ssd=models.TextField(blank=True,default=""); ssd_price=models.DecimalField(max_digits=12,decimal_places=2,default=1000); os=models.TextField(blank=True,default=""); os_price=models.DecimalField(max_digits=12,decimal_places=2,default=1000)
    motherboard=models.TextField(blank=True,default=""); motherboard_price=models.DecimalField(max_digits=12,decimal_places=2,default=1000); screen_size=models.CharField(max_length=100,blank=True,default=""); screen_price=models.DecimalField(max_digits=12,decimal_places=2,default=1000)
    wifi=models.TextField(blank=True,default=""); wifi_price=models.DecimalField(max_digits=12,decimal_places=2,default=1000); keyboard=models.TextField(blank=True,default=""); keyboard_price=models.DecimalField(max_digits=12,decimal_places=2,default=1000)
    dvd=models.CharField(max_length=50,blank=True,default=""); dvd_price=models.DecimalField(max_digits=12,decimal_places=2,default=1000); warranty=models.CharField(max_length=50,blank=True,default=""); warranty_price=models.DecimalField(max_digits=12,decimal_places=2,default=1000)
    pro_descp=models.TextField(blank=True,default=""); software1=models.TextField(blank=True,default=""); gp=models.TextField(blank=True,default=""); motherboard_descp=models.TextField(blank=True,default="")
    local_content=models.CharField(max_length=20,blank=True,default="")
    freightInstallation=models.CharField(max_length=50,default="Yes"); freightInstallation_price=models.DecimalField(max_digits=12,decimal_places=2,default=1000); hddreturnable=models.CharField(max_length=10,default="Yes"); hddreturnable_price=models.DecimalField(max_digits=12,decimal_places=2,default=1000); epbg=models.DecimalField(max_digits=7,decimal_places=2,default=0)
    total_price=models.DecimalField(max_digits=14,decimal_places=2,default=0)
    upload_document=models.FileField(upload_to="aio_bid_documents/",null=True,blank=True); atc_special_document=models.FileField(upload_to="aio_bid_documents/special/",null=True,blank=True)
    selected_general_docs=models.TextField(blank=True,default="[]"); verified_fields=models.TextField(blank=True,default="[]"); status=models.CharField(max_length=30,default="draft")
    analyser_username=models.CharField(max_length=150,blank=True,default=""); analyser_note=models.TextField(blank=True,default=""); admin_username=models.CharField(max_length=150,blank=True,default=""); admin_note=models.TextField(blank=True,default="")
    # Same fields as DesktopBid's own gem_* columns (accounts/models.py) — the
    # GeM-upload panel below mirrors Desktop's, minus its extension auto-fill
    # (that needs the extension itself taught AIO's GeM category form).
    gem_status=models.CharField(max_length=30,default="not_started"); gem_account=models.CharField(max_length=100,blank=True,null=True)
    gem_product_id=models.CharField(max_length=255,blank=True,null=True); gem_product_url=models.URLField(max_length=1000,blank=True,null=True)
    gem_error=models.TextField(blank=True,null=True); gem_uploaded_at=models.DateTimeField(blank=True,null=True)
    created_at=models.DateTimeField(auto_now_add=True); updated_at=models.DateTimeField(auto_now=True)
    class Meta: app_label="accounts"; db_table="accounts_aiobid"; ordering=["-created_at"]

class AioGemUploadJob(models.Model):
    STATUS_CHOICES=[("queued","Queued"),("ready_for_fill","Ready for extension fill"),("filled","Filled in GeM"),("retrying","Retrying"),("submitted","Submitted"),("published","Published"),("rejected","Rejected"),("failed","Failed"),("cancelled","Cancelled")]
    bid=models.ForeignKey(AioBid,on_delete=models.CASCADE,related_name="gem_upload_jobs")
    # Same as Desktop's own GemUploadJob (models.py) — the GemAccount concept
    # was retired app-wide (migration 0053_remove_gemaccount dropped the model
    # entirely), replaced by manual-login-only tracking. No "account" field
    # here to match.
    triggered_by=models.ForeignKey(User,on_delete=models.SET_NULL,null=True,blank=True,related_name="triggered_aio_gem_upload_jobs")
    status=models.CharField(max_length=30,choices=STATUS_CHOICES,default="queued")
    progress=models.CharField(max_length=255,default="Waiting for worker")
    error=models.TextField(blank=True,default=""); rejection_reason=models.TextField(blank=True,default="")
    attempts=models.PositiveIntegerField(default=0); max_attempts=models.PositiveIntegerField(default=3); next_attempt_at=models.DateTimeField(blank=True,null=True)
    gem_product_id=models.CharField(max_length=255,blank=True,default=""); gem_product_url=models.URLField(max_length=1000,blank=True,default="")
    payload_snapshot=models.JSONField(default=dict,blank=True)
    created_at=models.DateTimeField(auto_now_add=True); started_at=models.DateTimeField(blank=True,null=True)
    submitted_at=models.DateTimeField(blank=True,null=True); completed_at=models.DateTimeField(blank=True,null=True); updated_at=models.DateTimeField(auto_now=True)
    class Meta: app_label="accounts"; db_table="accounts_aiogemuploadjob"; ordering=["-created_at"]
    def __str__(self):return f"AIO GeM job {self.id}: {self.bid.bid_no}"

class AioGemAuditLog(models.Model):
    job=models.ForeignKey(AioGemUploadJob,on_delete=models.CASCADE,related_name="audit_logs")
    actor=models.ForeignKey(User,on_delete=models.SET_NULL,null=True,blank=True)
    event=models.CharField(max_length=100); message=models.TextField(blank=True,default=""); metadata=models.JSONField(default=dict,blank=True)
    created_at=models.DateTimeField(auto_now_add=True)
    class Meta: app_label="accounts"; db_table="accounts_aiogemauditlog"; ordering=["-created_at"]
    def __str__(self):return f"{self.job_id}: {self.event}"

FIELDS=["bid_no","dept_name","organization","model_no","model","qty","date","atc","address","pincode","processor","processor_price","ram","ram_price","hdd","hdd_price","ssd","ssd_price","os","os_price","motherboard","motherboard_price","screen_size","screen_price","wifi","wifi_price","keyboard","keyboard_price","dvd","dvd_price","warranty","warranty_price","pro_descp","software1","gp","motherboard_descp","freightInstallation","freightInstallation_price","hddreturnable","hddreturnable_price","epbg","local_content"]
PRICES={x for x in FIELDS if x.endswith("_price")}|{"epbg"}
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
    _ensure_model_table(AioBid)
def _ensure_gem_tables():
    _ensure_model_table(AioGemUploadJob);_ensure_model_table(AioGemAuditLog)
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
    # Same signal as Desktop's is_new_product: a model number that was
    # auto-created off this bid (via save_aio_model_number, not imported from
    # aio_specs.xlsx) still needs to be manually added to GeM's own catalogue —
    # the Analyser's "Transfer Catalogue to GeM" tab surfaces exactly these.
    is_new_product=False
    if model_number:
        cp=CatalogueProduct.objects.filter(model_no__iexact=model_number,category="aio").first()
        if cp:is_new_product=_catalogue_extra_specs(cp).get("_source")=="aio_bid"
    out.update(model_number=model_number,submitted_by=b.username,user_name=b.username,is_new_product=is_new_product)
    return out

@csrf_exempt
def create_aio_bid(r):
    if r.method!="POST":return JsonResponse({"error":"POST required"},status=405)
    _ensure_table();d=_data(r)
    if not d.get("bid_no"):return JsonResponse({"error":"Bid number is required"},status=400)
    b=AioBid(user=User.objects.filter(id=d.get("user_id")).first(),username=d.get("username",""),bid_no=d["bid_no"]);_assign(b,d);b.save();return JsonResponse({"message":"AIO bid created","bid_id":b.id},status=201)
@csrf_exempt
def update_aio_bid(r,bid_id):
    if r.method not in ("POST","PUT","PATCH"):return JsonResponse({"error":"POST, PUT or PATCH required"},status=405)
    _ensure_table();b=AioBid.objects.filter(id=bid_id).first()
    if not b:return JsonResponse({"error":"AIO bid not found"},status=404)
    _assign(b,_data(r)); b.upload_document=r.FILES.get("upload_document",b.upload_document); b.status="submitted";b.save();return JsonResponse({"message":"AIO bid submitted","bid":_json(b,r)})
def list_aio_bids(r):
    _ensure_table();q=AioBid.objects.all();s=r.GET.get("status");role=r.GET.get("role")
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
def get_aio_bid(r,bid_id):
    _ensure_table();b=AioBid.objects.filter(id=bid_id).first();return JsonResponse(_json(b,r) if b else {"error":"AIO bid not found"},status=200 if b else 404)
@csrf_exempt
def review_aio_bid(r,bid_id):
    if r.method not in ("POST","PATCH"):return JsonResponse({"error":"POST or PATCH required"},status=405)
    _ensure_table();b=AioBid.objects.filter(id=bid_id).first()
    if not b:return JsonResponse({"error":"AIO bid not found"},status=404)
    d=_data(r);s="analyzed" if d.get("status")=="reviewed" else d.get("status")
    if s not in ("analyzed","rejected","re-analyze"):return JsonResponse({"error":"Invalid analyser status"},status=400)
    # model_no/model are only ever meant to change via save_aio_model_number —
    # this review POST carries the whole form back (built from whatever the
    # browser fetched before Find Model ran), so blindly re-assigning them
    # from FIELDS here would silently wipe out a model the analyser just
    # saved moments earlier back to the "AXL-AIO000-" default.
    saved_model_no,saved_model=b.model_no,b.model
    _assign(b,d);b.model_no,b.model=saved_model_no,saved_model
    b.verified_fields=json.dumps(d.get("verified_fields",[]));b.status=s;b.analyser_note=d.get("analyser_note","");b.analyser_username=d.get("analyser_username","");b.save();return JsonResponse({"message":"Analyser review saved","bid":_json(b,r)})
@csrf_exempt
def admin_review_aio_bid(r,bid_id):
    if r.method!="POST":return JsonResponse({"error":"POST required"},status=405)
    _ensure_table();b=AioBid.objects.filter(id=bid_id).first();d=_data(r)
    if not b:return JsonResponse({"error":"AIO bid not found"},status=404)
    status=d.get("status")
    if status not in ("approved","rejected","re-analyze"):return JsonResponse({"error":"Invalid admin status"},status=400)
    if status=="approved":
        local_content=str(d.get("local_content") or "").strip().rstrip("%")
        if not local_content:return JsonResponse({"error":"Local Content (%) is mandatory."},status=400)
        try:local_content_number=float(local_content)
        except (TypeError,ValueError):return JsonResponse({"error":"Local Content must be a valid number."},status=400)
        if local_content_number<0 or local_content_number>100:return JsonResponse({"error":"Local Content must be between 0 and 100."},status=400)
        hddreturnable=d.get("hddreturnable",b.hddreturnable)
        try:hddreturnable_price=float(d.get("hddreturnable_price") or 0)
        except (TypeError,ValueError):hddreturnable_price=0
        if str(hddreturnable).strip().lower()=="yes" and hddreturnable_price<=0:
            return JsonResponse({"error":"HDD Return Option price is mandatory when the option is Yes."},status=400)
        try:total_price=float(d.get("total_price") or 0)
        except (TypeError,ValueError):total_price=0
        if total_price<=0:
            return JsonResponse({"error":"Bid Approved Price is mandatory and must be greater than 0."},status=400)
    # model_no has no input field on the Admin form at all (only "model" is
    # editable there) — same risk as review_aio_bid's stale-payload wipe, just
    # for the other half of the split field, so it's always preserved here.
    saved_model_no=b.model_no
    _assign(b,d);b.model_no=saved_model_no
    if "total_price" in d:
        try:b.total_price=float(d.get("total_price") or 0)
        except (TypeError,ValueError):pass
    b.status=status;b.admin_note=d.get("admin_note","");b.admin_username=d.get("admin_username","");b.save()
    return JsonResponse({"message":"Admin review saved","bid":_json(b,r)})
@csrf_exempt
def delete_aio_bid(r,bid_id):
    from .bid_cleanup import delete_bid_with_related_data
    _ensure_table();bid=AioBid.objects.filter(id=bid_id).first()
    if not bid:return JsonResponse({"error":"AIO bid not found"},status=404)
    delete_bid_with_related_data(bid,"aio")
    return JsonResponse({"message":"AIO bid and related data deleted"})

# ---- Analyser's Catalogue Products page: same pattern as
# list_workstation_catalogue_products/list_printer_catalogue_products
# (Workstation.py) — a dedicated endpoint that hands back RAW extra_specs
# instead of routing through Desktop's list_catalogue_products, whose
# _catalogue_product_data/_normalize_extra_specs rebuilds extra_specs against
# Desktop's own fixed spec-field list and silently drops anything not on it
# (Screen Size, WiFi Bluetooth, Motherboard Ports, etc. — every AIO-only key).
def list_aio_catalogue_products(r):
    search=(r.GET.get("search") or "").strip().lower()
    products=[]
    for cp in CatalogueProduct.objects.filter(category__iexact="aio").order_by("-created_at"):
        extra_specs=_catalogue_extra_specs(cp)
        product={
            "id":f"aio-catalogue-{cp.id}","catalogue_id":cp.id,"model_no":cp.model_no or "",
            "category":cp.category or "aio",
            "processor":cp.processor or extra_specs.get("Processor Number",""),
            "ram":cp.ram or extra_specs.get("RAM",""),
            "storage":cp.storage or extra_specs.get("Storage",""),
            "os":cp.os or extra_specs.get("Operating System",""),
            "screen_size":extra_specs.get("Screen Size",""),
            "wifi":extra_specs.get("WiFi Bluetooth",""),
            "motherboard":extra_specs.get("Motherboard Ports",""),
            "keyboard":extra_specs.get("Keyboard Mouse",""),
            "description":cp.description or "All in One PC",
            "extra_specs":extra_specs,"source":"catalogue",
        }
        products.append(product)
    if search:
        products=[p for p in products if search in p["model_no"].lower() or search in p["description"].lower()]
    return JsonResponse(products,safe=False,status=200)

# ---- Catalogue model matching ("Find Model"), same approach as Desktop but
# scoped to AIO's own aio_specs.xlsx catalogue (CatalogueProduct category="aio").
AIO_CATALOGUE_FIELD_MAP={
    # "motherboard" is deliberately excluded: the AIO config step's motherboard
    # dropdown is borrowed from Desktop's chipset catalogue (no AIO-specific one
    # exists), so its values don't line up with aio_specs.xlsx's raw port list —
    # comparing them would never score a real match.
    "processor":["Processor"],"ram":["RAM"],"ssd":["SSD","Storage"],"os":["OS"],
    "screen_size":["Screen Size"],"keyboard":["Keyboard Mouse"],"wifi":["WiFi Bluetooth"],
}
MIN_STRONG_MATCH_FIELDS_AIO=4

def _aio_storage_gb(value):
    # aio_specs.xlsx always spells 1TB-class drives out as "1024 GB" (binary),
    # never "1 TB" — but Desktop's shared _storage_to_gb treats "1 TB" as a
    # decimal 1000, so a bid built from AIO_SSDS's "1 TB NVMe" option would
    # never line up with the catalogue's "1024 GB NVMe" (1000 != 1024) and
    # silently kill the whole match. This mirrors _storage_to_gb but uses
    # 1024 for the TB conversion to match aio_specs.xlsx's own convention.
    text=_match_clean(value)
    if not text:return None
    m_tb=re.search(r"(\d+(?:\.\d+)?)\s*tb",text)
    if m_tb:return int(float(m_tb.group(1))*1024)
    m_gb=re.search(r"(\d+(?:\.\d+)?)\s*gb",text)
    if m_gb:return int(float(m_gb.group(1)))
    return None

def _aio_ssd_match(bid_value,product,catalogue_keys):
    if _match_is_blank(bid_value):return None
    b_gb=_aio_storage_gb(bid_value)
    candidates=[]
    if product.storage:candidates.append(("ssd (catalogue summary)",str(product.storage)))
    candidates.extend(_catalogue_values_for_keys(product,catalogue_keys))
    if not candidates:return False,"","",-1
    best_key=best_value="";best_score=-1
    for key_label,value in candidates:
        c_gb=_aio_storage_gb(value)
        score=2200 if (b_gb is not None and c_gb is not None and b_gb==c_gb) else _values_overlap_score(bid_value,value)
        if score>best_score:best_score,best_key,best_value=score,key_label,value
    return best_score>=100,best_key,best_value,best_score

def _best_catalogue_match_aio(bid_key,bid_value,product,catalogue_keys):
    if _match_is_blank(bid_value):return None,"","",-1
    if bid_key=="screen_size":
        m=_monitor_size_match(bid_value,product,catalogue_keys)
        if m is not None:return m
    if bid_key=="keyboard":return _keyboard_match(bid_value,product,catalogue_keys)
    if bid_key=="ssd":
        m=_aio_ssd_match(bid_value,product,catalogue_keys)
        if m is not None:return m
    direct_map={"processor":product.processor or "","ram":product.ram or "","ssd":product.storage or "","os":product.os or ""}
    candidates=[]
    direct_value=direct_map.get(bid_key,"")
    if direct_value:candidates.append((f"{bid_key} (catalogue summary)",str(direct_value)))
    candidates.extend(_catalogue_values_for_keys(product,catalogue_keys))
    if not candidates:return False,"","",-1
    best_key=best_value="";best_score=-1
    for key_label,value in candidates:
        score=_values_overlap_score(bid_value,value)
        if score>best_score:best_score,best_key,best_value=score,key_label,value
    return best_score>=100,best_key,best_value,best_score

def _score_fields(bid_specs,scorer):
    matched_count=checked_count=0;total_score=0
    for bid_key in AIO_CATALOGUE_FIELD_MAP:
        bid_value=bid_specs.get(bid_key,"")
        if _match_is_blank(bid_value):continue
        matched,_,_,best_score=scorer(bid_key,bid_value)
        checked_count+=1
        if matched:matched_count+=1;total_score+=max(float(best_score or 0),0)
        else:total_score+=max(float(best_score or 0),0)*0.25
    return matched_count,checked_count,round(total_score,2)

@csrf_exempt
def match_aio_catalogue_models(r,bid_id):
    if r.method!="POST":return JsonResponse({"error":"POST required"},status=405)
    _ensure_table();b=AioBid.objects.filter(id=bid_id).first()
    if not b:return JsonResponse({"error":"AIO bid not found"},status=404)
    body=_data(r)
    bid_specs={k:str((body.get(k) if body.get(k) not in (None,"") else getattr(b,k,"")) or "").strip() for k in AIO_CATALOGUE_FIELD_MAP}

    results=[]
    for product in CatalogueProduct.objects.filter(category="aio"):
        matched_count,checked_count,total_score=_score_fields(
            bid_specs,lambda k,v,p=product:_best_catalogue_match_aio(k,v,p,AIO_CATALOGUE_FIELD_MAP[k])
        )
        if checked_count==0:continue
        is_perfect=checked_count>=MIN_STRONG_MATCH_FIELDS_AIO and matched_count==checked_count
        results.append({"model_no":product.model_no or "","product_id":product.id,"bid_id":None,"source":"catalogue","match_count":matched_count,"total_checked":checked_count,"total_score":total_score,"is_perfect":is_perfect})

    other_bids=AioBid.objects.exclude(id=b.id).exclude(model="").exclude(model__isnull=True)
    for other in other_bids:
        def _other_scorer(k,v,o=other):
            ov=str(getattr(o,k,"") or "")
            if _match_is_blank(ov):return False,"","",-1
            score=_values_overlap_score(v,ov)
            return score>=100,k,ov,score
        matched_count,checked_count,total_score=_score_fields(bid_specs,_other_scorer)
        if checked_count==0:continue
        is_perfect=checked_count>=MIN_STRONG_MATCH_FIELDS_AIO and matched_count==checked_count
        results.append({"model_no":f"{other.model_no}{other.model}","product_id":None,"bid_id":other.id,"source":"bid","match_count":matched_count,"total_checked":checked_count,"total_score":total_score,"is_perfect":is_perfect})

    perfect=[x for x in results if x["is_perfect"]]
    perfect.sort(key=lambda x:(-x["match_count"],-x["total_score"],x["model_no"]))
    if perfect:
        best=perfect[0]
        return JsonResponse({"match":{"model_no":best["model_no"],"product_id":best.get("product_id"),"bid_id":best.get("bid_id"),"category":"aio"},"matches":[best]})
    return JsonResponse({"match":None,"matches":[]})

@csrf_exempt
def save_aio_model_number(r,bid_id):
    if r.method!="POST":return JsonResponse({"error":"POST required"},status=405)
    _ensure_table();b=AioBid.objects.filter(id=bid_id).first()
    if not b:return JsonResponse({"error":"AIO bid not found"},status=404)
    d=_data(r)
    model_number=str(d.get("model_number") or d.get("model") or d.get("model_no") or d.get("modelNo") or "").strip().upper()
    if not model_number:return JsonResponse({"error":"Model number required"},status=400)
    b.model_no="";b.model=model_number;b.save()
    # Same to same as Desktop's save_model_number: if this model isn't already
    # a catalogue entry, auto-create one tagged "_source": "aio_bid" so it
    # shows up under the Analyser's "Transfer Catalogue to GeM" tab once the
    # bid is approved — that's the signal a product still needs manual GeM
    # catalogue creation, same as Desktop's is_new_product flag.
    storage=" + ".join(v for v in [b.ssd,b.hdd] if str(v or "").strip())
    extra_specs={
        "_source":"aio_bid","Computer Type":"All in One PC",
        "Processor Number":b.processor or "","RAM":b.ram or "","Storage":storage,
        "Operating System":b.os or "","Screen Size":b.screen_size or "",
        "WiFi Bluetooth":b.wifi or "","Keyboard Mouse":b.keyboard or "",
        # Key must be "Motherboard Ports", not "Ports" — the Analyser's
        # catalogue product detail view (AnalyserProductsPage.jsx) reads
        # raw["Motherboard Ports"] for the CONNECTIVITY & PORTS section;
        # the mismatched key was silently showing "NA" for every bid-derived
        # (non aio_specs.xlsx) catalogue entry.
        "Motherboard Ports":b.motherboard or "","Optical Drive":b.dvd or "",
        "On Site OEM Warranty (in Year)":b.warranty or "",
    }
    try:
        with transaction.atomic():
            cp=CatalogueProduct.objects.filter(model_no__iexact=model_number).first()
            if cp is None:
                try:
                    with transaction.atomic():
                        CatalogueProduct.objects.create(model_no=model_number,processor=b.processor or "",ram=b.ram or "",storage=storage,os=b.os or "",category="aio",description=b.pro_descp or "All in One PC",extra_specs=extra_specs)
                except IntegrityError:
                    pass
            else:
                existing=_catalogue_extra_specs(cp)
                if existing.get("_source")=="aio_bid":
                    existing.update(extra_specs)
                    cp.processor=b.processor or "";cp.ram=b.ram or "";cp.storage=storage;cp.os=b.os or "";cp.category="aio";cp.extra_specs=existing
                    cp.save(update_fields=["processor","ram","storage","os","category","extra_specs","updated_at"])
    except Exception:
        pass
    return JsonResponse({"success":True,"bid_id":b.id,"model_number":model_number,"model":model_number})
@csrf_exempt
def update_aio_docs(r,bid_id):
    if r.method!="POST":return JsonResponse({"error":"POST required"},status=405)
    _ensure_table();b=AioBid.objects.filter(id=bid_id).first()
    if not b:return JsonResponse({"error":"AIO bid not found"},status=404)
    b.atc_special_document=r.FILES.get("atc_special_document",b.atc_special_document);b.selected_general_docs=r.POST.get("selected_general_docs","[]");b.status="complete";b.save()
    from .GemAssignments import complete_user_assignment_for_bid
    complete_user_assignment_for_bid(b.bid_no,b.user)
    return JsonResponse({"message":"AIO documents saved successfully","bid":_json(b,r)})

# These narrative certificate pages are shared with Desktop's own template and
# default to "desktop computer" phrasing in a few plain-text sentences — swap
# that to AIO's actual product name so the certificate doesn't misdescribe
# what's actually being supplied on this bid.
_AIO_WORDING_FIXES=[
    (re.compile(r'\bAcxxel\s+Desktops\b',re.I),'Acxxel All in One PCs'),
    (re.compile(r'\bdesktop\s+computer\b',re.I),'All in One PC'),
    (re.compile(r'\bSince\s+desktop\s+has\b',re.I),'Since All in One PC has'),
    # Wherever the template's own baked-in text still shouts "ACXXEL" in all
    # caps (brand mentions, trademark lines, section headings...), lowercase
    # it to match the brand's actual styling used everywhere else in these
    # documents — case-sensitive on purpose, so "Acxxel" (title case) is left
    # alone and only the literal all-caps spelling is touched.
    (re.compile(r'\bACXXEL\b'),'acxxel'),
    (re.compile(r'\bAcxxel\b'),'acxxel'),
    # Non-Obsolete certificate's residual-market-life guarantee — only appears
    # on that one page in the template.
    (re.compile(r'\b3\s*\(Three\)',re.I),'5 (Five)'),
    # Service Support certificate's escalation-matrix intro line — only
    # appears on that one page in the template.
    (re.compile(r'\bEscalation matrix below reference\s*:',re.I),'Escalation matrix for service support is as follows:'),
    # Non Return of Hard Disk certificate's device list — only appears on
    # that one page in the template. Keep the original Desktop/Laptop
    # wording as-is, just add All in One Computers to the list alongside them.
    (re.compile(r'Desktop\s+Computers\s*/\s*Laptops',re.I),'Desktop Computers/ All in One Computers'),
]
def _fix_aio_product_wording(page,fitz):
    edits=[]
    for block in page.get_text("dict").get("blocks",[]):
        for line in block.get("lines",[]):
            for span in line.get("spans",[]):
                text=span.get("text","")
                if not text.strip():continue
                new_text=text
                for pat,repl in _AIO_WORDING_FIXES:new_text=pat.sub(repl,new_text)
                if new_text!=text:
                    is_bold=bool(span.get("flags",0)&16)
                    edits.append((fitz.Rect(span["bbox"]),text,new_text,span.get("size",10.5),is_bold))
    if not edits:return
    # Buffer is sized to how much LONGER the replacement text is, not a flat
    # amount — a same-length swap like "ACXXEL"->"acxxel" needs none at all,
    # and a flat +90 here was over-redacting to the right of short spans
    # sitting mid-sentence, wiping out neighbouring spans' text (a different
    # span on the same line) that this pass never reinserts because it never
    # matched anything itself.
    for rect,old_text,new_text,size,is_bold in edits:
        extra=max(0,len(new_text)-len(old_text))*size*0.6
        # No vertical padding: adjacent lines in these templates can sit as
        # little as ~0.1pt apart (see the "ACXXEL SERVICE PARTNERS" / "TOLL
        # FREE No..." pair on the service_support page), so even +1/+2pt of
        # slop here clips the top of whatever line comes right after.
        redact_rect=fitz.Rect(rect.x0,rect.y0,min(page.rect.width-36,rect.x1+extra),rect.y1)
        # Most of these spans sit on a plain white page (the vast majority of
        # AIO's ACXXEL/wording fixes), so redacting to white is right almost
        # everywhere — but a few (the "ACXXEL SERVICE PARTNERS" yellow banner
        # on the service_support page) sit on a solid colour block, and
        # redacting those to white punches a visible white hole in it.
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
        # Match the original span's weight (the template's own embedded fonts
        # can't be referenced directly by name here, but at least keeping
        # bold-vs-regular consistent avoids a jarring font/weight mismatch
        # against the surrounding untouched text on the same line).
        page.insert_text((rect.x0,rect.y1-2),new_text,fontsize=size,fontname="hebo" if is_bold else "helv",color=(0,0,0))

# These same narrative certificates carry a sample "To," recipient block
# (a leftover real department/GSTIN from whoever's bid the template was last
# generated from) followed by a Tender No/Dated line. _force_tender_no_date
# already fixes the tender line; this fills the recipient block itself with
# the actual bid's department/organization/address, same as Desktop's own
# bid data is expected to show through instead of stale sample text.
def _fill_recipient_block(page,fitz,dept_name,organization,full_address):
    values=[str(v).strip() for v in [dept_name,organization,full_address] if str(v or "").strip()]
    if not values:return
    lines=[]
    for block in page.get_text("dict").get("blocks",[]):
        for line in block.get("lines",[]):
            t=" ".join(s.get("text","") for s in line.get("spans",[])).strip()
            if t:lines.append((fitz.Rect(line["bbox"]),t))
    lines.sort(key=lambda x:x[0].y0)
    to_idx=next((i for i,(bx,t) in enumerate(lines) if t.strip().rstrip(",").strip().lower()=="to"),None)
    if to_idx is None:return
    stop_idx=len(lines)
    for i in range(to_idx+1,len(lines)):
        if re.search(r"tender\s*no|bid\s*no|subject\s*[:\-]",lines[i][1],re.I):
            stop_idx=i;break
    block_lines=lines[to_idx+1:stop_idx]
    if not block_lines:return
    # Clamp the redaction box strictly between the "To," line's own bottom and
    # the next marker line's top — some templates pack these lines only ~0.1pt
    # apart, and redacting even a sliver into a neighbouring line's bbox wipes
    # that whole line (PyMuPDF drops the entire glyph run it touches).
    to_bbox=lines[to_idx][0]
    region_x0=min(bx.x0 for bx,_ in block_lines)
    region_y0=max(block_lines[0][0].y0-1,to_bbox.y1+0.5)
    region_y1=block_lines[-1][0].y1+2
    if stop_idx<len(lines):region_y1=min(region_y1,lines[stop_idx][0].y0-0.5)
    line_height=(block_lines[-1][0].y1-block_lines[0][0].y0)/max(1,len(block_lines))
    if line_height<12:line_height=15

    # Some of these templates also print a stale sample GSTIN inside this same
    # block (manufacturer_auth/bidder_financial/warranty) — that belongs to
    # whoever's bid the template was last generated from, not this bid, so it
    # gets wiped along with the rest of the sample recipient text below
    # rather than shown.
    page.add_redact_annot(fitz.Rect(region_x0-2,region_y0,page.rect.width-36,region_y1),fill=(1,1,1))
    page.apply_redactions()
    y=region_y0+1
    for val in values:
        page.insert_textbox(fitz.Rect(region_x0,y,page.rect.width-36,y+line_height+8),val,fontsize=11,fontname="hebo",color=(0,0,0))
        y+=line_height
    return y

def _erase_tender(page,fitz):
    for block in page.get_text("dict").get("blocks",[]):
        for line in block.get("lines",[]):
            t=" ".join(s.get("text","") for s in line.get("spans",[]))
            if re.search(r"Tender\s*No|GEM/\d{4}/[A-Z]/\d+|Dated\s*:?\s*\d{2}-\d{2}-\d{4}",t,re.I):
                x=fitz.Rect(line["bbox"]);page.add_redact_annot(fitz.Rect(x.x0-3,x.y0-3,page.rect.width-36,x.y1+4),fill=(1,1,1))
    page.apply_redactions()

def _replace_bidder_financial_heading(page,fitz):
    old_headings=("BIDDER FINANCIAL UNDERSTANDINGS","BIDDER FINANCIAL UNDERTAKINGS")
    replacements=[]
    for old_heading in old_headings:
        for rect in page.search_for(old_heading):
            replacements.append(rect)
            page.add_redact_annot(fitz.Rect(rect.x0-2,rect.y0-2,rect.x1+2,rect.y1+2),fill=(1,1,1))
    if not replacements:return
    page.apply_redactions()
    for rect in replacements:
        page.insert_text((rect.x0,rect.y1-2),"BIDDER FINANCIAL STANDING",fontsize=11,fontname="hebo",color=(0,0,0))

def _add_aio_page_numbers(path,fitz):
    doc=fitz.open(path)
    try:
        for page_index,page in enumerate(doc):
            # Clear any template page count already present in the footer so
            # every AIO output has one consistent counter.
            for block in page.get_text("dict").get("blocks",[]):
                if block.get("type")!=0:continue
                for line in block.get("lines",[]):
                    text=" ".join(span.get("text","") for span in line.get("spans",[])).strip()
                    if line["bbox"][1]>page.rect.height-55 and re.fullmatch(r"(?:Page\s*)?\d+(?:\s*(?:of|/)\s*\d+)?",text,re.I):
                        page.add_redact_annot(fitz.Rect(line["bbox"])+(-3,-2,3,2),fill=(1,1,1))
            page.apply_redactions()
            page.insert_textbox(
                fitz.Rect(page.rect.width-115,page.rect.height-28,page.rect.width-18,page.rect.height-8),
                str(page_index+1),fontsize=9,fontname="hebo",color=(0,0,0),align=2,
            )
        doc.saveIncr()
    finally:
        doc.close()

def _force_tender_no_date(page,fitz,bid_no,date,recipient_bottom=None):
    # Like _erase_tender, but re-inserts the line where it actually found it
    # (Desktop's approach) instead of guessing a fixed y-coordinate — pages
    # like Warranty have this line much higher up than the other templates.
    if not (bid_no or date):return
    tender_text=f"Bid No: {bid_no or ''} Dated: {date or ''}"
    tender_rects=[];first_rect=None;subject_rect=None
    for block in page.get_text("dict").get("blocks",[]):
        for line in block.get("lines",[]):
            t=" ".join(s.get("text","") for s in line.get("spans",[])).strip()
            if not t:continue
            bbox=fitz.Rect(line["bbox"])
            if subject_rect is None and re.search(r"\bSubject\b|Subject-",t,re.I):subject_rect=bbox
            if re.search(r"Tender\s*No|GEM/\d{4}/[A-Z]/\d+|Dated\s*:?\s*\d{2}-\d{2}-\d{4}",t,re.I):
                tender_rects.append(fitz.Rect(bbox.x0-2,bbox.y0-3,page.rect.width-36,bbox.y1+4))
                if first_rect is None:first_rect=bbox
    if tender_rects:
        for rect in tender_rects:page.add_redact_annot(rect,fill=(1,1,1))
        page.apply_redactions()
        insert_x,insert_y=first_rect.x0,first_rect.y1-2
    else:
        insert_x,insert_y=128,(subject_rect.y0-28 if subject_rect else 330)
    if recipient_bottom is not None:
        insert_y=min(insert_y,recipient_bottom+14)
    page.insert_text((insert_x,insert_y),tender_text,fontsize=11,fontname="hebo",color=(0,0,0))

# The MAF/AUTHORIZATIONLETTER page's body paragraph (between "Dear Sir/Madam,"
# and the "Auth. Signatory" signature block) is replaced wholesale with the
# fixed MAF wording below — same approach as the Warranty/Make in India
# paragraph rewrites: redact the old block (including the old signature
# block), draw the new longer text, then redraw the signature block (and its
# signature image, extracted before the redaction wipes it) further down to
# make room.
def _fill_manufacturer_auth_body(page,fitz):
    def _lines():
        out=[]
        for block in page.get_text("dict").get("blocks",[]):
            if block.get("type")!=0:continue
            for line in block.get("lines",[]):
                text=" ".join(s["text"] for s in line.get("spans",[]))
                out.append((line["bbox"],text.strip()))
        out.sort(key=lambda lx:lx[0][1]);return out

    lines=_lines()
    dear_idx=next((i for i,(b,t) in enumerate(lines) if t.rstrip(",").strip().lower()=="dear sir/madam"),None)
    if dear_idx is None:return
    body_start=dear_idx+1
    contact_idx=next((i for i in range(body_start,len(lines)) if re.search(r"contact\s*no",lines[i][1],re.I)),None)
    if contact_idx is None:return

    region_x0=min(b[0] for b,t in lines[body_start:contact_idx+1] if t)
    region_y0=lines[body_start][0][1]
    region_x1=page.rect.width-42
    region_y1=lines[contact_idx][0][3]+4

    # Pull the signature stamp image out before it gets whited out, so it can
    # be redrawn lower down alongside the pushed-down signature block.
    sig_bytes=sig_w=sig_h=None
    for img in page.get_images(full=True):
        for r in page.get_image_rects(img[0]):
            if r.y0>=region_y0-20 and r.y1<=region_y1+10 and (r.x1-r.x0)<300:
                sig_bytes=page.parent.extract_image(img[0]).get("image")
                sig_w,sig_h=r.x1-r.x0,r.y1-r.y0
                break
        if sig_bytes:break

    page.add_redact_annot(fitz.Rect(region_x0-2,region_y0-2,region_x1,region_y1+2),fill=(1,1,1))
    page.apply_redactions()

    fontsize=10.5;line_height=14.5;x=region_x0;max_width=region_x1-x-4
    y=region_y0+9
    y=_draw_inline_paragraph(page,x,y,line_height,max_width,[
        ("This is to confirm that we, ",False),("Laps N Tabs Technology Pvt. Ltd",True),
        (", are Brand Holder of Brand ",False),("\"acxxel\"",True),(" and manufacturer.",False),
    ],fitz,fontsize=fontsize)
    y+=line_height*1.4
    for item in ["i. All in one Computer","ii. Desktop Computer","iii. Workstation Computer","iv. Multi Function Laser Printer","v. Laser Printer","vi. Printer Toner"]:
        page.insert_text((x+16,y),item,fontsize=fontsize,fontname="helv",color=(0,0,0))
        y+=line_height
    y+=line_height*0.4
    y=_draw_inline_paragraph(page,x,y,line_height,max_width,[
        ("All above products are listed on Gem under ",False),("Brand \"acxxel\"",True),(".",False),
    ],fitz,fontsize=fontsize)
    y+=line_height*1.4
    y=_draw_inline_paragraph(page,x,y,line_height,max_width,[
        ("Being OEM of the above products, we are directly participating. OEM are not required to "
         "furnish any authorization. The copy of the Brand Registration Certificate is attached.",False),
    ],fitz,fontsize=fontsize)
    y+=line_height*1.7

    page.insert_text((x,y),"Auth. Signatory",fontsize=10.5,fontname="hebo",color=(0,0,0));y+=line_height
    page.insert_text((x,y),"For Laps N Tabs Technology Pvt. Ltd.",fontsize=10.5,fontname="hebo",color=(0,0,0))
    sig_y=y+8
    if sig_bytes:
        page.insert_image(fitz.Rect(x+1.5,sig_y,x+1.5+(sig_w or 141),sig_y+(sig_h or 43)),stream=sig_bytes,keep_proportion=False)
        y=sig_y+(sig_h or 43)+10
    else:
        y=sig_y+10
    page.insert_text((x,y),"Name:-DevankRastogi",fontsize=10.5,fontname="hebo",color=(0,0,0));y+=line_height
    page.insert_text((x,y),"Designation:- Director",fontsize=10.5,fontname="hebo",color=(0,0,0));y+=line_height
    page.insert_text((x,y),"Email:- lapsntabs123@gmail.com",fontsize=10.5,fontname="hebo",color=(0,0,0));y+=line_height
    page.insert_text((x,y),"Contact No.:- 9918200166",fontsize=10.5,fontname="hebo",color=(0,0,0))

# The Service Support certificate's escalation-matrix table (Level 1/2/3, all
# static company contacts — nothing here comes from the bid) is redrawn from
# scratch with a 4th row inserted, rather than patched in place like the
# earlier single-line "Saurabh Singh -> Madhuri Pal" swap used to do, since
# adding a row means every row below it has to move down too.
def _fill_service_support_escalation(page,fitz):
    lines=[]
    for block in page.get_text("dict").get("blocks",[]):
        for line in block.get("lines",[]):
            t=" ".join(s.get("text","") for s in line.get("spans",[])).strip()
            if t:lines.append((fitz.Rect(line["bbox"]),t))
    lines.sort(key=lambda x:x[0].y0)
    if not any(t=="Level 1" for _,t in lines):return

    # The new table is taller than the old 3-row one (a 4th row, and Level 4's
    # value needs 3 wrapped lines to fit two email addresses) — so the
    # signature block below it (Auth. Signatory / company line / signature
    # image / Name-Designation-Email-Contact) has to move down to make room,
    # not just the table itself. Redact and redraw the whole thing as one unit.
    x0,x1=71.4,524.4;col_bounds=[71.4,184.32,302.4,524.4]
    table_top=301;block_bottom=565

    sig_bytes=sig_w=sig_h=None
    for img in page.get_images(full=True):
        for r in page.get_image_rects(img[0]):
            if r.y0>=table_top and r.y1<=block_bottom and (r.x1-r.x0)<250:
                sig_bytes=page.parent.extract_image(img[0]).get("image")
                sig_w,sig_h=r.x1-r.x0,r.y1-r.y0
                break
        if sig_bytes:break

    page.add_redact_annot(fitz.Rect(x0-2,table_top-2,x1+2,block_bottom),fill=(1,1,1))
    page.apply_redactions()

    rows=[
        ("Level 1","Toll free number","1800-313-9020",29,11),
        ("Level 2","Technical Support","9918200554",29,11),
        ("Level 3","Service Head","Madhuri Pal - 9519598884",29,11),
        ("Level 4","Director","Devank Rastogi -\ndevank.devlok@gmail.com,\ndevesh.rastogi@gmail.com",56,9),
    ]
    gap=3;y=table_top
    for level,label,value,row_height,value_fontsize in rows:
        for ci in range(3):
            page.draw_rect(fitz.Rect(col_bounds[ci],y,col_bounds[ci+1],y+row_height),fill=(0.847,0.847,0.847),color=None)
        page.insert_textbox(fitz.Rect(col_bounds[0],y,col_bounds[1],y+row_height),level,fontsize=11,fontname="hebo",align=1,color=(0,0,0))
        page.insert_textbox(fitz.Rect(col_bounds[1]+10,y,col_bounds[2]-4,y+row_height),label,fontsize=11,fontname="hebo",align=0,color=(0,0,0))
        value_box_h=len(value.split("\n"))*(value_fontsize+3)
        value_y=y+(row_height-value_box_h)/2
        page.insert_textbox(fitz.Rect(col_bounds[2]+6,value_y,col_bounds[3]-6,value_y+value_box_h+4),value,fontsize=value_fontsize,fontname="hebo",align=1,lineheight=1.2,color=(0,0,0))
        y+=row_height+gap

    y+=15
    page.insert_text((x0,y),"Auth. Signatory",fontsize=11,fontname="hebo",color=(0,0,0));y+=13.4
    page.insert_text((x0,y),"For Laps N Tabs Technology Pvt. Ltd.",fontsize=11,fontname="hebo",color=(0,0,0))
    sig_y=y+9
    if sig_bytes:
        page.insert_image(fitz.Rect(x0+1.5,sig_y,x0+1.5+(sig_w or 141),sig_y+(sig_h or 43)),stream=sig_bytes,keep_proportion=False)
        y=sig_y+(sig_h or 43)+9
    else:
        y=sig_y+9
    page.insert_text((x0,y),"Name:- Devank Rastogi",fontsize=11,fontname="hebo",color=(0,0,0));y+=13.4
    page.insert_text((x0,y),"Designation:- Director",fontsize=11,fontname="hebo",color=(0,0,0));y+=13.4
    page.insert_text((x0,y),"Email:- lapsntabs123@gmail.com",fontsize=11,fontname="hebo",color=(0,0,0));y+=13.4
    page.insert_text((x0,y),"Contact No.:- 9918200166",fontsize=11,fontname="hebo",color=(0,0,0))

def _add_service_support_bid_date(page,fitz,bid_no,date):
    if not (bid_no or date) or not page.search_for("Level 1"):return
    lines=[]
    for block in page.get_text("dict").get("blocks",[]):
        if block.get("type")!=0:continue
        for line in block.get("lines",[]):
            text=" ".join(span.get("text","") for span in line.get("spans",[])).strip()
            if text:lines.append((fitz.Rect(line["bbox"]),text))
    lines.sort(key=lambda item:item[0].y0)
    to_index=next((i for i,(_,text) in enumerate(lines) if text.rstrip(",").strip().lower()=="to"),None)
    certify_index=next((i for i,(_,text) in enumerate(lines) if re.search(r"this\s+is\s+certifying",text,re.I)),None)
    escalation_index=next((i for i,(_,text) in enumerate(lines) if re.search(r"escalation matrix",text,re.I)),None)
    if to_index is None or certify_index is None or certify_index<=to_index:return

    recipient_values=[
        text for _,text in lines[to_index+1:certify_index]
        if not re.search(r"(?:Tender|Bid)\s*No|Dated\s*:",text,re.I)
    ]
    certify_end=escalation_index if escalation_index is not None else certify_index+1
    certify_text=" ".join(text for _,text in lines[certify_index:certify_end]).strip()
    to_rect=lines[to_index][0]
    certify_rect=lines[certify_index][0]
    block_bottom=max((rect.y1 for rect,_ in lines[certify_index:certify_end]),default=certify_rect.y1)
    page.add_redact_annot(
        fitz.Rect(min(to_rect.x0,certify_rect.x0)-3,to_rect.y0-2,page.rect.width-32,block_bottom+3),
        fill=(1,1,1),
    )
    page.apply_redactions()

    x=to_rect.x0
    y=to_rect.y1-2
    line_gap=16.5
    page.insert_text((x,y),"To,",fontsize=11.5,fontname="hebo",color=(0,0,0))
    for value in recipient_values:
        y+=line_gap
        page.insert_text((x,y),value,fontsize=11.5,fontname="hebo",color=(0,0,0))
    y+=line_gap+2
    page.insert_text((x,y),f"Bid No: {bid_no or ''}    Dated: {date or ''}",fontsize=11.5,fontname="hebo",color=(0,0,0))
    y+=34
    page.insert_textbox(
        fitz.Rect(x,y-11,page.rect.width-36,y+18),certify_text,
        fontsize=10.5,fontname="helv",color=(0,0,0),lineheight=1.15,
    )

def _add_service_support_last_page_bid_date(page,fitz,bid_no,date,dept_name="",organization="",full_address=""):
    if not (bid_no or date):return
    lines=[]
    for block in page.get_text("dict").get("blocks",[]):
        if block.get("type")!=0:continue
        for line in block.get("lines",[]):
            text=" ".join(span.get("text","") for span in line.get("spans",[])).strip()
            if text:lines.append((fitz.Rect(line["bbox"]),text))
    lines.sort(key=lambda item:item[0].y0)
    to_index=next((i for i,(_,text) in enumerate(lines) if text.rstrip(",").strip().lower()=="to"),None)
    content_index=next((i for i,(_,text) in enumerate(lines) if re.search(r"As per (?:the )?Buyer ATC|Availability of Service Centres",text,re.I)),None)
    if to_index is None or content_index is None or content_index<=to_index+1:return
    if dept_name or organization or full_address:
        availability_index=next((i for i in range(content_index+1,len(lines)) if re.search(r"Availability of Service Centres",lines[i][1],re.I)),content_index+1)
        heading_text=" ".join(text for _,text in lines[content_index:availability_index]).strip()
        to_rect=lines[to_index][0]
        heading_bottom=max((rect.y1 for rect,_ in lines[content_index:availability_index]),default=lines[content_index][0].y1)
        page.add_redact_annot(
            fitz.Rect(to_rect.x0-3,to_rect.y0-2,page.rect.width-36,heading_bottom+3),
            fill=(1,1,1),
        )
        page.apply_redactions(images=0,graphics=0)
        x=to_rect.x0;y=to_rect.y1-2;line_gap=16.5
        for value in ["To,",dept_name,organization,full_address]:
            if value:
                page.insert_text((x,y),str(value).strip(),fontsize=11.5,fontname="hebo",color=(0,0,0))
                y+=line_gap
        page.insert_text((x,y),f"Bid No: {bid_no or ''}    Dated: {date or ''}",fontsize=11.5,fontname="hebo",color=(0,0,0))
        y+=38
        page.insert_textbox(
            fitz.Rect(x,y-12,page.rect.width-45,y+28),heading_text,
            fontsize=11,fontname="hebo",color=(0,0,0),lineheight=1.1,
        )
        return
    existing=[(rect,text) for rect,text in lines[to_index+1:content_index] if re.search(r"(?:Tender|Bid)\s*No|Dated\s*:",text,re.I)]
    for rect,_ in existing:
        page.add_redact_annot(fitz.Rect(rect.x0-3,rect.y0-2,page.rect.width-36,rect.y1+3),fill=(1,1,1))
    if existing:page.apply_redactions()
    recipient=[rect for rect,text in lines[to_index+1:content_index] if not re.search(r"(?:Tender|Bid)\s*No|Dated\s*:",text,re.I)]
    last_bottom=max((rect.y1 for rect in recipient),default=lines[to_index][0].y1)
    insert_y=min(last_bottom+34,lines[content_index][0].y0-10)
    page.insert_text(
        (lines[to_index][0].x0,insert_y),f"Bid No: {bid_no or ''}    Dated: {date or ''}",
        fontsize=11.5,fontname="hebo",color=(0,0,0),
    )

def _format_aio_service_center_heading(page,fitz):
    areas=[]
    for old_text in ("ACXXEL SERVICE PARTNERS","Acxxel SERVICE PARTNERS","acxxel SERVICE PARTNERS"):
        areas.extend(page.search_for(old_text))
    if not areas:return
    drawings=page.get_drawings();header_rects=[]
    for area in areas:
        center=((area.x0+area.x1)/2,(area.y0+area.y1)/2);candidates=[]
        for drawing in drawings:
            rect=fitz.Rect(drawing["rect"])
            if rect.contains(center) and rect.width>area.width+50 and rect.height>area.height+5:candidates.append(rect)
        suitable=[rect for rect in candidates if rect.height<100 and rect.width<page.rect.width-20]
        header_rects.append(max(suitable,key=lambda rect:rect.get_area()) if suitable else fitz.Rect(35,area.y0-5,page.rect.width-35,area.y0+48))
    for header_rect in header_rects:
        page.add_redact_annot(header_rect,fill=(1,1,0))
    page.apply_redactions(images=0,graphics=0)
    for area,header_rect in zip(areas,header_rects):
        page.draw_rect(header_rect,color=(0,0,0),fill=(1,1,0),width=0.9,overlay=True)
        heading="List Of acxxel Service Center In Major City"
        toll_text="TOLL FREE No. 1800-313-9020 / 9935497000"
        heading_size,toll_size=9,10
        heading_x=header_rect.x0+(header_rect.width-fitz.get_text_length(heading,fontname="hebo",fontsize=heading_size))/2
        toll_x=header_rect.x0+(header_rect.width-fitz.get_text_length(toll_text,fontname="hebo",fontsize=toll_size))/2
        page.insert_text((heading_x,header_rect.y0+13),heading,fontsize=heading_size,fontname="hebo",color=(0,0,0))
        page.insert_text((toll_x,min(header_rect.y0+29,header_rect.y1-5)),toll_text,fontsize=toll_size,fontname="hebo",color=(0,0,0))

def _add_aio_service_support_table_note(page,fitz):
    prefix="Note: For other locations, please email us at "
    email_text="support@acxxel.com"
    middle=" or visit our website "
    website_text="acxxel.com"
    suffix="."
    note=f"{prefix}{email_text}{middle}{website_text}{suffix}"
    if note in page.get_text("text").replace("\n"," "):return
    font_name,font_size="hebo",11;note_x,note_y=42,520
    prefix_width=fitz.get_text_length(prefix,fontname=font_name,fontsize=font_size)
    email_width=fitz.get_text_length(email_text,fontname=font_name,fontsize=font_size)
    middle_width=fitz.get_text_length(middle,fontname=font_name,fontsize=font_size)
    website_width=fitz.get_text_length(website_text,fontname=font_name,fontsize=font_size)
    email_x=note_x+prefix_width;middle_x=email_x+email_width;website_x=middle_x+middle_width
    page.insert_text((note_x,note_y),prefix,fontsize=font_size,fontname=font_name,color=(0,0,0))
    page.insert_text((email_x,note_y),email_text,fontsize=font_size,fontname=font_name,color=(0,0,1))
    page.insert_text((middle_x,note_y),middle,fontsize=font_size,fontname=font_name,color=(0,0,0))
    page.insert_text((website_x,note_y),f"{website_text}{suffix}",fontsize=font_size,fontname=font_name,color=(0,0,1))
    page.insert_link({"kind":fitz.LINK_URI,"from":fitz.Rect(email_x,note_y-12,email_x+email_width,note_y+3),"uri":"mailto:support@acxxel.com"})
    page.insert_link({"kind":fitz.LINK_URI,"from":fitz.Rect(website_x,note_y-12,website_x+website_width,note_y+3),"uri":"https://acxxel.com"})

def _fill_service_support_availability(page,fitz):
    # Last page of the Service Support cert — adds the "authorized service
    # center" intro line the template was missing, and swaps the old
    # "Since desktop has onsite warranty..." close for the buyer-facing
    # on-site paragraph. Uses the real Trebuchet MS (Bold/Regular) system
    # fonts since the template's embedded subset only covers the glyphs its
    # own original wording used.
    heading_top=block_bottom=None
    for block in page.get_text("dict").get("blocks",[]):
        for line in block.get("lines",[]):
            t=" ".join(s.get("text","") for s in line.get("spans",[])).strip()
            if t.startswith("Service & Support"):heading_top=line["bbox"][1]
            if t.startswith("Contact No.:-"):block_bottom=line["bbox"][3]
    if heading_top is None or block_bottom is None:return

    sig_bytes=sig_w=sig_h=None
    for img in page.get_images(full=True):
        for r in page.get_image_rects(img[0]):
            if r.width<250 and r.y0>400:
                sig_bytes=page.parent.extract_image(img[0]).get("image")
                sig_w,sig_h=r.width,r.height
                break
        if sig_bytes:break

    x0=72.0;max_width=471.0;fontsize=12;line_h=16.2;color=(0,0,0)
    try:
        bold_font=fitz.Font(fontfile="C:/Windows/Fonts/trebucbd.ttf")
        bold_buf=open("C:/Windows/Fonts/trebucbd.ttf","rb").read()
        reg_buf=open("C:/Windows/Fonts/trebuc.ttf","rb").read()
    except Exception:return

    def wrap(text,font,fontsize,max_width):
        words=text.split(" ");lines=[];cur=""
        for w in words:
            trial=(cur+" "+w).strip()
            if font.text_length(trial,fontsize=fontsize)<=max_width:cur=trial
            else:
                if cur:lines.append(cur)
                cur=w
        if cur:lines.append(cur)
        return lines

    # Wide enough on the right to also sweep up any overflow left behind by
    # _fix_aio_product_wording's un-wrapped single-line replacement on the
    # old "Since desktop has..." sentence (it can draw past the paragraph's
    # normal right margin when the swapped-in wording is longer).
    page.add_redact_annot(fitz.Rect(x0-4,heading_top-2,page.rect.width-20,block_bottom+4),fill=(1,1,1))
    page.apply_redactions()

    page.insert_font(fontname="ssbold",fontbuffer=bold_buf)
    page.insert_font(fontname="ssreg",fontbuffer=reg_buf)

    y=heading_top+11
    intro="As per the Buyer ATC 'Service and Support' clause in the availability guidance, the authorized service center is as follows"
    for ln in wrap(intro,bold_font,fontsize,max_width):
        page.insert_text((x0,y),ln,fontsize=fontsize,fontname="ssbold",color=color);y+=line_h
    y+=10

    quote=("\u201cAvailability of Service Centres: Bidder/OEM must have a Functional Service Centre "
           "in the State of each Consignee's Location in case of carry-in warranty. (Not applicable "
           "in case of goods having on-site warranty). If service center is not already there at the "
           "time of bidding, successful bidder/ OEM shall have to establish one within 30 days of "
           "award of contract. Payment shall be released only after submission of documentary "
           "evidence of having Functional Service Centre\u201d.")
    for ln in wrap(quote,bold_font,fontsize,max_width):
        page.insert_text((x0,y),ln,fontsize=fontsize,fontname="ssbold",color=color);y+=line_h
    y+=10

    closing=("The product offered in the bid will be serviced on-site at the location of the buyer. "
             "The above clause is not applicable to this bid. We also undertake that once the order is "
             "released, we shall appoint a service center within the prescribed time, in case the "
             "location of the buyer is not already covered by an existing service center.")
    for ln in wrap(closing,bold_font,fontsize,max_width):
        page.insert_text((x0,y),ln,fontsize=fontsize,fontname="ssbold",color=color);y+=line_h
    y+=26

    sig_fontsize=9.94
    page.insert_text((x0,y),"Auth. Signatory",fontsize=sig_fontsize,fontname="ssreg",color=color);y+=13.4
    page.insert_text((x0,y),"For Laps N Tabs Technology Pvt. Ltd.",fontsize=sig_fontsize,fontname="ssreg",color=color)
    sig_y=y+8
    if sig_bytes:
        page.insert_image(fitz.Rect(x0+1.5,sig_y,x0+1.5+(sig_w or 141),sig_y+(sig_h or 43)),stream=sig_bytes,keep_proportion=False)
        y=sig_y+(sig_h or 43)+8
    else:
        y=sig_y+8
    page.insert_text((x0,y),"Name:- Devank Rastogi",fontsize=sig_fontsize,fontname="ssreg",color=color);y+=13.4
    page.insert_text((x0,y),"Designation:- Director",fontsize=sig_fontsize,fontname="ssreg",color=color);y+=13.4
    page.insert_text((x0,y),"Email:- lapsntabs123@gmail.com",fontsize=sig_fontsize,fontname="ssreg",color=color);y+=13.4
    page.insert_text((x0,y),"Contact No.:- 9918200166",fontsize=sig_fontsize,fontname="ssreg",color=color)

# ---- Warranty + Make in India certificate fills. Same documents.pdf template
# and redaction approach as Desktop's generate_certificates, adapted to say
# "ACXXEL All in One PC" instead of "acxxel DESKTOP" and to AIO's own fields
# (single ssd, no cabinet, local_content instead of Desktop's separate field).
def _format_model_number(model):
    if not model:return ""
    model=re.sub(r"\s+"," ",re.sub(r"^[-\s]+|[-\s]+$","",model.strip()))
    return model

def _normalize_warranty_text(value):
    value=str(value or "").strip()
    if not value:return ""
    m=re.search(r"\d+",value)
    if m:
        years=m.group(0);return f"{years} {'year' if years=='1' else 'years'}"
    return value

def _shrink_for_cell(area,fitz,pad_x=2,pad_y=1):
    return fitz.Rect(area.x0+pad_x,area.y0+pad_y,area.x1-pad_x,area.y1-pad_y)

def _get_cell_bg_color(page,rect,fitz):
    try:
        for d in page.get_drawings():
            if d.get("fill") and d.get("rect"):
                dr=fitz.Rect(d["rect"])
                if dr.intersects(rect) and dr.get_area()>100:
                    fill=d["fill"]
                    if fill and len(fill)>=3:
                        r,g,bch=fill[0],fill[1],fill[2]
                        if not (r>0.97 and g>0.97 and bch>0.97):return (r,g,bch)
    except Exception:pass
    return (0.94,0.94,0.94)

def _text_width(text,fontsize,fitz,bold=False):
    try:
        return fitz.Font("hebo" if bold else "helv").text_length(text,fontsize=fontsize)
    except Exception:
        return len(text)*fontsize*0.55

def _draw_inline_paragraph(page,x,y,line_height,max_width,segments,fitz,fontsize=11):
    word_tokens=[]
    for text_chunk,is_bold in segments:
        for w in text_chunk.split(" "):
            if w:word_tokens.append((w,is_bold))
    current_line=[];current_width=0.0;cur_y=y
    def render_line(line_tokens,base_y):
        cx=x
        for word,bold in line_tokens:
            page.insert_text((cx,base_y),word,fontsize=fontsize,fontname="hebo" if bold else "helv",color=(0,0,0))
            cx+=_text_width(word+"  ",fontsize,fitz,bold)
    for word,is_bold in word_tokens:
        w_width=_text_width(word+"  ",fontsize,fitz,is_bold)
        if current_line and (current_width+w_width)>max_width:
            render_line(current_line,cur_y);cur_y+=line_height;current_line=[(word,is_bold)];current_width=w_width
        else:
            current_line.append((word,is_bold));current_width+=w_width
    if current_line:render_line(current_line,cur_y)
    return cur_y

def _fill_warranty_page(page,fitz,bid_no,model_number,warranty_text):
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
        f"All in One PC Brand and will provide comprehensive warranty during entire standard "
        f"warranty period i.e. {normalized_warranty} for quoted acxxel All in One PC "
        f"{formatted_model}, if the said bid award to us."
    )
    para_rect=fitz.Rect(82,314,page.rect.width-42,374)
    page.add_redact_annot(para_rect,fill=(1,1,1));page.apply_redactions()
    page.insert_textbox(para_rect,paragraph,fontsize=10.5,fontname="hebo",color=(0,0,0),align=0)
    # NOTE: there used to be a second pass here that re-scanned the whole page
    # for stray "AXL-.../ACXXEL.../Model No:" text and redid the model-number
    # insert on any match. The warranty template's only model reference is
    # inside the paragraph above (confirmed against documents.pdf page 6) —
    # so that pass was re-matching the text it had just correctly written,
    # then re-inserting it with page.insert_text's single-line placement
    # instead of the textbox's wrapped layout, which knocked the model number
    # out to its own misaligned line after "...award to us." with a stray
    # comma. Removed; the f-string above already puts it in the right spot.

def _fill_make_in_india_page(page,fitz,bid_no,model_number,dept_name,organization,full_address,bid_date_formatted,local_content):
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
            ("This is to certify that ",False),("acxxel All in One PC ",True),
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
                # The "MAKE IN INDIA CERTIFICATE" heading (blue, underlined)
                # sits in this same window between the recipient block and the
                # table — it must never be swept into address_lines or the
                # redaction below erases it with nothing reinserted in its place.
                if re.search(r"make\s*in\s*india\s*certificate",text,re.I):continue
                # The "This is to certify..." intro paragraph (already
                # redacted+rewritten above) also sits in this same window —
                # its freshly-drawn lines must not be re-swept into
                # address_lines either, or they get white-redacted again with
                # nothing reinserted, leaving the paragraph blank.
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

    # Position-based table fill: the "Sr.No / Description / Local Content" row
    # cells are extracted by PyMuPDF as separate text lines whose *order*
    # doesn't reliably reflect the visual table (and description text like
    # "AXL-AIO0006" itself contains digits, which broke a naive regex over the
    # raw text). Instead, find each "NN%" content cell, then find the widest
    # text line sitting on roughly the same row to its left as the description.
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

    # A separate "ACXXEL DESKTOP MODEL <stale-model>" caption sits below the
    # table (leftover sample text, not part of the intro paragraph or the
    # table cells handled above) — same "desktop"-wording + stale-model bug
    # as elsewhere, needs its own fix here.
    if formatted_model:
        for bbox,text in _lines():
            if re.search(r"ACXXEL",text,re.I) and re.search(r"MODEL",text,re.I) and fitz.Rect(bbox).y0>=min_table_y:
                area=fitz.Rect(bbox)
                page.add_redact_annot(fitz.Rect(area.x0-1,area.y0-1,page.rect.width-36,area.y1+1),fill=(1,1,1))
                page.apply_redactions()
                page.insert_text((area.x0,area.y1-2),f"acxxel ALL IN ONE PC MODEL {formatted_model}",fontsize=10.5,fontname="hebo",color=(0,0,0))
                break
# --- Technical Compliance Certificate / Product Data Sheet -----------------
# Desktop draws these two documents entirely from code onto blank pages (only
# the header banner image is reused from the shared documents.pdf template) —
# it does NOT stamp values onto a pre-printed page, so nothing here is locked
# to Desktop-tower-only fields (PCIe slot counts, cabinet form factor, etc).
# These AIO versions use the exact same table layout/columns/fonts as Desktop
# ("same to same" look) but every row is built from AIO's own captured spec
# fields (processor/ram/os/storage/screen_size/wifi/keyboard/warranty/ports).
# The Processor/Screen Size "Allowed Values" now list AIO's own real option
# catalogues (same as Desktop's own certificate does for its processor list —
# AIO shares that exact PROCESSORS catalogue, see AioConfig.jsx) instead of
# "Refer Product Data Sheet" — every other cell is a value actually stored on
# the bid.
_TC_PROCESSOR_ALLOWED=(
    "Intel Core i3: 12100, 14100\n"
    "Intel Core i5: 12400, 14400\n"
    "Intel Core i7: 12700, 14700\n"
    "Intel Core i9: 14900\n"
    "Intel Ultra 5: 225, 245K | Ultra 7: 265K\n"
    "AMD Ryzen 3: 4300G, 5300G\n"
    "AMD Ryzen 5: 5600G, 8500G\n"
    "AMD Ryzen 7: 5700G | Ryzen 9: 9300G\n"
    "12th/13th Gen Embedded: i5, i7 Or higher"
)
_TC_SCREEN_SIZE_ALLOWED="21 inch | 24 inch | 27 inch"
def _tc_ram_type(value):
    text=str(value or "");m=re.search(r'\bDDR\s*([345])\b',text,re.IGNORECASE)
    return f"DDR{m.group(1)}" if m else text
def _tc_ram_size(value):
    text=str(value or "");m=re.search(r'\b(\d+)\s*GB\b',text,re.IGNORECASE)
    return m.group(1) if m else text
def _tc_keyboard_connectivity(value):
    text=str(value or "")
    if re.search(r'wireless',text,re.IGNORECASE):return "Wireless"
    if re.search(r'wired|usb',text,re.IGNORECASE):return "Wired"
    return text
def _tc_graphics_type(value):
    text=str(value or "").strip()
    if not text:return "Integrated"
    if re.search(r'dedicated|graphic card|gpu',text,re.IGNORECASE):return "Dedicated"
    if re.search(r'integrated|uhd|vega',text,re.IGNORECASE):return "Integrated"
    return text

def _add_authorized_signatory(page,fitz,signature_image,y=685,compact=False):
    x=58;header_height=20 if compact else 24;signature_top=19 if compact else 23;signature_bottom=50 if compact else 62
    signature_width=132 if compact else 145;details_top=51 if compact else 63;details_bottom=91 if compact else 112
    font_size=7.5 if compact else 8.2
    page.insert_textbox(fitz.Rect(x,y,page.rect.width-45,y+header_height),"Auth. Signatory\nFor Laps N Tabs Technology Pvt. Ltd.",fontsize=font_size,fontname="hebo",lineheight=1.05)
    if signature_image:
        page.insert_image(fitz.Rect(x,y+signature_top,x+signature_width,y+signature_bottom),stream=signature_image,keep_proportion=False)
    page.insert_textbox(fitz.Rect(x,y+details_top,page.rect.width-45,min(page.rect.height-5,y+details_bottom)),"Name:- Devank Rastogi\nDesignation:- Director\nEmail:- lapsntabs123@gmail.com\nContact No.:- 9918200166",fontsize=font_size,fontname="hebo",lineheight=1.0 if compact else 1.05)

def _fill_aio_technical_compliance_page1(page,fitz,bid_no,b):
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
    description=str(b.pro_descp or "").strip() or "All in One PC"
    if model_number and model_number not in description:description=f"{description} Model: {model_number}".strip()
    rows=[
        (190,280,"Description of Store","All in One PC with Integrated Monitor, Compatible Chipset as per Processor make with Minimum 4 USB Port",description,8.0),
        (280,410,"Processor Number",_TC_PROCESSOR_ALLOWED,b.processor,7.2),
        (410,458,"Mouse Connectivity","Wired | Wireless Or higher",_tc_keyboard_connectivity(b.keyboard),8.5),
        (458,506,"Keyboard Connectivity","Wired | Wireless Or higher",_tc_keyboard_connectivity(b.keyboard),8.5),
        (506,550,"Graphics Type","Integrated",_tc_graphics_type(b.gp),8.5),
        (550,618,"Operating System\n(Factory Preloaded with Certification)","Windows 11 Home\nWindows 11 Professional\nDOS | Linux",b.os,8.5),
        (618,664,"Type of RAM","DDR4 | DDR5 Or higher",_tc_ram_type(b.ram),8.5),
        (664,710,"RAM Size (GB)","8 | 16 | 32 | 64 GB Or higher",_tc_ram_size(b.ram),8.5),
    ]
    groups=[("DESCRIPTION",190,280),("PROCESSOR",280,410),("INPUT DEVICES",410,506),("GRAPHICS",506,550),("OPERATING\nSYSTEM",550,618),("MEMORY",618,710)]
    for g,top,bottom in groups:
        rect=fitz.Rect(columns[0],top,columns[1],bottom)
        page.draw_rect(rect,color=(0.45,0.45,0.45),width=0.65)
        page.insert_textbox(rect+(5,8,-5,-5),g,fontsize=6.8,fontname="hebo",color=(0,0,0))
    for top,bottom,title,allowed,offered,afs in rows:
        for idx,val in enumerate([title,allowed,offered],start=1):
            rect=fitz.Rect(columns[idx],top,columns[idx+1],bottom)
            page.draw_rect(rect,color=(0.45,0.45,0.45),width=0.65)
            page.insert_textbox(rect+(5,8,-5,-5),str(val or ""),fontsize=afs if idx==2 else 8.3,fontname="helv",color=(0,0,0),align=0)

def _fill_aio_technical_compliance_page2(page,fitz,b):
    heading="Technical Compliance Certificate";hw=fitz.get_text_length(heading,fontname="hebo",fontsize=14)
    page.insert_text(((page.rect.width-hw)/2,150),heading,fontsize=14,fontname="hebo",color=(0,0,0))
    columns=[52,115,220,395,543];header_top,header_bottom=178,208;headers=["Specification","Title","Allowed Values","Offered"]
    for i,h in enumerate(headers):
        rect=fitz.Rect(columns[i],header_top,columns[i+1],header_bottom)
        page.draw_rect(rect,color=(0.35,0.35,0.35),fill=(0.92,0.94,0.97),width=0.7)
        page.insert_textbox(rect+(5,8,-4,-3),h,fontsize=8.5,fontname="hebo",color=(0,0,0))
    storage_offered=", ".join(v for v in [str(b.hdd or "").strip(),str(b.ssd or "").strip()] if v and v.lower() not in ("none","no","n/a")) or "None"
    rows=[
        (208,280,"STORAGE","Storage Configuration","HDD: 1 TB, 2 TB\nSSD SATA/NVMe: 128 GB, 256 GB, 512 GB, 1 TB",storage_offered),
        (280,336,"DISPLAY","Integrated Screen Size",_TC_SCREEN_SIZE_ALLOWED,b.screen_size),
        (336,392,"NETWORK","WiFi / Bluetooth","Wired | Wireless Or higher",b.wifi),
        (392,448,"WARRANTY","On Site OEM Warranty\n(In year)","1, 2, 3, 4, 5, 6, 7 Years Or higher",b.warranty),
    ]
    for top,bottom,spec,title,allowed,offered in rows:
        for idx,val in enumerate([spec,title,allowed,offered]):
            rect=fitz.Rect(columns[idx],top,columns[idx+1],bottom)
            page.draw_rect(rect,color=(0.45,0.45,0.45),width=0.65)
            page.insert_textbox(rect+(5,8,-5,-5),str(val or ""),fontsize=8.5 if idx!=2 else 8.2,fontname="hebo" if idx==0 else "helv",color=(0,0,0),align=0)

def _fill_aio_data_sheet_page(page,fitz,page_index,b):
    heading="All in One PC Product Data Sheet";hw=fitz.get_text_length(heading,fontname="hebo",fontsize=14)
    page.insert_text(((page.rect.width-hw)/2,122),heading,fontsize=14,fontname="hebo",color=(0,0,0))
    model_number=_format_model_number(f"{b.model_no}{b.model}".strip())
    if page_index==0:
        sections=[
            ("PRODUCT DETAILS",[("Model Number",model_number),("Brand","acxxel"),("Product Type","All in One PC")]),
            ("PROCESSOR",[("Processor Number",b.processor)]),
            ("OPERATING SYSTEM & MEMORY",[("Factory Pre-loaded Operating System",b.os),("Type of RAM",_tc_ram_type(b.ram)),("RAM Size",(_tc_ram_size(b.ram)+" GB") if _tc_ram_size(b.ram)!=str(b.ram or "") else b.ram)]),
            ("MONITOR",[("Integrated Screen Size",b.screen_size)]),
            ("CONNECTIVITY & PORTS",[("WiFi / Bluetooth",b.wifi),("Ports",b.motherboard)]),
        ]
    else:
        sections=[
            ("STORAGE",[("Hard Disk Drive",b.hdd),("Solid State Drive",b.ssd)]),
            ("OPTICAL DRIVE",[("DVD / Optical Drive",b.dvd)]),
            ("INPUT DEVICES",[("Keyboard & Mouse",b.keyboard)]),
            ("ADDITIONAL DETAILS",[("On Site OEM Warranty",b.warranty)]),
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
def generate_aio_documents(r,bid_id):
    if r.method!="POST":return JsonResponse({"error":"POST required"},status=405)
    _ensure_table();b=AioBid.objects.filter(id=bid_id).first()
    if not b:return JsonResponse({"error":"AIO bid not found"},status=404)
    typ=_data(r).get("doc_type","");ranges={"manufacturer_auth":(2,4),"make_in_india":(5,5),"warranty":(6,6),"bidder_financial":(7,7),"non_obsolete":(8,8),"non_malicious":(16,16),"non_return_hdd":(17,17),"technical_compliance":(18,18),"non_blacklisting":(20,20),"ipv6":(21,21),"preloaded_os":(22,22),"service_support":(25,30),"data_sheet":(31,32)}
    static={"experience_certificate":"experience_certificate.pdf","past_performance":"past_performance.pdf","oem_annual_turnover":"oem_annual_turnover.pdf","atc_acceptance_letter":"atc_acceptance_letter.pdf"}
    # experience_certificate/past_performance use AIO's own real GeM contract
    # history export (Aioexp.pdf) instead of Desktop's copies — it sits
    # directly in templates/, not templates/static_documents/ like everything
    # in `static` above. Both doc types intentionally point at the same file
    # per explicit request.
    aio_static_overrides={"experience_certificate":"Aioexp.pdf","past_performance":"Aioexp.pdf"}
    if typ in ("approved_all_documents","approved_atc_documents") and b.status!="approved":
        return JsonResponse({"error":"Only approved bids can be downloaded"},status=403)
    try:
        import fitz
        out=os.path.join(settings.MEDIA_ROOT,"generated","aio");os.makedirs(out,exist_ok=True);name=f"aio_{b.id}_{typ}.pdf";path=os.path.join(out,name);date=b.date.strftime("%d-%m-%Y") if b.date else "";addr=f"{b.address} - {b.pincode}" if b.pincode else str(b.address or "")
        model_number=f"{b.model_no}{b.model}".strip()
        # Same as Desktop's generate_certificates: prefer whatever the Admin
        # has just typed into the still-unsaved form (so clicking Generate
        # right after typing Local Content shows it immediately, without
        # first having to click Approve to persist it) and fall back to the
        # saved value otherwise.
        local_content=str(_data(r).get("local_content") or b.local_content or "").strip()
        if typ in static:
            src=(os.path.join(settings.MEDIA_ROOT,"templates",aio_static_overrides[typ]) if typ in aio_static_overrides
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
                _fill_warranty_page(p,fitz,b.bid_no,model_number,b.warranty)
            else:
                _fill_make_in_india_page(p,fitz,b.bid_no,model_number,b.dept_name,b.organization,addr,date,local_content)
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
                _fill_aio_technical_compliance_page1(d[0],fitz,b.bid_no,b)
                _fill_aio_technical_compliance_page2(d[1],fitz,b)
                _add_authorized_signatory(d[1],fitz,signature_image,y=470)
            else:
                _fill_aio_data_sheet_page(d[0],fitz,0,b)
                bottom=_fill_aio_data_sheet_page(d[1],fitz,1,b)
                _add_authorized_signatory(d[1],fitz,signature_image,y=min(bottom+8,720),compact=True)
            d.save(path);d.close();m.close()
        elif typ in ranges:
            src=os.path.join(settings.MEDIA_ROOT,"templates","documents.pdf");m=fitz.open(src);d=fitz.open();start,end=ranges[typ];d.insert_pdf(m,from_page=start-1,to_page=end-1)
            for pidx,p in enumerate(d):
                if typ=="service_support" and pidx==1:_format_aio_service_center_heading(p,fitz)
                if not (typ=="manufacturer_auth" and pidx==2):_fix_aio_product_wording(p,fitz)
                if typ=="bidder_financial":_replace_bidder_financial_heading(p,fitz)
                if typ=="service_support":
                    _erase_tender(p,fitz);_fill_service_support_escalation(p,fitz);_fill_service_support_availability(p,fitz)
                    if pidx==4:_add_aio_service_support_table_note(p,fitz)
                    for block in p.get_text("dict").get("blocks",[]):
                        for line in block.get("lines",[]):
                            t=" ".join(s.get("text","") for s in line.get("spans",[]));n=re.sub(r"\s+"," ",re.sub(r"[^A-Za-z\s]"," ",t).upper()).strip()
                            if re.search(r"TO\s+WHOM.*MAY\s+CONCERN",n):
                                x=fitz.Rect(line["bbox"]);p.add_redact_annot(fitz.Rect(x.x0-4,x.y0-3,p.rect.width-36,x.y1+3),fill=(1,1,1));p.apply_redactions();y=max(92,x.y0-24);p.insert_textbox(fitz.Rect(62,y,p.rect.width-62,y+110),"\n".join(v for v in ["To,",b.dept_name,b.organization,addr] if v),fontsize=11,fontname="hebo",lineheight=1.15);break
                    if pidx==0:_add_service_support_bid_date(p,fitz,b.bid_no,date)
                    if pidx==len(d)-1:_add_service_support_last_page_bid_date(p,fitz,b.bid_no,date,b.dept_name,b.organization,addr)
                elif typ=="manufacturer_auth" and pidx==2:
                    # Template page 4 = the official Trade Mark Certificate, a legal
                    # source document — must stay byte-for-byte visually unchanged
                    # (same rule Desktop applies to this exact page).
                    pass
                elif typ=="manufacturer_auth" and pidx==1:
                    # Template page 3 = "Declaration of OEM Status on GeM" — this page
                    # has no Bid No/Dated line of its own in the template, so only
                    # strip any stray tender text; never blind-insert one (that's what
                    # was overlapping the Udyog Aadhar/DIPP lines here before).
                    _erase_tender(p,fitz)
                else:
                    recipient_bottom=_fill_recipient_block(p,fitz,b.dept_name,b.organization,addr)
                    _force_tender_no_date(p,fitz,b.bid_no,date,recipient_bottom)
                    if typ=="manufacturer_auth" and pidx==0:
                        _fill_manufacturer_auth_body(p,fitz)
            d.save(path);d.close();m.close()
        elif typ=="approved_price_paper":
            # Same to same as Desktop's own "approved_price_paper" (Desktop.py)
            # — the one-page "Approved Details For Bidding" summary shown when
            # the Analyser opens a bid from the Approved tab.
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
            # Same to same as Desktop's approved_all_documents/approved_atc_documents
            # bundling (Desktop.py) — merges AIO's own already-working individual
            # certificates into one PDF with a leading index page, instead of
            # duplicating each document's generation logic here.
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
                child_request=factory.post(f"/api/aio-bids/{bid_id}/generate-docs/",data=json.dumps({"doc_type":child_id}),content_type="application/json",HTTP_HOST=r.get_host())
                child_response=generate_aio_documents(child_request,bid_id)
                if child_response.status_code!=200:return None
                child_path=os.path.join(out,f"aio_{bid_id}_{child_id}.pdf")
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
                out_name=_build_index_and_bundle("Index of all approved documents",groups,True,f"aio_{bid_id}_all_approved_documents.pdf")
                if out_name is None:return JsonResponse({"error":"No approved documents available"},status=400)
            else:
                if not selected_atc_ids:return JsonResponse({"error":"No ATC-related documents selected"},status=400)
                groups=[("ATC DOCUMENTS",[(cid,atc_labels[cid]) for cid in selected_atc_ids])]
                out_name=_build_index_and_bundle("Index of documents file with ATC",groups,False,f"aio_{bid_id}_approved_atc_documents.pdf")
                if out_name is None:return JsonResponse({"error":"No ATC-related documents selected"},status=400)
            return JsonResponse({"message":f"{typ} generated","pdf_url":r.build_absolute_uri(f"{settings.MEDIA_URL}generated/aio/{out_name}")+f"?v={int(time.time())}"})
        else:return JsonResponse({"error":f"Invalid doc_type: '{typ}'"},status=400)
        _add_aio_page_numbers(path,fitz)
        return JsonResponse({"message":f"{typ} generated","pdf_url":r.build_absolute_uri(f"{settings.MEDIA_URL}generated/aio/{name}")+f"?v={int(time.time())}"})
    except Exception as e:return JsonResponse({"error":f"Document generation failed: {e}"},status=500)
