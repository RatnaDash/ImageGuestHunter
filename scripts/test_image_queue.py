import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('queue_helper', Path(__file__).with_name('image_queue.py'))
q = importlib.util.module_from_spec(spec)
spec.loader.exec_module(q)


class QueueTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.source = self.root / 'SrcImages'
        self.source.mkdir()
        self.image = self.source / 'sample.jpg'
        self.image.write_bytes(b'screenshot-fixture')
        (self.root / 'guest-hunting.xlsx').touch()
        self.dest = self.source / 'Archive' / '2026-10-27' / self.image.name
        self.record = {'Filename':self.image.name,'SHA-256':q.digest(self.image),'Guest identity':'Example Guest','Processing status':'Saved','Archive path':str(self.dest)}

    def run_queue(self, record=None, guests=None, archive=True):
        log = [record or self.record]
        with patch.object(q, 'rows', side_effect=lambda book, name: log if name == 'Processing Log' else guests if guests is not None else [{'Name':'Example Guest'}]):
            return q.run(self.root, archive)

    def test_success_then_rerun(self):
        self.assertIn('archived_to', self.run_queue()[0])
        self.assertFalse(self.image.exists())
        self.assertEqual(self.dest.read_bytes(), b'screenshot-fixture')
        self.assertEqual(self.run_queue(), [])

    def test_collision_keeps_original(self):
        self.dest.parent.mkdir(parents=True)
        self.dest.write_bytes(b'other')
        self.assertIn('error', self.run_queue()[0])
        self.assertTrue(self.image.exists())
        self.assertEqual(self.dest.read_bytes(), b'other')

    def test_missing_guest_and_unresolved_retained(self):
        self.assertIn('error', self.run_queue(guests=[])[0])
        self.record['Processing status'] = 'Needs review'
        self.assertIn('retained', self.run_queue()[0])
        self.assertTrue(self.image.exists())

    def test_outside_destination_rejected(self):
        self.record['Archive path'] = str(self.root / 'outside.jpg')
        self.assertIn('error', self.run_queue()[0])
        self.assertTrue(self.image.exists())

    def test_renamed_hash_is_known_but_not_archived_without_log(self):
        self.record['Filename'] = 'old.jpg'
        entry = self.run_queue()[0]
        self.assertEqual(entry['previous_statuses'], ['Saved'])
        self.assertIn('retained', entry)

    def test_resume_after_copy_before_remove(self):
        self.dest.parent.mkdir(parents=True)
        self.dest.write_bytes(self.image.read_bytes())
        self.assertIn('archived_to', self.run_queue()[0])


if __name__ == '__main__':
    unittest.main()
