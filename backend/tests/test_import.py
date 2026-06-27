import sys
import unittest

sys.path.append("../")

class BackendImportTest(unittest.TestCase):
    def test_app_imports_without_mongo_uri(self):
        import main
        self.assertIsNotNone(main.app)


if __name__ == "__main__":
    unittest.main()
