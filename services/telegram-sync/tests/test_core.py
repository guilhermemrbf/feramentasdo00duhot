import unittest
from core import channel_ref, replace
class CoreTests(unittest.TestCase):
    def test_ids_links(self):
        self.assertEqual(channel_ref('-10012345678'),-10012345678)
        self.assertEqual(channel_ref('https://t.me/my_channel'),'my_channel')
    def test_invalid(self):
        for ref in ('https://evil.test/channel','https://t.me/c/channel/1','https://t.me/+invite','0'):
            with self.assertRaises(ValueError): channel_ref(ref)
    def test_no_cascade(self):
        self.assertEqual(replace('a.b axb new',[{'find':'a.b','replacement':'new'},{'find':'new','replacement':'other'}]),'new axb other')
    def test_unicode(self):
        self.assertEqual(replace('😀 @old',[{'find':'old','replacement':'new'}]),'😀 @new')
