"""Serve a generated bid PDF as a real file download.

The download pages used to fetch() the PDF into a JS Blob and save that. Large
bundles (All Documents is 10-15 MB) fail that way in some browsers with
"Failed to fetch". Pointing the browser straight at this URL lets Chrome's own
download manager stream the file to disk instead.
"""
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, JsonResponse
from django.views.decorators.http import require_GET

GENERATED_ROOT = (Path(settings.MEDIA_ROOT) / "generated").resolve()


@require_GET
def download_generated_pdf(request):
    rel = (request.GET.get("path") or "").split("?", 1)[0]
    # Accept either "generated/aio/x.pdf" or the full "/media/generated/..." URL path.
    rel = rel.split("/media/", 1)[-1].lstrip("/")
    if rel.startswith("generated/"):
        rel = rel[len("generated/"):]
    target = (GENERATED_ROOT / rel).resolve()
    if GENERATED_ROOT not in target.parents or target.suffix.lower() != ".pdf" or not target.is_file():
        return JsonResponse({"error": "File not found"}, status=404)

    name = (request.GET.get("name") or target.name).replace("/", "_").replace("\\", "_")
    if not name.lower().endswith(".pdf"):
        name += ".pdf"
    return FileResponse(open(target, "rb"), as_attachment=True, filename=name, content_type="application/pdf")
