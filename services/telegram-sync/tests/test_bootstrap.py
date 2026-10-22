import unittest
from unittest.mock import patch
from bootstrap import validate_environment, validate_database

class BootstrapTests(unittest.TestCase):
    def test_missing_config_reports_only_names(self):
        with patch.dict('os.environ',{},clear=True), self.assertRaises(SystemExit) as ctx:
            validate_environment()
        self.assertIn('TELEGRAM_API_ID',str(ctx.exception))

    def test_database_error_is_redacted(self):
        import psycopg
        with patch.dict('os.environ',{'TELEGRAM_DATABASE_URL':'secret'}), patch('bootstrap.psycopg.connect',side_effect=psycopg.OperationalError('secret')), self.assertRaises(SystemExit) as ctx:
            validate_database()
        self.assertNotIn('secret',str(ctx.exception))

    def test_health_endpoint_has_no_secrets(self):
        from fastapi.testclient import TestClient
        from app import app
        with TestClient(app) as client:
            response=client.get('/healthz')
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json(),{'status':'ok'})
