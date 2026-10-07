"""Who is making this request, taken from the signed login token.

Names like analyser_username / admin_username used to come from the request
body, which the browser filled from localStorage. localStorage is shared by
every tab, so a login in one tab (e.g. admin) silently changed the name another
tab (e.g. analyser) submitted. The signed token can't be mixed up that way, so
whenever a valid one is sent it decides the name; the body value is only a
fallback for older clients that don't send a token.
"""
from django.core import signing

from .models import User

TOKEN_SALT = "gem-api-auth"
TOKEN_MAX_AGE = 12 * 60 * 60


def request_user(request):
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    try:
        payload = signing.loads(header[7:], salt=TOKEN_SALT, max_age=TOKEN_MAX_AGE)
        user = User.objects.filter(id=int(payload["user_id"])).first()
    except (KeyError, TypeError, ValueError, signing.BadSignature):
        return None
    if not user or user.role != payload.get("role"):
        return None
    return user


def actor_name(request, fallback=""):
    user = request_user(request)
    if user:
        return user.username
    return (fallback or "").strip()
