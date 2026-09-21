#!/usr/bin/env python3
"""Publish one personal skill and link its configured install targets."""

from __future__ import annotations

import argparse
import os
import shutil
import sys
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--marketplace", required=True, type=Path)
    parser.add_argument("--link", action="append", default=[], type=Path)
    parser.add_argument("--copy", action="append", default=[], type=Path)
    parser.add_argument("--replace", action="store_true")
    return parser.parse_args()


def resolved(path: Path) -> Path:
    return path.expanduser().resolve(strict=False)


def absolute(path: Path) -> Path:
    """Make a target absolute without resolving an existing symlink."""
    return Path(os.path.abspath(path.expanduser()))


def remove_target(path: Path) -> None:
    is_junction = getattr(path, "is_junction", lambda: False)()
    if path.is_symlink() or is_junction or os.path.islink(path) or path.is_file():
        path.unlink()
    elif path.is_dir():
        shutil.rmtree(path)


def ensure_empty_or_replace(path: Path, replace: bool) -> None:
    if not os.path.lexists(path):
        return
    if not replace:
        raise SystemExit(f"refusing existing target without --replace: {path}")
    remove_target(path)


def main() -> int:
    args = parse_args()
    source = resolved(args.source)
    marketplace = resolved(args.marketplace)

    if not source.is_dir():
        raise SystemExit(f"source directory not found: {source}")
    if source == marketplace:
        raise SystemExit("source and marketplace target must differ")

    ensure_empty_or_replace(marketplace, args.replace)
    marketplace.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(source, marketplace, symlinks=True)
    print(f"copied {source} -> {marketplace}")

    for target_arg in args.link:
        target = absolute(target_arg)
        ensure_empty_or_replace(target, args.replace)
        target.parent.mkdir(parents=True, exist_ok=True)
        try:
            os.symlink(marketplace, target, target_is_directory=True)
        except OSError as error:
            raise SystemExit(
                f"could not create directory symlink {target} -> {marketplace}: {error}"
            ) from error
        print(f"linked {target} -> {marketplace}")

    for target_arg in args.copy:
        target = absolute(target_arg)
        ensure_empty_or_replace(target, args.replace)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(source, target, symlinks=True)
        print(f"copied {source} -> {target}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
