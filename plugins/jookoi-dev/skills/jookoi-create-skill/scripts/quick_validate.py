#!/usr/bin/env python3
"""
Quick validation script for Agent Skills.
Checks frontmatter, naming, size budgets, relative paths, and reference nesting depth.
"""

import os
import re
import sys
import unicodedata
import yaml
from pathlib import Path

MAX_SKILL_NAME_LENGTH = 64
MAX_DESCRIPTION_LENGTH = 1024
MAX_COMPATIBILITY_LENGTH = 500
MAX_SKILL_MD_LINES = 500

ALLOWED_PROPERTIES = {
    "name",
    "description",
    "license",
    "allowed-tools",
    "metadata",
    "compatibility",
}
RESERVED_WORDS = ("claude", "anthropic")
LINK_PATTERN = re.compile(r"\[[^\]]*\]\(([^)]+)\)")


def _extract_local_targets(md_text: str) -> list[str]:
    """Extract local relative link targets from markdown text, ignoring fenced and inline code."""
    stripped = re.sub(r"```[\s\S]*?```", "", md_text)
    stripped = re.sub(r"`[^`\n]+`", "", stripped)
    targets = []
    for raw in LINK_PATTERN.findall(stripped):
        target = raw.strip().split()[0]  # strip optional link title
        target = target.split("#")[0]  # strip anchor
        if not target:
            continue
        if re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", target) or target.startswith("//"):
            continue
        targets.append(target)
    return targets


def validate_skill(skill_path):
    """Validate a skill directory against the Agent Skills specification and marketplace conventions."""
    skill_path = Path(skill_path).resolve()

    if not skill_path.exists():
        return False, f"Path does not exist: {skill_path}"
    if not skill_path.is_dir():
        return False, f"Not a directory: {skill_path}"

    dir_name = unicodedata.normalize("NFKC", skill_path.name)
    if dir_name.lower() == "synced":
        return False, "Directory name 'synced' is reserved and forbidden"

    skill_md = skill_path / "SKILL.md"
    if not skill_md.exists():
        return False, "SKILL.md not found"

    content = skill_md.read_text(encoding="utf-8")
    if not content.startswith("---"):
        return False, "No YAML frontmatter found"

    match = re.match(r"^---\r?\n(.*?)\r?\n---\r?\n?(.*)", content, re.DOTALL)
    if not match:
        return False, "Invalid frontmatter format"

    frontmatter_text, body = match.group(1), match.group(2)

    try:
        frontmatter = yaml.safe_load(frontmatter_text)
        if not isinstance(frontmatter, dict):
            return False, "Frontmatter must be a YAML dictionary"
    except yaml.YAMLError as e:
        return False, f"Invalid YAML in frontmatter: {e}"

    unexpected_keys = set(frontmatter.keys()) - ALLOWED_PROPERTIES
    if unexpected_keys:
        return False, (
            f"Unexpected key(s) in SKILL.md frontmatter: {', '.join(sorted(unexpected_keys))}. "
            f"Allowed properties are: {', '.join(sorted(ALLOWED_PROPERTIES))}"
        )

    if "name" not in frontmatter:
        return False, "Missing 'name' in frontmatter"
    if "description" not in frontmatter:
        return False, "Missing 'description' in frontmatter"

    name = frontmatter.get("name")
    if not isinstance(name, str) or not name.strip():
        return False, "Field 'name' must be a non-empty string"
    name = unicodedata.normalize("NFKC", name.strip())

    if len(name) > MAX_SKILL_NAME_LENGTH:
        return False, f"Name is too long ({len(name)} characters). Maximum is {MAX_SKILL_NAME_LENGTH} characters."
    if name != name.lower():
        return False, f"Name '{name}' must be lowercase"
    if name.startswith("-") or name.endswith("-") or "--" in name:
        return False, f"Name '{name}' cannot start/end with hyphen or contain consecutive hyphens"
    if not all(c.isalnum() or c == "-" for c in name):
        return False, f"Name '{name}' should contain only lowercase letters, digits, and hyphens"
    if "<" in name or ">" in name:
        return False, "Name cannot contain angle brackets (< or >)"
    for reserved in RESERVED_WORDS:
        if reserved in name:
            return False, f"Name '{name}' contains reserved word '{reserved}'"
    if dir_name != name:
        return False, f"Directory name '{skill_path.name}' must match skill name '{name}'"

    description = frontmatter.get("description")
    if not isinstance(description, str) or not description.strip():
        return False, "Field 'description' must be a non-empty string"
    description = description.strip()
    if "<" in description or ">" in description:
        return False, "Description cannot contain angle brackets (< or >)"
    if len(description) > MAX_DESCRIPTION_LENGTH:
        return False, f"Description is too long ({len(description)} characters). Maximum is {MAX_DESCRIPTION_LENGTH} characters."

    compatibility = frontmatter.get("compatibility")
    if compatibility is not None:
        if not isinstance(compatibility, str):
            return False, f"Compatibility must be a string, got {type(compatibility).__name__}"
        if len(compatibility) > MAX_COMPATIBILITY_LENGTH:
            return False, f"Compatibility is too long ({len(compatibility)} characters). Maximum is {MAX_COMPATIBILITY_LENGTH} characters."

    metadata = frontmatter.get("metadata")
    if metadata is not None and not isinstance(metadata, dict):
        return False, "Field 'metadata' must be a dictionary mapping keys to values"

    warnings = []
    line_count = len(content.splitlines())
    if line_count > MAX_SKILL_MD_LINES:
        warnings.append(f"SKILL.md is {line_count} lines (recommended maximum is {MAX_SKILL_MD_LINES} lines)")

    # Validate local links in SKILL.md (must be relative to skill root, exist, and not traverse upward)
    for target in _extract_local_targets(body):
        if target.startswith("/") or target.startswith("\\") or re.match(r"^[a-zA-Z]:", target):
            return False, f"Link target '{target}' in SKILL.md must be relative to skill root, not an absolute path"
        norm_parts = Path(target).parts
        if ".." in norm_parts:
            return False, f"Link target '{target}' in SKILL.md must not traverse above the skill root ('..')"
        if target.startswith("./"):
            warnings.append(f"Link target '{target}' in SKILL.md uses leading './'; prefer direct root-relative path '{target[2:]}'")
        resolved = (skill_path / target).resolve()
        if not resolved.exists():
            return False, f"Referenced path '{target}' in SKILL.md does not exist at {resolved}"

    # Check references/ directory for nested subdirectories and chained reference-to-reference links
    refs_dir = skill_path / "references"
    if refs_dir.exists() and refs_dir.is_dir():
        for item in refs_dir.rglob("*"):
            rel_ref = item.relative_to(skill_path)
            if item.is_dir():
                return False, f"Nested directory '{rel_ref}' inside references/ violates the one-level-deep rule"
            if item.suffix.lower() in {".md", ".mdx"}:
                ref_text = item.read_text(encoding="utf-8", errors="replace")
                for ref_target in _extract_local_targets(ref_text):
                    if ref_target.endswith(".md") or ref_target.endswith(".mdx") or "references/" in ref_target:
                        warnings.append(
                            f"Reference file '{rel_ref}' links to '{ref_target}' (keep references one hop from SKILL.md; avoid reference chains)"
                        )

    msg = "Skill is valid!"
    if warnings:
        msg += "\nWarnings:\n" + "\n".join(f"  - {w}" for w in warnings)
    return True, msg


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python quick_validate.py <skill_directory>")
        sys.exit(1)

    valid, message = validate_skill(sys.argv[1])
    print(message)
    sys.exit(0 if valid else 1)
