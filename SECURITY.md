# Security Policy

Stadt Land Flux runs entirely in the browser: there is no backend, no account
and no upload. The only state is the game in the browser's local storage.

If you discover a vulnerability (for example in how local storage is parsed, the
Content Security Policy, or the build/deploy pipeline), please report it privately.

- Email: slfx@9xb.de
- Please include steps to reproduce.

You will receive a response within 7 days. Please do not open a public issue
for security reports until a fix has been released.

Dependencies (test tooling only) and the pinned GitHub Actions are monitored
with Dependabot. The app itself has no runtime dependencies.
