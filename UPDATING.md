# JLE update architecture status

JLE now builds a user-selectable NSIS installer and is configured to publish
installers, blockmaps and `latest.yml` integrity metadata through GitHub
Releases in `Dave-III/Jetrunner-level-editor`.

The packaged editor uses `electron-updater` to check that GitHub feed. It asks
before downloading and asks again before restarting to install. User levels
and logs remain under `Documents/Jetrunner Level Editor`, outside the
application directory.

The remaining production requirement is Authenticode signing. Add the base64
encoded PFX and its password as these GitHub repository secrets:

- `WINDOWS_CERTIFICATE`
- `WINDOWS_CERTIFICATE_PASSWORD`

Push a version tag such as `v1.0.1` to run
`.github/workflows/release-editor.yml`. The workflow validates the editor,
builds the NSIS installer and publishes the GitHub Release using the scoped
`GITHUB_TOKEN`. Keep the package version and tag version identical.

Do not distribute the locally built unsigned installer as a trusted production
release. GitHub hosting and SHA-512 updater metadata provide transport and
integrity checks, but do not replace Windows publisher identity/signing.
