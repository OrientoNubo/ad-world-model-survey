#!/usr/bin/env python3
"""
Build data files for the AD World Model paper relationship map.

Reads ONLY from: survey/notes/*_notes.md (96 paper note files)
Skips: 00_論文關係分析.md (analysis overview, not a paper note)

Outputs:
  - data/papers.json           (array of paper metadata for startup)
  - data/notes/<ShortName>.json (per-paper full section content, lazy-loaded)
"""

import os
import re
import json
import glob as globmod

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
SURVEY_DIR = os.path.dirname(PROJECT_DIR)  # survey/
NOTES_DIR = os.path.join(SURVEY_DIR, "notes")
DATA_DIR = os.path.join(PROJECT_DIR, "data")
NOTES_OUT_DIR = os.path.join(DATA_DIR, "notes")

# Section number → English key
SECTION_NAMES = {
    1: "basic_info",
    2: "research_overview",
    3: "paper_assessment",
    4: "problems_motivation",
    5: "contributions",
    6: "related_work",
    7: "methodology",
    8: "model_details",
    9: "training_settings",
    10: "experiments",
    11: "results",
    12: "discussion",
    13: "personal_thoughts",
    14: "key_citations",
    15: "appendix",
}

# Phase derivation from date (YYMM format)
# Phase 1: 2303-2311, Phase 2: 2312-2406, Phase 3: 2407-2412, Phase 4: 2501+
PHASE_RANGES = [
    (1, "Phase 1: 奠基期", 2303, 2311),
    (2, "Phase 2: 多元發展期", 2312, 2406),
    (3, "Phase 3: 規模化與統一期", 2407, 2412),
    (4, "Phase 4: 成熟整合期", 2501, 9999),
]


def date_to_phase(date_str):
    """Derive timeline phase from date string like '2023-09' or '2309'."""
    if not date_str:
        return 0, ""
    # Normalize: '2023-09' → 2309, '2024-05' → 2405
    m = re.match(r'(\d{4})-(\d{2})', date_str)
    if m:
        yymm = int(m.group(1)[2:]) * 100 + int(m.group(2))
    else:
        m2 = re.match(r'(\d{4})', date_str)
        if m2:
            yymm = int(m2.group(1))
        else:
            return 0, ""

    for num, label, start, end in PHASE_RANGES:
        if start <= yymm <= end:
            return num, label
    return 0, ""


def parse_sections(content):
    """Split notes markdown into sections by ## N. headers."""
    sections = {}
    parts = re.split(r'^(## \d+\..*?)$', content, flags=re.MULTILINE)

    current_key = "header"
    current_content = ""

    for part in parts:
        header_match = re.match(r'^## (\d+)\.', part)
        if header_match:
            if current_key != "header":
                sections[current_key] = current_content.strip()
            num = int(header_match.group(1))
            section_name = SECTION_NAMES.get(num, f"section_{num}")
            current_key = section_name
            current_content = part + "\n"
        else:
            current_content += part

    if current_key != "header":
        sections[current_key] = current_content.strip()

    return sections


def parse_metadata(content):
    """Extract structured metadata from notes markdown sections 1-3."""
    meta = {}

    # --- Section 1: Basic Info table ---
    table_pattern = r'\|\s*\*\*(.+?)\*\*\s*\|\s*(.+?)\s*\|'
    for match in re.finditer(table_pattern, content):
        key, val = match.group(1).strip(), match.group(2).strip()
        if key == "論文簡稱":
            meta["short_name"] = val
        elif key == "論文全稱":
            meta["title"] = val
        elif key == "arXiv ID":
            meta["arxiv_id"] = val
        elif key == "釋出日期":
            meta["date"] = val
        elif key == "發表會議/期刊":
            meta["venue"] = val

    # --- Section 1.2: Keywords ---
    kw_section = re.search(r'### 1\.2 關鍵詞\s*\n((?:- .+\n?)+)', content)
    if kw_section:
        meta["keywords"] = [
            line.lstrip("- ").strip()
            for line in kw_section.group(1).strip().split("\n")
            if line.strip().startswith("-")
        ]

    # --- Section 1.1: Authors ---
    # Format A: table with | 作者 | 單位 |
    author_table = re.search(
        r'### 1\.1 作者資訊\s*\n\|.*\|\s*\n\|[-\s|]+\|\s*\n((?:\|.*\|\s*\n?)+)',
        content
    )
    if author_table:
        authors = []
        for line in author_table.group(1).strip().split("\n"):
            cols = [c.strip() for c in line.strip("|").split("|")]
            if len(cols) >= 2 and cols[0] and cols[0] not in ("等", "作者"):
                authors.append(cols[0])
        if authors:
            meta["authors"] = authors
    else:
        # Format B: plain text after ### 1.1
        author_text = re.search(r'### 1\.1 作者資訊\s*\n\n?(.+?)(?:\n\n|\n###|\n---)', content, re.DOTALL)
        if author_text:
            text = author_text.group(1).strip()
            if text and text != "(待補充)":
                # Split by commas or newlines, take names
                names = [n.strip() for n in re.split(r'[,，\n]', text) if n.strip()]
                if names:
                    meta["authors"] = names

    # --- Section 2.2: Research field checkboxes ---
    cat_section = re.search(r'### 2\.2 研究領域分類\s*\n((?:- \[.\].*\n?)+)', content)
    if cat_section:
        categories = []
        for line in cat_section.group(1).strip().split("\n"):
            if line.strip().startswith("- [x]") or line.strip().startswith("- [X]"):
                cat = re.sub(r'^- \[[xX]\]\s*', '', line.strip())
                # Extract English name before parenthetical Chinese
                cat = re.sub(r'\s*\(.*?\)\s*$', '', cat).strip()
                if cat:
                    categories.append(cat)
        meta["task_category"] = categories

    # --- Section 2.3: AD Architecture checkboxes ---
    arch_section = re.search(r'### 2\.3 所使用的自動駕駛架構\s*\n((?:- \[.\].*\n?)+)', content)
    if arch_section:
        archs = []
        for line in arch_section.group(1).strip().split("\n"):
            if line.strip().startswith("- [x]") or line.strip().startswith("- [X]"):
                arch = re.sub(r'^- \[[xX]\]\s*', '', line.strip())
                arch = re.sub(r'\s*\(.*?\)\s*$', '', arch).strip()
                arch = arch.strip("*").strip()
                if arch:
                    archs.append(arch)
        meta["architecture"] = archs

    # --- Section 3.1: Star ratings ---
    rating_pattern = r'\|\s*\*\*(.+?)\*\*\s*\|\s*(⭐+)\s*\|'
    ratings = {}
    dim_map = {
        "創新性": "innovation",
        "技術深度": "technical_depth",
        "實驗完整度": "experiment_completeness",
        "寫作品質": "writing_quality",
        "實用價值": "practical_value",
        "綜合評分": "overall",
    }
    for match in re.finditer(rating_pattern, content):
        dim = match.group(1).strip()
        score = len(match.group(2))
        if dim in dim_map:
            ratings[dim_map[dim]] = score
    if ratings:
        meta["ratings"] = ratings

    return meta


def main():
    os.makedirs(NOTES_OUT_DIR, exist_ok=True)

    # Clear old notes output
    for f in os.listdir(NOTES_OUT_DIR):
        os.remove(os.path.join(NOTES_OUT_DIR, f))

    # Find all notes files
    note_files = sorted(globmod.glob(os.path.join(NOTES_DIR, "*_notes.md")))
    print(f"Found {len(note_files)} notes files in {NOTES_DIR}")

    papers = []
    skipped = []

    for idx, filepath in enumerate(note_files):
        filename = os.path.basename(filepath)

        # Skip the analysis overview file
        if filename.startswith("00_"):
            skipped.append(filename)
            continue

        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()

        # Parse metadata from sections 1-3
        meta = parse_metadata(content)
        short_name = meta.get("short_name", "")

        if not short_name:
            # Derive from filename: 2309_GAIA_notes.md → GAIA
            short_name = re.sub(r'^\d{4}_', '', filename)
            short_name = re.sub(r'_notes\.md$', '', short_name)
            meta["short_name"] = short_name

        # Sanitize short_name: take first part if contains slash, strip whitespace
        if '/' in short_name:
            short_name = short_name.split('/')[0].strip()
            meta["short_name"] = short_name

        # Derive year prefix from filename
        year_prefix = filename[:4] if filename[:4].isdigit() else ""

        date = meta.get("date", "")
        if not date and year_prefix:
            date = year_prefix

        # Parse all sections for notes JSON
        sections = parse_sections(content)

        # Build paper entry
        paper = {
            "id": len(papers) + 1,
            "short_name": short_name,
            "title": meta.get("title", ""),
            "date": date,
            "year": year_prefix,
            "venue": meta.get("venue", ""),
            "keywords": meta.get("keywords", []),
            "task_category": meta.get("task_category", []),
            "architecture": meta.get("architecture", []),
            "ratings": meta.get("ratings", {}),
            "arxiv_id": meta.get("arxiv_id", ""),
            "has_notes": True,
            "_filename": filename,
        }
        papers.append(paper)

        # Write individual notes JSON
        notes_json = {"sections": sections, "short_name": short_name}
        out_path = os.path.join(NOTES_OUT_DIR, f"{short_name}.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(notes_json, f, ensure_ascii=False, indent=1)

    # Sort papers by date
    papers.sort(key=lambda p: p.get("year", "") + p.get("date", ""))
    # Re-assign IDs
    for i, p in enumerate(papers):
        p["id"] = i + 1

    # Remove internal field
    for p in papers:
        p.pop("_filename", None)

    # Write papers.json
    papers_path = os.path.join(DATA_DIR, "papers.json")
    with open(papers_path, "w", encoding="utf-8") as f:
        json.dump(papers, f, ensure_ascii=False, indent=1)

    size_kb = os.path.getsize(papers_path) / 1024

    # Summary
    print(f"\nParsed {len(papers)} papers")
    if skipped:
        print(f"Skipped: {', '.join(skipped)}")

    # Stats
    with_title = sum(1 for p in papers if p["title"])
    with_keywords = sum(1 for p in papers if p["keywords"])
    with_categories = sum(1 for p in papers if p["task_category"])
    with_ratings = sum(1 for p in papers if p["ratings"])
    notes_count = len(os.listdir(NOTES_OUT_DIR))

    print(f"  With title: {with_title}")
    print(f"  With keywords: {with_keywords}")
    print(f"  With task categories: {with_categories}")
    print(f"  With ratings: {with_ratings}")
    print(f"\nOutput:")
    print(f"  {papers_path} ({size_kb:.1f} KB)")
    print(f"  {NOTES_OUT_DIR}/ ({notes_count} JSON files)")

    # List unique task categories
    all_cats = set()
    for p in papers:
        all_cats.update(p["task_category"])
    if all_cats:
        print(f"\nTask categories found: {sorted(all_cats)}")



if __name__ == "__main__":
    main()
