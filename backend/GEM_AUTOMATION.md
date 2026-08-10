# GeM Desktop Extension

GeM login, captcha, and OTP are always completed manually in the user's normal
Chrome browser. Django never opens or authenticates a GeM browser session.

## Security

Set the same encryption key for every Django process:

```powershell
$env:GEM_ENCRYPTION_KEY = "<secret-from-your-password-manager>"
```

Saved account passwords are write-only records. They are never returned by an
API and are never sent to the Chrome extension.

The extension stores only the signed Acxxel employee token. That token identifies
the employee and authorizes assigned-job APIs; it is unrelated to GeM login. On
expiry, the extension asks the employee to sign in to Acxxel again.

## Install the extension

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Select **Load unpacked**.
4. Select `frontend/gem-desktop-extension` (the folder containing `manifest.json`).
5. Refresh the Acxxel tab after installing or reloading the extension.

## Upload flow

1. Analyser queues an approved Desktop bid and selects a saved account label.
2. The Acxxel page connects the extension using the employee token.
3. The extension opens the GeM login page in a new tab.
4. The employee manually completes username, password, captcha, and OTP, then
   manually navigates to **Add New Offering**.
5. The extension detects the form and fills every confident approved-data match.
   It repeats this on every GeM multi-step DOM/route change.
6. Empty, ambiguous, unexpected, and file-upload controls are highlighted in
   orange and listed in the on-page Acxxel assistant for manual completion.
7. The employee clicks GeM **Next** and final **Submit**; the extension never
   clicks either action.
8. On Search My Offerings, the extension reports published/rejected/submitted
   status to Acxxel.

No `run_gem_worker` or scheduled GeM polling process exists or should be run.
