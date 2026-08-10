# Privacy Dashboard Answers

## Single purpose

Transfer an authorized employee's approved Acxxel Desktop catalogue job into the
corresponding GeM Add New Offering form while keeping GeM authentication,
navigation, review and final submission under user control.

## Permission justifications

### storage

Stores the time-limited Acxxel extension token and active job identifier so the
workflow can continue across GeM's multi-step catalogue pages.

### tabs

Opens the GeM login page when the user explicitly starts an approved GeM upload
job from Acxxel.

### Host access: Acxxel

Connects to the organization's Acxxel frontend and API to authenticate the
employee, retrieve their assigned approved job, download approved documents and
images, and report workflow status.

### Host access: `https://*.gem.gov.in/*`

Detects and fills GeM Add New Offering controls on pages opened and navigated to
by the user.

## Data-use declarations

Declare:

- Authentication information
- Website content
- Form data

Do not declare sale, advertising, credit, or unrelated analytics. Certification:
data is used only for the extension's disclosed single purpose and complies with
the Chrome Web Store Limited Use requirements.

## Privacy policy URL

Deploy `frontend/public/gem-extension-privacy.html` on the production HTTPS
frontend and enter that public URL in the dashboard.

