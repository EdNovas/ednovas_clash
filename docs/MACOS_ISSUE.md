# Resolving macOS "Malicious Software" / "Cannot be Verified" Warning

If you or your users see a warning like:
> **"EdNovasCloud" Not Opened**
> Apple could not verify "EdNovasCloud" is free of malware...

This is a standard macOS security feature called **Gatekeeper**. It blocks applications that haven't been digitally signed and "notarized" by Apple.

## ✅ Solution 1: Instructions for Users (Immediate Fix)

You can instruct your users to bypass this warning safely. This is common for open-source apps without a paid Apple Developer account.

**Steps to Open the App:**
1. **Don't double-click** the app icon.
2. Instead, **Right-click (or Control-click)** the app icon.
3. Select **Open** from the context menu.
4. A dialog will appear asking are you sure. Click **Open** again.
   * *Note: You only need to do this once. macOS will remember your choice.*

Alternatively:
* Go to **System Settings > Privacy & Security**.
* Scroll down to the "Security" section.
* You will see a message saying "EdNovasCloud was blocked...". Click **Open Anyway**.

---

## 🛠️ Solution 2: Fix for Developer (Signing & Notarization)

To completely remove this warning for all users, you must **Sign** and **Notarize** the application. This requires an Apple Developer Program membership (~$99/year).

### Prerequisites
1. **Apple Developer Account**: Enroll at [developer.apple.com](https://developer.apple.com/).
2. **Certificates**: Generate a "Developer ID Application" certificate.

### Step 1: Configure Electron Builder
Update your `electron-builder.yml` to include `hardenedRuntime` and `entitlements`.

**`electron-builder.yml`:**
```yaml
mac:
  target: dmg
  icon: "public/icon.png"
  hardenedRuntime: true
  gatekeeperAssess: false
  entitlements: "build/entitlements.mac.plist"
  entitlementsInherit: "build/entitlements.mac.plist"
```

**Create `build/entitlements.mac.plist`:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
  </dict>
</plist>
```

### Step 2: Set up GitHub Actions Secrets
If building via GitHub Actions, you need to add these secrets to your repository:
* `CSC_LINK`: Base64 encoded p12 certificate.
* `CSC_KEY_PASSWORD`: Password for the p12 certificate.
* `APPLE_ID`: Your Apple ID email.
* `APPLE_ID_PASSWORD`: An App-Specific Password (not your main password).
* `APPLE_TEAM_ID`: Your Team ID (from Apple Developer portal).

### Step 3: Enable Notarization
Modern `electron-builder` versions (v24+) simplify this. Ensure you use the `notarize` key or set the appropriate environment variables (`APPLE_ID`, `APPLE_ID_PASSWORD`, `APPLE_TEAM_ID`) in your CI pipeline.

When configured correctly, the build log will show "Notarizing app..." and upon success, users will no longer see the warning.
