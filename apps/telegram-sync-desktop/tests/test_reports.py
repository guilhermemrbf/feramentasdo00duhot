import csv
import tempfile
import unittest
from pathlib import Path
from local_app.reports import csv_cell,export_edit_report
class ReportTests(unittest.TestCase):
    def test_export_does_not_include_private_message_bodies_and_escapes_spreadsheet_formulas(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'report.csv'
            export_edit_report(path,{'id':1,'title':'=HYPERLINK("evil")','channel':'-100123','target':'https://t.me/test'},[{'message_id':7,'status':'applied','links':'["https://old.example"]','note':'ok','original':'SECRET ORIGINAL BODY','desired':'SECRET SESSION'}])
            raw=path.read_text(encoding='utf-8-sig')
            self.assertNotIn('SECRET',raw)
            with path.open(encoding='utf-8-sig',newline='') as file:rows=list(csv.reader(file,delimiter=';'))
            self.assertTrue(rows[1][1].startswith("'="));self.assertEqual(rows[1][4],'7')
    def test_formula_prefixes_are_protected(self):
        for text in ('=cmd','+cmd','-cmd','@cmd','  =cmd'):
            self.assertTrue(csv_cell(text).startswith("'"))
