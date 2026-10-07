"""A user's final bid submit must carry at least one document."""
import json

MISSING_DOCUMENTS_ERROR = "Please select at least one document or upload the special document before submitting."


def has_bid_documents(bid, selected_general_docs):
    """True when the bid has a special document (just uploaded or saved
    earlier) or at least one general document is selected.

    ``selected_general_docs`` is the posted JSON list, or an already parsed list.
    """
    if bid.atc_special_document:
        return True
    docs = selected_general_docs
    if isinstance(docs, str):
        try:
            docs = json.loads(docs or "[]")
        except ValueError:
            return False
    return isinstance(docs, list) and any(str(doc).strip() for doc in docs)
