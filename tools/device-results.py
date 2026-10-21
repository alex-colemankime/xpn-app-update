# Builds the device test results sheet (docs/device-test-results.xlsx) from
# the checklist in docs/device-testing.md, so the two never drift apart:
# one row per check, one column per device, a Pass / Fail / Blocked / N/A
# choice in each cell, and a summary sheet that counts them. A check that
# names one platform ("iPhone:", "Android:", "CarPlay", "Android Auto") is
# marked N/A for the others already.
#
#   python3 tools/device-results.py
#
# Needs openpyxl (pip install openpyxl).
import re
from pathlib import Path

from openpyxl import Workbook
from openpyxl.formatting.rule import CellIsRule
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = Path(__file__).resolve().parent.parent
PLAN = ROOT / "docs" / "device-testing.md"
OUT = ROOT / "docs" / "device-test-results.xlsx"

# The devices the agency brief asks for (docs/agency-brief.md), and the cars.
DEVICES = [
    ("Current iPhone 1", "ios"),
    ("Current iPhone 2", "ios"),
    ("Older iPhone (iOS 16/17)", "ios"),
    ("iPad", "ios"),
    ("Pixel", "android"),
    ("Samsung", "android"),
]
RESULTS = ["Pass", "Fail", "Blocked", "N/A"]


def checks(text):
    """(area, check) for every "- [ ]" item, its wrapped lines joined."""
    area, items = "", []
    for line in text.splitlines():
        if line.startswith("## "):
            area = line[3:].strip()
        elif line.startswith("- [ ] "):
            items.append([area, line[6:].strip()])
        elif items and line.startswith("      ") and line.strip():
            items[-1][1] += " " + line.strip()
        elif not line.strip():
            continue
    return [(a, re.sub(r"\s+", " ", c)) for a, c in items]


def platform(check):
    """The one platform a check is about, or None for both."""
    if re.match(r"(iPhone|iPad)\b", check) or check.startswith(("CarPlay", "AirPlay")):
        return "ios"
    if check.startswith(("Android", "Android Auto")):
        return "android"
    return None


def main():
    rows = checks(PLAN.read_text(encoding="utf-8"))
    wb = Workbook()
    ws = wb.active
    ws.title = "Results"
    bold = Font(bold=True)
    wrap = Alignment(wrap_text=True, vertical="top")

    # Who tested what: one line per device, above the checks.
    ws.append(["WXPN app device tests", "", *[d for d, _ in DEVICES], "Notes"])
    for label in ["OS version", "App build", "Tester", "Date"]:
        ws.append(["", label, *[""] * len(DEVICES), ""])
    ws.append([])
    header = ws.max_row + 1
    ws.append(["Area", "Check", *[d for d, _ in DEVICES], "Notes and issue links"])
    for cell in ws[1] + ws[header]:
        cell.font = bold
    first = header + 1
    for area, check in rows:
        only = platform(check)
        marks = ["N/A" if only and only != kind else "" for _, kind in DEVICES]
        ws.append([area, check, *marks, ""])
    last = ws.max_row

    ws.column_dimensions["A"].width = 16
    ws.column_dimensions["B"].width = 70
    for i in range(len(DEVICES)):
        ws.column_dimensions[get_column_letter(3 + i)].width = 14
    ws.column_dimensions[get_column_letter(3 + len(DEVICES))].width = 40
    for row in ws.iter_rows(min_row=first, max_row=last):
        for cell in row:
            cell.alignment = wrap
    ws.freeze_panes = ws.cell(row=first, column=3)

    # A choice in each result cell, colored by what it says.
    span = f"C{first}:{get_column_letter(2 + len(DEVICES))}{last}"
    choice = DataValidation(type="list", formula1='"' + ",".join(RESULTS) + '"', allow_blank=True)
    ws.add_data_validation(choice)
    choice.add(span)
    for result, color in [("Pass", "D7EFD9"), ("Fail", "F8D4CC"), ("Blocked", "FBE9C4"), ("N/A", "E6E6E3")]:
        ws.conditional_formatting.add(
            span, CellIsRule(operator="equal", formula=[f'"{result}"'], fill=PatternFill("solid", fgColor=color))
        )

    # Counts per device, and what's left to run.
    summary = wb.create_sheet("Summary")
    summary.append(["Device", *RESULTS, "Not run"])
    for cell in summary[1]:
        cell.font = bold
    for i, (device, _) in enumerate(DEVICES):
        col = get_column_letter(3 + i)
        cells = f"Results!{col}{first}:{col}{last}"
        summary.append(
            [
                device,
                *[f'=COUNTIF({cells},"{r}")' for r in RESULTS],
                f'=COUNTBLANK({cells})',
            ]
        )
    summary.column_dimensions["A"].width = 26
    wb.save(OUT)
    print(f"{OUT.relative_to(ROOT)}: {len(rows)} checks, {len(DEVICES)} devices")


if __name__ == "__main__":
    main()
