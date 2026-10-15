# Security model

This is a static portfolio with fictional demo data. The deployed package contains only public HTML, JavaScript, CSS, fonts and five approved illustrations. Original private work, source documents, credentials and design drafts are excluded. Anything placed in `src/site.config.json` is public: never put a token there.

## Boundaries

- Visitors control local search, sample naming rules, sample booking fields and URL fragments. React renders text; project and tab routes use fixed allowlists. No input is sent to an AI service or backend.
- Ephemeral sample comments are hidden on public project pages. A future complete, explicitly enabled giscus configuration can expose public GitHub Discussions; authentication, storage and moderation are delegated to GitHub/giscus. Its external script runs only when the comments disclosure is expanded. With the current disabled configuration, legacy comments routes show the overview without loading an external script. Do not post private information.
- Demo inputs and filter choices persist only in page memory through internal navigation. A return-to-article URL accepts a bounded article ID and offers a return link only for a published article related to that project. No demo input is included in shared URLs.
- Repository links accept only `owner/repository` identifiers and are constructed for `https://github.com/`. External tabs use `noopener noreferrer`.
- CSV exports escape quotes and neutralize spreadsheet formula prefixes. No real document is uploaded, renamed or parsed.
- GitHub Actions builds trusted `main` branch code. Deployment uses a short-lived GitHub token with Pages/OIDC permissions only in the deploy job. No personal token is required. Repository owners should protect `main` and the `github-pages` environment according to their collaboration needs.
- Third-party packages are locked. The giscus script is a third-party runtime dependency when enabled. Its backend, GitHub permissions and moderation cannot be validated without the chosen repository; these remain deployment checks.

GitHub Pages does not provide this application with a server, private datastore or custom authentication. A future independent social network requires a separate security model and backend review. Keep the demos available while adding those features separately.

## GUI editing boundaries

Public text, colors and articles live in fixed `src/content/site.json`. Validate its allowlisted schema, byte/field/item limits, IDs, dates, statuses, exact color syntax and readable contrast at import, save and build. Plain Markdown renders as React text/headings/lists; raw HTML never executes. No user-controlled path selects a write target.

Project and article tags are optional plain string arrays, limited to eight unique tags of 1–32 characters each. Control and bidirectional formatting characters are rejected. Tags render as React text and filter by exact equality. Global tag rename/merge validates the entire resulting content, including drafts; public builds remove draft articles and their tags.

Browser drafts are localStorage only: no authentication, shared storage, secrets or GitHub credentials. Production has no writing endpoint. The virtual content module omits draft articles, including bodies, from public JavaScript. Public GitHub source still exposes drafts; it must never contain private information.

Only development exposes `/__makelog/editor` on numeric loopback. Requests require exact host/port and peer address; writes additionally require exact same origin, JSON and a fresh random process-local token. No CORS access. Tokens use no-store/nosniff responses, stay in memory and never enter the public build/export. Save requests enforce 1MB limits, validation and revision checks; serialized atomic writes target only the fixed JSON. Linked files/directories are rejected. The native studio supports one trusted OS owner and trusted local tools. Loopback, Origin and process tokens do not authenticate or isolate different OS accounts; do not use it on a machine with untrusted local users/processes. Trusted local owners/tools remain trusted. Never expose the dev server through a tunnel or public binding.

The development and preview document set CSP frame-ancestors 'none' and X-Frame-Options DENY. The editor also refuses to mount its capability-acquiring workspace when framed. GitHub Pages does not use these development response headers; its static editor has the client guard and no source-writing endpoint. Real-browser clickjacking validation was unavailable in the approved audit runtime, so this is preventive hardening, not a reproduced exploit claim.

Online editing is delegated to Pages CMS/GitHub using `.pages.yml`. The static app never requests credentials or calls write APIs. The owner must approve the CMS GitHub App for the selected repository. CMS implementation, actual login/saves/deployments, App permissions and branch protection remain external checks until connected. Git history provides online recovery.

## Verification and reporting

Use the standard local checks in README. For security execution validation, use the user's configured offline, resource-limited WSL audit runtime with a minimal sanitized copy. Do not execute audit targets in an unrestricted terminal. Keep source read-only during audits. Additional security spending limit is 0 JPY; no paid APIs, Cloud scans, credit purchases or plan changes. Ordinary Codex allowance is still consumed by AI review.
