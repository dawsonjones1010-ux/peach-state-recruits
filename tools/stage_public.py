#!/usr/bin/env python3
"""Stage exactly the GitHub Pages allowlist for a static preview or deployment."""
import argparse
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

def stage(destination):
    destination = Path(destination).resolve()
    if destination == ROOT or ROOT.is_relative_to(destination):
        raise ValueError('Choose a separate staging directory, not a parent of the source')
    workflow = (ROOT / '.github/workflows/pages.yml').read_text()
    names = []
    for key in ('SITE_FILES', 'SITE_DIRS'):
        match = re.search(key + r'="([^"]+)"', workflow)
        if not match:
            raise ValueError('Missing publication allowlist: ' + key)
        names.extend(match.group(1).split())
    destination.mkdir(parents=True, exist_ok=True)
    for name in names:
        src = ROOT / name
        if name == 'videos' and not src.exists():
            print('Video directory absent from this export; preserve existing hosted video assets when merging.')
            continue
        if not src.exists() or not src.resolve().is_relative_to(ROOT):
            raise ValueError('Invalid public asset: ' + name)
        dst = destination / name
        if src.is_dir():
            shutil.copytree(src, dst, dirs_exist_ok=True)
        else:
            shutil.copy2(src, dst)
    (destination / '.nojekyll').touch()
    print(f'Staged {len(names)} allowlisted entries in {destination}')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', required=True)
    stage(parser.parse_args().out)
