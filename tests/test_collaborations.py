import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('builder', Path(__file__).parents[1] / 'scripts/build_collaborations.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class CollaborationCounting(unittest.TestCase):
    def test_distinct_people_dual_countries_and_self_exclusion(self):
        author = {'name': 'A Researcher', 'canonicalName': 'A Researcher', 'personId': 'a',
                  'countries': ['AU', 'CN'], 'affiliations': ['Two institutions'], 'sourceUrls': ['https://example.org/paper']}
        self_author = {**author, 'name': 'Jin Liu', 'personId': 'jin-liu', 'self': True}
        works = [{'inventoryIndex': n, 'title': 'Paper', 'year': 2020+n, 'authors': [author, self_author],
                  'scholarUrl': 'https://scholar.google.com/citations?user=test'} for n in range(2)]
        data = builder.build({'updated': '2026-11-01', 'profileUrl': 'https://example.org', 'works': works},
                             {code: {'name': code, 'longitude': 0, 'latitude': 0} for code in ['AU', 'CN']})
        self.assertEqual(data['totals'], {'collaborators': 1, 'countryPairs': 2})
        self.assertTrue(all(len(c['collaborators']) == 1 for c in data['countries']))
        self.assertEqual(data['countries'][0]['collaborators'][0]['workIds'], ['0', '1'])

    def test_duplicate_and_unresolved_affiliations_do_not_inflate_counts(self):
        works = [
            {'inventoryIndex': 0, 'title': 'Unresolved', 'year': 2020, 'authors': [
                {'name': 'J Smith', 'countries': []}], 'scholarUrl': 'https://example.org'},
            {'inventoryIndex': 1, 'title': 'Duplicate', 'year': 2020, 'countingEligible': False, 'authors': [
                {'name': 'Unverified name', 'countries': ['AU']}], 'scholarUrl': 'https://example.org'}]
        data = builder.build({'updated': '2026-11-01', 'profileUrl': 'https://example.org', 'works': works}, {})
        self.assertEqual(data['totals']['collaborators'], 0)
        self.assertEqual(data['coverage']['unresolvedWorks'], 1)
        self.assertEqual(data['countries'], [])

    def test_unknown_country_and_missing_identity_require_review(self):
        work = {'inventoryIndex': 0, 'title': 'Paper', 'year': 2020, 'authors': [
            {'name': 'J Smith', 'countries': ['AU']}], 'scholarUrl': 'https://example.org'}
        with self.assertRaisesRegex(ValueError, 'Unresolved identity'):
            builder.build({'updated': '2026-11-01', 'profileUrl': 'https://example.org', 'works': [work]}, {})

    def test_partially_resolved_paper_remains_flagged(self):
        work = {'inventoryIndex': 0, 'title': 'Partial', 'year': 2020, 'authors': [
            {'name': 'Known', 'personId': 'known', 'countries': ['AU'], 'sourceUrls': ['https://example.org']},
            {'name': 'Unknown', 'countries': []}], 'scholarUrl': 'https://example.org'}
        data = builder.build({'updated': '2026-11-01', 'profileUrl': 'https://example.org', 'works': [work]},
                             {'AU': {'name': 'Australia', 'longitude': 135, 'latitude': -25}})
        self.assertEqual(data['totals']['collaborators'], 1)
        self.assertEqual(data['coverage']['verifiedCoauthoredWorks'], 0)
        self.assertEqual(data['coverage']['unresolvedWorks'], 1)

    def test_country_organizations_are_reviewed_and_separate_from_people(self):
        work = {'inventoryIndex': 0, 'title': 'Paper', 'year': 2020, 'authors': [
            {'name': 'A Person', 'personId': 'a', 'countries': ['AU'], 'sourceUrls': ['https://example.org'],
             'affiliations': ['Example University']}],
            'scholarUrl': 'https://example.org'}
        research = {'updated': '2026-11-01', 'profileUrl': 'https://example.org', 'works': [work]}
        places = {'AU': {'name': 'Australia', 'longitude': 135, 'latitude': -25}}
        catalog = {'countries': [{'code': 'AU', 'organizations': [
            {'id': 'university', 'name': 'Example University', 'workIds': ['0'],
             'affiliationEvidence': ['Example University'], 'sourceUrls': ['https://example.org']}]}]}
        result = builder.build(research, places, catalog)
        self.assertEqual(result['countries'][0]['organizations'][0]['name'], 'Example University')
        self.assertEqual(result['countries'][0]['organizations'][0]['coauthorCount'], 1)
        self.assertNotIn('A Person', str(result['countries'][0]['organizations']))
        with self.assertRaisesRegex(ValueError, 'Review root organizations'):
            builder.build(research, places, {'countries': []})

    def test_organization_counts_distinct_coauthors_not_every_author_of_a_paper(self):
        def author(pid, countries, affiliations, **extra):
            return dict(name=pid, personId=pid, countries=countries, affiliations=affiliations,
                        sourceUrls=['https://example.org'], **extra)

        a = author('a', ['AU', 'CN'], ['School, Example University, Melbourne', 'Institute of China'])
        b = author('b', ['AU'], ['Department of Energy, Environment and Climate Action, Victoria'])
        jin = author('jin-liu', ['AU'], ['School, Example University, Melbourne'], self=True)
        works = [
            {'inventoryIndex': 0, 'title': 'Two Australian organisations', 'year': 2020,
             'authors': [a, b, jin], 'scholarUrl': 'https://example.org'},
            {'inventoryIndex': 1, 'title': 'Same person, another department and office', 'year': 2021,
             'authors': [author('a', ['AU'], ['SCHOOL; EXAMPLE UNIVERSITY — MELBOURNE'])],
             'scholarUrl': 'https://example.org'},
            {'inventoryIndex': 2, 'title': 'A duplicate version', 'year': 2020, 'countingEligible': False,
             'authors': [author('b', ['AU'], ['School, Example University, Melbourne'])],
             'scholarUrl': 'https://example.org'}]
        research = {'updated': '2026-11-01', 'profileUrl': 'https://example.org', 'works': works}
        places = {code: {'name': code, 'longitude': 0, 'latitude': 0} for code in ['AU', 'CN']}

        def organization(oid, ids, aliases):
            return dict(id=oid, name=oid, workIds=ids, affiliationEvidence=aliases,
                        sourceUrls=['https://example.org'])

        catalog = {'countries': [
            {'code': 'AU', 'organizations': [
                organization('university', ['0', '1', '2'], ['School, Example University, Melbourne']),
                organization('government', ['0'], ['Department of Energy, Environment and Climate Action, Victoria'])]},
            {'code': 'CN', 'organizations': [organization('institute', ['0'], ['Institute of China'])]}]}
        result = builder.build(research, places, catalog)
        counts = {(c['code'], o['id']): o['coauthorCount'] for c in result['countries'] for o in c['organizations']}
        self.assertEqual(counts, {('AU', 'university'): 1, ('AU', 'government'): 1, ('CN', 'institute'): 1})
        self.assertEqual(result['totals'], {'collaborators': 2, 'countryPairs': 3})

        # A new, unreviewed affiliation must stop publication rather than silently lose a coauthor.
        works[1]['authors'].append(author('new', ['AU'], ['Unreviewed Institution']))
        with self.assertRaisesRegex(ValueError, 'Review coauthor organization aliases'):
            builder.build(research, places, catalog)

        works[1]['authors'].pop()
        catalog['countries'][0]['organizations'].append(organization('unmatched', ['0'], ['Other Institution']))
        with self.assertRaisesRegex(ValueError, 'Review coauthor affiliations for unmatched'):
            builder.build(research, places, catalog)


if __name__ == '__main__':
    unittest.main()
