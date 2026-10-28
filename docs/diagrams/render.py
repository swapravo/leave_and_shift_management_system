"""Regenerate the PNG diagrams embedded in docs/*.md.

Each diagram in the docs looks like this:

    <!-- diagram: NAME -->
    ![Alt text](diagrams/NAME.png)

    <details>
    <summary>Diagram source (Mermaid)</summary>

    ```text
    ...mermaid source...
    ```

    </details>

The Mermaid source under the image is the source of truth: edit it, then run

    python docs/diagrams/render.py [--puppeteer-config FILE]

which renders every block to docs/diagrams/NAME.png with mermaid-cli (needs Node.js and a Chromium that
puppeteer can launch; pass a puppeteer config JSON with "executablePath" to use an existing browser).
"""
import argparse
import re
import subprocess
import sys
import tempfile
from pathlib import Path

MERMAID_CLI = "@mermaid-js/mermaid-cli@12.0.0"
DOCS = Path(__file__).resolve().parent.parent
OUT = DOCS / "diagrams"
BLOCK = re.compile(
    r"<!-- diagram: (?P<name>[a-z0-9-]+) -->.*?<summary>Diagram source \(Mermaid\)</summary>\s*"
    r"```text\n(?P<src>.*?)```",
    re.S,
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--puppeteer-config", help="puppeteer config JSON passed to mmdc -p")
    args = parser.parse_args()

    blocks = [(m["name"], m["src"], md.name) for md in sorted(DOCS.glob("*.md")) for m in BLOCK.finditer(md.read_text())]
    names = [name for name, _, _ in blocks]
    duplicates = {n for n in names if names.count(n) > 1}
    if duplicates:
        print(f"Duplicate diagram names: {', '.join(sorted(duplicates))}", file=sys.stderr)
        return 1

    with tempfile.TemporaryDirectory() as tmp:
        for name, src, doc in blocks:
            source = Path(tmp) / f"{name}.mmd"
            source.write_text(src)
            cmd = ["npx", "-y", MERMAID_CLI, "-i", str(source), "-o", str(OUT / f"{name}.png"),
                   "-b", "white", "-s", "2"]
            if args.puppeteer_config:
                cmd += ["-p", args.puppeteer_config]
            print(f"{doc}: {name}.png")
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode != 0:
                print(result.stderr, file=sys.stderr)
                return 1

    expected = {f"{n}.png" for n in names}
    for stale in sorted(p.name for p in OUT.glob("*.png") if p.name not in expected):
        print(f"warning: {stale} is no longer referenced by any doc", file=sys.stderr)
    print(f"Rendered {len(blocks)} diagrams.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
