#!/usr/bin/env python3
"""Verify physical PDF lines and lossless previews; requires pdfplumber and Pillow."""

import argparse
import json
import re
import subprocess
import tempfile
import unicodedata
from pathlib import Path


def normalize(text):
    text = unicodedata.normalize("NFKC", text).replace("\u2022", "")
    text = re.sub("[\u2010-\u2015\u2212]", "-", text)
    text = re.sub("[\u223c\u2248]", "~", text)
    text = re.sub("[\u2018\u2019]", "'", text)
    return " ".join(text.split())


def compare_lines(actual, expected):
    errors = []
    if len(actual) != len(expected):
        errors.append(f"Expected {len(expected)} physical lines, found {len(actual)}")
    for index, (line, reference) in enumerate(zip(actual, expected), start=1):
        if normalize(line["text"]) != normalize(reference["text"]):
            errors.append(f"Line {index} words differ: {line['text']!r}")
        if abs(line["baseline"] - reference["baseline"]) > 0.75:
            errors.append(f"Line {index} baseline differs by more than 0.75pt")
        if abs(line["x"] - reference["x"]) > 0.25:
            errors.append(f"Line {index} left edge differs by more than 0.25pt")
        if line["right"] > 576.25 or line["x"] < 35.75:
            errors.append(f"Line {index} exceeds the horizontal page margins")
    return errors


def check_layout(pdf_path, reference):
    import pdfplumber

    with pdfplumber.open(pdf_path) as pdf:
        if len(pdf.pages) != 1:
            return ["Resume must contain exactly one page"]
        page = pdf.pages[0]
        if (page.width, page.height) != (612, 792):
            return ["Resume must use Letter page dimensions"]
        actual = []
        for line in page.extract_text_lines(return_chars=True):
            first = next(char for char in line["chars"] if char["text"].strip() and char["text"] != "\u2022")
            actual.append({
                "text": line["text"], "x": first["x0"], "right": line["x1"],
                "baseline": page.height - first["matrix"][5],
            })
        errors = compare_lines(actual, reference["lines"])
        rules = sorted((rect for rect in page.rects if rect["width"] > 500 and 0 < rect["height"] < 1), key=lambda rect: rect["top"])
        if len(rules) != len(reference["rules"]):
            errors.append("Section rule count differs from the reference")
        for actual_rule, expected_rule in zip(rules, reference["rules"]):
            for field, actual_field in [("x", "x0"), ("top", "top"), ("width", "width"), ("height", "height")]:
                if abs(actual_rule[actual_field] - expected_rule[field]) > 0.25:
                    errors.append(f"Section rule {field} differs by more than 0.25pt")
        # Prose also preserves the reference's word spacing and right line ends.
        by_text = {normalize(line["text"]): line for line in actual}
        for lines in reference["paragraphs"].values():
            for line in lines:
                found = by_text.get(normalize(line["text"]))
                if found and abs(found["right"] - found["x"] - line["width"]) > 0.25:
                    errors.append(f"Line width differs by more than 0.25pt: {line['text']!r}")
        return errors


def check_previews(pdf_path, public_root):
    from PIL import Image, ImageChops

    errors = []
    variants = json.loads(subprocess.check_output([
        "node", "--input-type=module", "-e",
        "import {resumePreviewVariants} from './main/src/data/resume-preview.mjs'; console.log(JSON.stringify(resumePreviewVariants))",
    ], cwd=Path(__file__).resolve().parents[2], text=True))
    with tempfile.TemporaryDirectory(prefix="resume-layout-check-") as directory:
        for variant in variants:
            raster = Path(directory) / str(variant["width"])
            subprocess.run([
                "pdftoppm", "-f", "1", "-singlefile", "-scale-to-x", str(variant["width"]),
                "-scale-to-y", "-1", "-png", str(pdf_path), str(raster),
            ], check=True, capture_output=True)
            expected = Image.open(raster.with_suffix(".png")).convert("RGB")
            paths = [public_root / variant["src"].lstrip("/")]
            if variant["width"] == 960:
                paths.append(public_root / "resume-preview.png")
            for path in paths:
                actual = Image.open(path).convert("RGB")
                if actual.size != expected.size or ImageChops.difference(actual, expected).getbbox():
                    errors.append(f"{path.name} pixels differ from the final PDF render")
    return errors


def main():
    app_root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pdf", type=Path, default=app_root / "public/waffyAhmedResume.pdf")
    parser.add_argument("--assets", action="store_true", help="Also decode and compare every preview against the final PDF")
    args = parser.parse_args()
    reference = json.loads((app_root / "scripts/resume-layout-reference.json").read_text())
    errors = check_layout(args.pdf, reference)
    if args.assets:
        errors.extend(check_previews(args.pdf, app_root / "public"))
    if errors:
        raise SystemExit("Resume layout check failed:\n- " + "\n- ".join(errors))
    print(f"Resume layout check passed: {len(reference['lines'])} physical lines" + ("; all previews match the final PDF pixels" if args.assets else ""))


if __name__ == "__main__":
    main()
