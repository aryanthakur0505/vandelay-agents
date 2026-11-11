# Code signing

Releases are unsigned today, which is why Windows SmartScreen warns and macOS needs `xattr -cr`
before the app opens. The release workflow is ready for signing: add the secrets below under
**Settings → Secrets and variables → Actions** in the GitHub repo, tag a release, and the installers
come out signed. Nothing in the code needs to change.

## macOS (Apple Developer Program, $99/year)

1. Join the [Apple Developer Program](https://developer.apple.com/programs/).
2. In Xcode or the developer portal, create a **Developer ID Application** certificate, then export it
   from Keychain Access as a `.p12` with a password.
3. Create an [app-specific password](https://support.apple.com/en-us/102654) for your Apple ID.
4. Add these secrets:

| Secret | Value |
| --- | --- |
| `MAC_CERT_P12_BASE64` | the `.p12` file, base64-encoded (`base64 -i cert.p12`) |
| `MAC_CERT_PASSWORD` | the `.p12` password |
| `APPLE_ID` | your Apple ID email |
| `APPLE_APP_SPECIFIC_PASSWORD` | the app-specific password |
| `APPLE_TEAM_ID` | your team ID from the developer portal |

electron-builder signs the app and sends it to Apple for notarization, so it opens without warnings.
Signed Mac builds can also update themselves: add `zip` next to `dmg` in `electron-builder.yml`'s
`mac.target` and remove the `darwin` check in `src/main/updates.ts`.

## Windows

Either an OV/EV code-signing certificate from a certificate authority (exported as `.pfx`), or
[Azure Trusted Signing](https://learn.microsoft.com/azure/trusted-signing/) (about $10/month, set up
through `win.azureSignOptions` in `electron-builder.yml` instead of the secrets below).

| Secret | Value |
| --- | --- |
| `WIN_CERT_PFX_BASE64` | the `.pfx` file, base64-encoded |
| `WIN_CERT_PASSWORD` | the `.pfx` password |

SmartScreen still warns about a new certificate until enough people have installed signed builds;
EV certificates and Trusted Signing build that reputation faster.
