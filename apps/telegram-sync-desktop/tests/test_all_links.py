import unittest
from telethon import types
from local_app.editor import rewrite,encode_entities,decode_entities
class AllLinksTests(unittest.TestCase):
    def test_any_label_and_plain_urls_are_updated_without_removing_text(self):
        text='VIP completo\nLiberar acesso\nhttps://old.example\nHentai'
        original={'text':text,'entities':encode_entities([types.MessageEntityTextUrl(0,12,'https://one.example'),types.MessageEntityTextUrl(13,14,'https://two.example'),types.MessageEntityUrl(28,19)]),'media':None,'preview':False,'buttons':None}
        result,links=rewrite(original,'https://new.example',False,True)
        self.assertEqual(result['text'],text);self.assertEqual(len(links),3)
        self.assertTrue(all(e.url=='https://new.example' for e in decode_entities(result['entities'])))
        self.assertIsNone(rewrite(result,'https://new.example',False,True))
    def test_current_plain_url_is_not_pending(self):
        original={'text':'https://new.example','entities':encode_entities([types.MessageEntityUrl(0,19)]),'media':None,'preview':False,'buttons':None}
        self.assertIsNone(rewrite(original,'https://new.example',False,True))
