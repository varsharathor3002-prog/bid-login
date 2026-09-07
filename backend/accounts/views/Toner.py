import json
from django.db import connection, models
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from ..models import User

# Only Step 1 (Create Bid) + Step 2 (Config) exist for now — same scope as
# what CreateTonerBid.jsx/TonerConfig.jsx wire up. No GeM upload, document
# generation, analyser/admin review yet (that's AIO's Aio.py — this file
# intentionally stays minimal until Toner grows past these two steps).
class TonerBid(models.Model):
    user=models.ForeignKey(User,null=True,blank=True,on_delete=models.SET_NULL); username=models.CharField(max_length=150,blank=True,default="")
    bid_no=models.CharField(max_length=150); dept_name=models.CharField(max_length=255,blank=True,default=""); organization=models.CharField(max_length=255,blank=True,default="")
    qty=models.PositiveIntegerField(default=1); date=models.DateField(null=True,blank=True)
    atc=models.TextField(blank=True,default=""); address=models.TextField(blank=True,default=""); pincode=models.CharField(max_length=20,blank=True,default="")
    # ---- Config step fields, straight off Toner_Main_Specifications.pdf ----
    brand=models.CharField(max_length=100,blank=True,default=""); cartridge_type=models.CharField(max_length=100,blank=True,default=""); colour=models.CharField(max_length=50,blank=True,default="")
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
    unit_price=models.DecimalField(max_digits=12,decimal_places=2,default=0); total_price=models.DecimalField(max_digits=14,decimal_places=2,default=0)
    status=models.CharField(max_length=30,default="draft")
    created_at=models.DateTimeField(auto_now_add=True); updated_at=models.DateTimeField(auto_now=True)
    class Meta: app_label="accounts"; db_table="accounts_tonerbid"; ordering=["-created_at"]

FIELDS=["bid_no","dept_name","organization","qty","date","atc","address","pincode",
    "brand","cartridge_type","colour","compatibility","technology","cartridge_quality","page_yield",
    "yield_standard","toner_capacity","yield_type","drum","chip","print_coverage","packaging","shelf_life",
    "warranty","warranty_type","oem_equivalent","refillable","qty_per_pack","hsn_code","compliance",
    "replacement_policy","unit_price","total_price"]
PRICES={"unit_price","total_price"}

# Same lazy-create-the-table approach as AIO's _ensure_table (Aio.py) — no
# formal migration for this model, the schema is created/patched here at
# request time instead.
def _ensure_table():
    table=TonerBid._meta.db_table
    if table not in connection.introspection.table_names():
        with connection.schema_editor() as e:e.create_model(TonerBid)
        return
    with connection.cursor() as c: existing={x.name for x in connection.introspection.get_table_description(c,table)}
    with connection.schema_editor() as e:
        for f in TonerBid._meta.local_fields:
            if f.column not in existing:e.add_field(TonerBid,f)

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

def _json(b):
    out={}
    for f in b._meta.concrete_fields:
        k=f.attname if isinstance(f,models.ForeignKey) else f.name; v=getattr(b,k)
        if hasattr(v,"isoformat"):v=v.isoformat()
        elif v is not None and f.get_internal_type()=="DecimalField":v=float(v)
        out[k]=v
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
    _assign(b,_data(r)); b.status="submitted";b.save();return JsonResponse({"message":"Toner bid saved","bid":_json(b)})

def get_toner_bid(r,bid_id):
    _ensure_table();b=TonerBid.objects.filter(id=bid_id).first();return JsonResponse(_json(b) if b else {"error":"Toner bid not found"},status=200 if b else 404)
