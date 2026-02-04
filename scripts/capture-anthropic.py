"""
mitmproxy script to capture Anthropic API requests to files.

Usage:
  mitmdump -s scripts/capture-anthropic.py -p 8080 --set stream_large_bodies=0

Output files:
  - capture/claude-requests.json   (real Claude Code)
  - capture/otto-requests.json      (otto spoofed)

Set which one to capture:
  OTTO_CAPTURE=claude mitmdump -s scripts/capture-anthropic.py -p 8080
  OTTO_CAPTURE=otto mitmdump -s scripts/capture-anthropic.py -p 8080
"""

import json
import os
from mitmproxy import http
from datetime import datetime
from pathlib import Path

# Determine output file based on env var
capture_type = os.environ.get('OTTO_CAPTURE', 'requests')
capture_dir = Path(__file__).parent.parent / 'capture'
capture_dir.mkdir(exist_ok=True)
output_file = capture_dir / f'{capture_type}-requests.json'

# Initialize or load existing captures
captures = []
if output_file.exists():
    try:
        captures = json.loads(output_file.read_text())
    except:
        captures = []

def save_captures():
    output_file.write_text(json.dumps(captures, indent=2))
    print(f"[SAVED] {len(captures)} requests to {output_file}")

def request(flow: http.HTTPFlow) -> None:
    """Capture requests to Anthropic API"""
    host = flow.request.pretty_host
    if "anthropic.com" not in host and "claude.ai" not in host:
        return

    print(f"[CAPTURE] {flow.request.method} {flow.request.pretty_url[:80]}...")

    # Parse request body
    body = None
    if flow.request.content:
        try:
            body = json.loads(flow.request.content)
        except:
            body = flow.request.content.decode('utf-8', errors='replace')

    # Build capture entry
    entry = {
        "timestamp": datetime.now().isoformat(),
        "type": "request",
        "method": flow.request.method,
        "url": flow.request.pretty_url,
        "host": host,
        "headers": dict(flow.request.headers),
        "body": body,
    }

    # Mask sensitive tokens but keep structure visible
    if "authorization" in entry["headers"]:
        auth = entry["headers"]["authorization"]
        if auth.startswith("Bearer ") and len(auth) > 30:
            entry["headers"]["authorization"] = f"Bearer {auth[7:20]}...[MASKED]...{auth[-8:]}"
    if "x-api-key" in entry["headers"]:
        key = entry["headers"]["x-api-key"]
        if len(key) > 20:
            entry["headers"]["x-api-key"] = f"{key[:8]}...[MASKED]...{key[-4:]}"

    captures.append(entry)
    save_captures()

def response(flow: http.HTTPFlow) -> None:
    """Capture responses from Anthropic API"""
    host = flow.request.pretty_host
    if "anthropic.com" not in host and "claude.ai" not in host:
        return

    print(f"[CAPTURE] Response {flow.response.status_code} from {host}")

    # Parse response body for errors
    body = None
    if flow.response.status_code >= 400 and flow.response.content:
        try:
            body = json.loads(flow.response.content)
        except:
            body = flow.response.content.decode('utf-8', errors='replace')
    elif flow.response.content:
        body = f"[{len(flow.response.content)} bytes]"

    entry = {
        "timestamp": datetime.now().isoformat(),
        "type": "response",
        "status": flow.response.status_code,
        "reason": flow.response.reason,
        "url": flow.request.pretty_url,
        "headers": dict(flow.response.headers),
        "body": body,
    }

    captures.append(entry)
    save_captures()
