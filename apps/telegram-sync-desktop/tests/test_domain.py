import unittest
from types import SimpleNamespace
from telethon import types
from local_app.domain import channel_ref,replace,caption,validate_rules,UserError,media_batches
class DomainTests(unittest.TestCase):
    def test_ids_links(self):
        self.assertEqual(channel_ref('-10012345678'),-10012345678);self.assertEqual(channel_ref('https://t.me/my_channel'),'my_channel')
    def test_invalid_refs(self):
        for value in ['https://t.me/+invite','https://t.me/channel/12','https://evil.test/channel','0']:
            with self.assertRaises(UserError):channel_ref(value)
    def test_simultaneous_longest_match(self):
        self.assertEqual(replace('a.b a new',[{'find':'a.b','replacement':'new'},{'find':'new','replacement':'next'}]),'new a next')
    def test_hidden_link_after_emoji(self):
        link=types.MessageEntityTextUrl(offset=3,length=4,url='https://t.me/original')
        message=SimpleNamespace(message='😀 Link',get_entities_text=lambda:[(link,'Link')])
        self.assertEqual(caption(message,[{'find':'https://t.me/original','replacement':'https://t.me/mine'}]),'😀 Link (https://t.me/mine)')
    def test_duplicate_rule_and_literal(self):
        with self.assertRaises(UserError):validate_rules([{'find':'x','replacement':'a'},{'find':'x','replacement':'b'}])
        self.assertEqual(replace('a.b axb',[{'find':'a.b','replacement':'X'}]),'X axb')
    def test_album_boundary(self):
        values=[SimpleNamespace(id=1,grouped_id=1),SimpleNamespace(id=2,grouped_id=1),SimpleNamespace(id=3,grouped_id=None)]
        self.assertEqual([[m.id for m in batch] for batch in media_batches(values)],[[1,2],[3]])
