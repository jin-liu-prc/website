"""Run the actual migration and Worker SQL against SQLite, without cloud resources."""
import datetime
import pathlib
import re
import sqlite3
import unittest

ROOT = pathlib.Path(__file__).parent
SOURCE = (ROOT / 'worker.mjs').read_text()
UPSERT = re.search(r'export const UPSERT_SQL = `([^`]+)`', SOURCE).group(1)
CLEANUP = re.search(r'export const CLEANUP_SQL = `([^`]+)`', SOURCE).group(1)


class CitySchemaTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.db.executescript((ROOT / 'migrations/0001_city_totals.sql').read_text())
        self.addCleanup(self.db.close)

    def collect(self, day='2026-11-10', country='AU', region='Victoria', city='Melbourne',
                hostname='www.jinliu.org'):
        self.db.execute(UPSERT, (day, country, region, city, hostname))

    def test_repeated_views_increment_one_row_and_keep_original_and_translated_counts(self):
        self.collect()
        self.collect()
        self.collect(hostname='www-jinliu-org.translate.goog')
        self.collect(day='2026-11-11', hostname='www-jinliu-org.translate.goog')
        self.collect(country='JP', region='Tokyo', city='Tokyo')
        report = self.db.execute('SELECT * FROM city_report').fetchall()
        self.assertEqual(report[0], ('AU', 'Victoria', 'Melbourne', 4, 2, 2, '2026-11-10', '2026-11-11'))
        self.assertEqual(len(self.db.execute('SELECT * FROM daily_city_views').fetchall()), 4)
        self.assertEqual(report[1][0:4], ('JP', 'Tokyo', 'Tokyo', 1))

    def test_same_city_name_in_different_regions_stays_separate(self):
        self.collect(country='US', region='Illinois', city='Springfield')
        self.collect(country='US', region='Massachusetts', city='Springfield')
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM city_report').fetchone()[0], 2)

    def test_schema_has_only_the_requested_aggregate_fields(self):
        columns = [row[1] for row in self.db.execute('PRAGMA table_info(daily_city_views)')]
        self.assertEqual(columns, ['day', 'country_code', 'region', 'city', 'hostname', 'views'])
        tables = [row[0] for row in self.db.execute("SELECT name FROM sqlite_master WHERE type='table'")]
        self.assertEqual(tables, ['daily_city_views'])

    def test_constraints_reject_unapproved_hosts_and_nonpositive_counts(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.collect(hostname='evil.test')
        self.collect()
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute('UPDATE daily_city_views SET views = 0')

    def test_cleanup_keeps_exactly_today_and_the_previous_179_days(self):
        today = datetime.date(2026, 11, 10)
        for age in range(201):
            self.collect(day=(today - datetime.timedelta(days=age)).isoformat())
        cutoff = (today - datetime.timedelta(days=179)).isoformat()
        self.db.execute(CLEANUP, (cutoff,))
        count, oldest, newest, views = self.db.execute(
            'SELECT COUNT(*), MIN(day), MAX(day), SUM(views) FROM daily_city_views').fetchone()
        self.assertEqual((count, oldest, newest, views), (180, cutoff, today.isoformat(), 180))


if __name__ == '__main__':
    unittest.main()
