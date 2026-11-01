#!/usr/bin/env python3
"""Build the public map from reviewed publication-time affiliation evidence."""
import json
from pathlib import Path


def build(research, places):
    countries, people, works = {}, {}, []
    verified_works = 0
    unresolved = 0
    years = []
    for work in research['works']:
        wid = str(work['inventoryIndex'])
        years.append(int(work['year']))
        authors = work['authors']
        eligible = work.get('countingEligible', True)
        coauthors = [a for a in authors if not a.get('self') and a.get('personId') != 'jin-liu']
        unresolved_authors = [a for a in coauthors if not a.get('countries')]
        has_countries = False
        for author in coauthors if eligible else []:
            if not author.get('countries'):
                continue
            person_id = author.get('personId')
            if not person_id:
                raise ValueError(f"Unresolved identity in {work['title']}: {author['name']}")
            people[person_id] = author.get('canonicalName', author['name'])
            for code in set(author['countries']):
                if code not in places:
                    raise ValueError(f'Add a reviewed country location for {code}')
                if not author.get('sourceUrls') and not work.get('sourceUrls'):
                    raise ValueError(f'No source for {person_id} / {code}')
                country = countries.setdefault(code, {**places[code], 'code': code, 'people': {}})
                person = country['people'].setdefault(person_id, {
                    'id': person_id, 'name': people[person_id], 'affiliations': set(), 'workIds': set()})
                person['affiliations'].update(author.get('affiliations', []))
                person['workIds'].add(wid)
                has_countries = True
        if eligible and coauthors:
            if has_countries and not unresolved_authors:
                verified_works += 1
            if unresolved_authors:
                unresolved += 1
        notes = []
        if not eligible:
            notes.append(work.get('countingNote') or 'Duplicate version excluded from counts')
        if not coauthors:
            notes.append('Single-author work')
        elif eligible and unresolved_authors:
            notes.append('Some affiliations await verification; unverified affiliations are not counted')
        url = 'https://doi.org/' + work['doi'] if work.get('doi') else next(
            (u for u in work.get('sourceUrls', []) if 'scholar.google.' not in u), work['scholarUrl'])
        works.append({'id': wid, 'title': work['title'], 'year': int(work['year']),
                      'url': url, 'scholarUrl': work['scholarUrl'], 'note': '; '.join(notes)})
    output_countries = []
    for country in countries.values():
        coauthors = []
        for person in country.pop('people').values():
            person['affiliations'] = sorted(person['affiliations'])
            person['workIds'] = sorted(person['workIds'], key=int)
            coauthors.append(person)
        country['collaborators'] = sorted(coauthors, key=lambda p: p['name'].casefold())
        output_countries.append(country)
    return {
        'schemaVersion': 1, 'updated': research['updated'], 'profileUrl': research['profileUrl'],
        'yearRange': [min(years), max(years)],
        'totals': {'collaborators': len(people), 'countryPairs': sum(len(c['collaborators']) for c in output_countries)},
        'coverage': {'inventoryRecords': len(works), 'verifiedCoauthoredWorks': verified_works,
                     'unresolvedWorks': unresolved},
        'countries': sorted(output_countries, key=lambda c: c['name']),
        'works': sorted(works, key=lambda w: (-w['year'], w['title']))}


if __name__ == '__main__':
    root = Path(__file__).resolve().parents[1]
    research = json.loads((root / 'data/collaboration-research.json').read_text())
    places = json.loads((root / 'data/collaboration-countries.json').read_text())
    result = build(research, places)
    destination = root / 'static/data/collaborations.json'
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(f"Built {result['totals']['collaborators']} collaborators in {len(result['countries'])} countries")
