# Jin Liu — personal website

Public website source for https://www.jinliu.org/.

## Services
- Name.com: domain registration and DNS.
- GitHub Pages: website hosting and HTTPS.

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
