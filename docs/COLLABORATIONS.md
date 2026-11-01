# Collaboration map maintenance

The map in the Collaborators section, immediately after Publications is built from the public Google Scholar profile `tn1nAw0AAAAJ` and publication-time institutional affiliation evidence. It does not infer nationality or substitute current workplaces for historical affiliations.

- `data/collaboration-research.json`: reviewed publication inventory, author identities, affiliations, country codes, source URLs, duplicate exclusions and unresolved records.
- `data/collaboration-organizations.json`: reviewed institution-level parent organisations by country, with publication IDs, source URLs and exact publication-time affiliation aliases in `affiliationEvidence`. The builder matches these aliases within the organisation's region and eligible works, deduplicates author identities and outputs `coauthorCount`. Review new aliases when the build flags unmatched coauthors. Display organisation names only; do not show author names, university colleges/departments/labs, company divisions or office locations. Group repeated variants under the same root institution. Do not union a dual-affiliation author’s raw affiliation strings across all their countries.
- `data/collaboration-countries.json`: reviewed country names and representative map positions. All currently counted countries are UN member states. Use one marker per collaborating country, never one marker per institution or publication.
- `static/data/collaborations.json`: generated public map data. Rebuild it after changing the reviewed source.
- `scripts/build_collaborations.py`: deterministic author/country aggregation.
- `static/images/collaboration-world.svg`: simplified Natural Earth 110m country geometry, public domain. Source: https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson . Terms: https://www.naturalearthdata.com/about/terms-of-use/ . Singapore's representative position is 1.35 N, 103.82 E; other points use Natural Earth's label coordinates.

Run from the repository root:

```sh
python3 -m unittest discover -s tests
python3 scripts/build_collaborations.py
hugo --minify --baseURL https://www.jinliu.org/
```

## Refresh rules

The initial snapshot reviews all 32 profile records visible on 1 November 2026. A monthly Codex follow-up checks the public profile and verifies changed records before updating this repository. It needs the local host available; it is not a real-time Google Scholar integration. No paid service, secret key, or extra hosting provider is required. If Scholar is blocked or affiliations cannot be verified, preserve the last valid map and retain explicit unresolved records.

Use the allowed public profile URL `https://scholar.google.com/citations?user=tn1nAw0AAAAJ&hl=en&pagesize=100`. Respect Scholar's robots policy; do not bypass CAPTCHA, blocks, or restricted pagination. If the profile grows beyond the visible inventory, flag the coverage limitation.

1. Compare the publication inventory with the reviewed source. Confirm removals or identity changes before deleting evidence; a partial page or failed fetch is not a deletion.
2. Match a changed record by DOI or a reviewed title alias. Deduplicate preprints and journal versions when they represent the same work.
3. Read publisher metadata, article front matter, official repositories or indexed publication-specific author affiliations. Save supporting URLs for each affiliation. Never assign a country from an author's name, residence, nationality, or institution headquarters when the actual office address is elsewhere.
4. Resolve identities with full names, ORCID, trusted author IDs and paper-specific evidence. Initials alone do not establish identity. Preserve reviewed overrides and document conflicts.
5. Update source records, country locations and the reviewed root-organisation directory if necessary. Exclude Jin Liu. Count each collaborator once per country across all eligible works; verified multiple-country affiliations can contribute once to each country.
6. Run counting tests and rebuild public JSON. Check totals, coverage, new country markers and source links. Publish through the existing GitHub Pages workflow and verify the deployment.

`updated` is the date of the last reviewed data change, not a promise that every attempted monthly check succeeded. Keep the previous value when nothing changes. Notify Jin only after a meaningful published change or when user action is needed.

Marker size continues to reflect distinct coauthor counts, even though country details list root research organisations. Visible diameters range from 18 to 26 CSS pixels, recalculated on resize and zoom: a minimum makes small markers visible on phones and a capped maximum keeps the largest markers restrained. The scale preserves count ordering, rather than exact area ratios.

Use “region” throughout the visible map interface, including its caption, selector and accessibility descriptions. Keep the underlying reviewed country codes and geographic grouping. Sort the region selector by distinct coauthor count, highest first, with alphabetical ties. Do not display a marker-size legend.

Region details list parent organisations with distinct coauthor counts in brackets, ordered from highest to lowest count (alphabetical ties). Do not show author names or expandable per-organisation paper lists. Count each verified collaborator only once per organisation across eligible publications, excluding Jin Liu. Membership requires that person's publication-time affiliation with that root organisation in the region; sharing a paper with an organisation does not establish membership. The refresh schedule is monthly on the first day at 09:00 Australia/Melbourne.

Match map captions, region details, organisation lists and region selector to the website's general body text: 1rem, 1.75 line height and normal weight. Combine the selected region's name and organisation count with “Numbers in brackets show distinct coauthors.” in a single paragraph, without a bold heading. Keep the map's overall data description in one paragraph below the map.

Keep the “Explore a region” label and selector inside the map's bordered frame, in a control bar with the zoom buttons above the geographic area. Let the selector wrap onto its own row on phones so controls do not cover markers.

Show the selected region's summary and organisation list in a closable overlay on the geographic map, not beneath it. Keep the summary in one normal-weight paragraph and the organisation list scrollable and keyboard accessible. Close or Escape clears the selection and returns focus to the region selector. On phones the selected map view expands to 400px high to keep the overlay readable. Preserve the SVG's map proportions; both panning axes use its width-based coordinate scale when the mobile view is letterboxed.

Keep methodology and publication-source evidence in the repository for maintenance. Do not display the “How this map is counted and sourced” or “Publication sources” sections on the website.
