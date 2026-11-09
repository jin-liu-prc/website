# Jin Liu — personal website

Public website source for https://www.jinliu.org/.

## Services
- Name.com: domain registration and DNS.
- GitHub Pages: website hosting and HTTPS.
- Cloudflare Web Analytics: free, private aggregate visitor statistics. Domain registration, DNS and hosting stay with Name.com and GitHub Pages.

## Private visitor statistics
Sign in to [Cloudflare](https://dash.cloudflare.com/) and open **Observability → Analytics → Web analytics → www.jinliu.org**. Use the geographic breakdown to see approximate visitor regions, alongside visits, page views and referrers. Statistics start after installation; they do not identify individual visitors by name.

The public website loads Cloudflare's browser beacon only in production builds. The public site token is stored in `marketing.analytics.cloudflare_beacon` in `config/_default/params.yaml`; it cannot access the private dashboard. Never commit Cloudflare API keys or account credentials. No visitor report or public analytics widget is included on the website.

To exclude your own future visits, open https://www.jinliu.org/analytics-preferences/ in each browser profile you use and select **Exclude my visits**. The preference is stored only in that browser's local storage (`jinliu.analytics.exclude`), checked before the Cloudflare beacon loads, and survives browser restarts. Clearing site data removes it; other devices, profiles and private windows need their own setting. Reload other open website tabs after changing it. The preferences page itself is never measured. **Count my visits** reverses the exclusion. Existing anonymous totals cannot reliably be separated into your own previous visits and other visitors' visits.

## Where to edit
- Biography, role, affiliations, interests and degree summary: `content/authors/admin/_index.md`.
- Research, appointments, education, conferences, publications, data products, awards, skills, outreach and contact: `content/_index.md`.
- Banner links: `config/_default/menus.yaml`.
- Appearance: `assets/scss/custom.scss`.
- Photo: `content/authors/admin/avatar.jpg`.

Keep private CVs, application documents, phone numbers and referee details in your private materials repository, not this public website repository. This repository contains only the professional material intended for the public website.

## Visitor links
Use clean, stable visitor-facing URLs. Do not add version strings, cache keys or tracking parameters to the CV or other download links. Replace the CV at `/CV.pdf` when it changes. Keep parameters required to identify a destination or operate a feature, such as the Google Scholar profile ID and translation language. Background script and map-data cache keys are separate from links visitors open.

## Publishing
GitHub Actions builds with Hugo Extended 0.111.3 and deploys to GitHub Pages after changes to `main`. In Settings → Pages, select GitHub Actions as the source and set the custom domain to `www.jinliu.org`.

## Local preview
Install Hugo Extended 0.111.3 and Go, then run `hugo server`. The generated `public/` folder is not the source and is not committed.
