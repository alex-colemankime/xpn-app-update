#!/usr/bin/env python3
# Looks through a screen dump from `uiautomator dump` for the first element
# whose text or accessible name (content-desc) matches a pattern, and prints
# the middle of it as "x y", ready for `adb shell input tap`. Exits 1 when
# nothing matches, or when the dump can't be read (a half-written file).
#
#   find-node.py ui.xml '^Play WXPN$'
#
# The app's page is a WebView, but Android lists its buttons and words in
# the dump like any other screen, so this finds them the same way.
import re
import sys
import xml.etree.ElementTree as ET


def main():
    if len(sys.argv) != 3:
        print("usage: find-node.py DUMP.xml PATTERN", file=sys.stderr)
        return 2
    try:
        root = ET.parse(sys.argv[1]).getroot()
    except (ET.ParseError, OSError):
        return 1
    pattern = re.compile(sys.argv[2], re.IGNORECASE)
    for node in root.iter("node"):
        names = (node.get("text") or "", node.get("content-desc") or "")
        if not any(pattern.search(name.strip()) for name in names if name):
            continue
        box = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.get("bounds") or "")
        if not box:
            continue
        x1, y1, x2, y2 = map(int, box.groups())
        # A zero-size match is a screen-reader-only label; keep looking for
        # one that can be tapped.
        if x2 <= x1 or y2 <= y1:
            continue
        print((x1 + x2) // 2, (y1 + y2) // 2)
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
