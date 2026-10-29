from pathlib import Path
import json

root = Path(__file__).resolve().parent
payloads = sorted(root.glob(".__sourcepayload_*.json"))
written = 0
for payload_path in payloads:
    rows = json.loads(payload_path.read_text(encoding="utf-8"))
    for item in rows:
        target = root.joinpath(*item["path"].split("/"))
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(item["content"], encoding="utf-8")
        written += 1
    payload_path.unlink()
print(f"Extracted {written} source files from {len(payloads)} payloads into {root}")
