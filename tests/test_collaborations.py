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


if __name__ == '__main__':
    unittest.main()
