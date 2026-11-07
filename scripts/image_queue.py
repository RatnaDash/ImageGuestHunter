"""Read-only inventory and workbook-gated archival. Uses only Python stdlib."""
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import shutil
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}


def rows(book, name):
    with zipfile.ZipFile(book) as z:
        strings = []
        if 'xl/sharedStrings.xml' in z.namelist():
            strings = [''.join(x.itertext()) for x in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', NS)]
        rels = {x.attrib['Id']: x.attrib['Target'] for x in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
        sheets = ET.fromstring(z.read('xl/workbook.xml')).findall('m:sheets/m:sheet', NS)
        sheet = next(s for s in sheets if s.attrib['name'] == name)
        target = rels[sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']]
        target = target.lstrip('/') if target.startswith('/') else 'xl/' + target
        result = []
        for row in ET.fromstring(z.read(target)).findall('m:sheetData/m:row', NS):
            vals = {}
            for cell in row.findall('m:c', NS):
                col = ''.join(c for c in cell.attrib['r'] if c.isalpha())
                if cell.attrib.get('t') == 'inlineStr':
                    value = ''.join(t.text or '' for t in cell.findall('.//m:t', NS))
                else:
                    value = cell.findtext('m:v', '', NS)
                    if cell.attrib.get('t') == 's':
                        value = strings[int(value)]
                vals[col] = value
            result.append(vals)
        if not result:
            return []
        header = result[0]
        return [{title: row.get(col, '') for col, title in header.items()} for row in result[1:]]


def digest(path):
    with path.open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()


def run(root, archive=False):
    source = (root / 'SrcImages').resolve()
    book = root / 'guest-hunting.xlsx'
    log = rows(book, 'Processing Log') if book.exists() else []
    guests = rows(book, 'Guests') if archive else []
    results = []
    for path in sorted(source.iterdir()):
        if not path.is_file() or path.is_symlink() or path.suffix.lower() not in {'.png', '.jpg', '.jpeg', '.webp'}:
            continue
        sha = digest(path)
        matches = [r for r in log if r.get('SHA-256') == sha]
        entry = {'filename': path.name, 'sha256': sha, 'previous_statuses': [r.get('Processing status') for r in matches]}
        if archive:
            eligible = [r for r in matches if r.get('Filename') == path.name and r.get('Processing status') in {'Saved', 'Duplicate'}]
            if eligible:
                record = eligible[-1]
                dest = Path(record.get('Archive path', '')).resolve()
                archive_root = (source / 'Archive').resolve()
                try:
                    relative = dest.relative_to(archive_root)
                    if len(relative.parts) != 2 or not dest.is_absolute():
                        raise ValueError('Expected Archive/YYYY-MM-DD/filename')
                    dt.date.fromisoformat(relative.parts[0])
                    if not record.get('Guest identity') or not any(r.get('Name') for r in guests):
                        raise ValueError('Missing saved guest evidence')
                    if not record['Guest identity'].strip():
                        raise ValueError('Empty guest identity')
                    # Match every logged identity against saved guest name or canonical link.
                    identities = [s.strip() for s in record['Guest identity'].split('\n') if s.strip()]
                    for identity in identities:
                        if not any(identity.casefold() == g.get('Name', '').casefold() or identity in g.get('Social media link, alternate link or phone no', '') for g in guests):
                            raise ValueError('Guest identity is not present in saved Guests sheet')
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    if dest.exists():
                        if digest(dest) != sha:
                            raise ValueError('Archive collision; update planned path in workbook')
                    else:
                        try:
                            with dest.open('xb') as out, path.open('rb') as inp:
                                shutil.copyfileobj(inp, out)
                                out.flush()
                                os.fsync(out.fileno())
                        except Exception:
                            # Keep source on any partial-copy failure; never remove other files.
                            raise
                    if digest(dest) != sha or digest(path) != sha:
                        raise ValueError('Hash changed; source retained')
                    path.unlink()
                    entry['archived_to'] = str(dest)
                except (ValueError, OSError) as exc:
                    entry['error'] = str(exc)
            else:
                entry['retained'] = 'No saved eligible log record'
        results.append(entry)
    return results


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['scan', 'archive'])
    args = parser.parse_args()
    print(json.dumps(run(ROOT, args.command == 'archive'), indent=2))
