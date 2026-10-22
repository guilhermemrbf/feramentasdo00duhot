import os
import unittest
from local_app.secrets import protect,unprotect
@unittest.skipUnless(os.name=='nt','DPAPI requires Windows')
class WindowsTests(unittest.TestCase):
    def test_round_trip(self):
        value='unique-secret-session';encrypted=protect(value)
        self.assertNotIn(value,encrypted);self.assertEqual(unprotect(encrypted),value)
    def test_tampering(self):
        from local_app.domain import UserError
        value=protect('session')
        with self.assertRaises(UserError):unprotect(value[:-4]+'AAAA')
