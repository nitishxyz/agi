#!/bin/bash

# Script to capture and compare Claude Code vs AGI traffic
#
# SETUP:
# 1. Trust mitmproxy CA cert (run once):
#    sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ~/.mitmproxy/mitmproxy-ca-cert.pem
#
# 2. Start mitmproxy in one terminal:
#    mitmproxy -s scripts/capture-anthropic.py -p 8080
#
# USAGE:
#   ./scripts/capture-traffic.sh claude    # Capture real Claude Code requests
#   ./scripts/capture-traffic.sh agi       # Capture AGI spoofed requests

set -e

PROXY="http://127.0.0.1:8080"

if [ "$1" == "claude" ]; then
    echo "Starting Claude Code with proxy..."
    echo "Type a message and watch mitmproxy output"
    echo ""
    HTTP_PROXY=$PROXY HTTPS_PROXY=$PROXY NODE_TLS_REJECT_UNAUTHORIZED=0 claude

elif [ "$1" == "agi" ]; then
    echo "Starting AGI with proxy..."
    echo "Type a message and watch mitmproxy output"
    echo ""
    cd "$(dirname "$0")/.."
    HTTP_PROXY=$PROXY HTTPS_PROXY=$PROXY NODE_TLS_REJECT_UNAUTHORIZED=0 bun run dev:cli

else
    echo "Usage: $0 [claude|agi]"
    echo ""
    echo "First, start mitmproxy in another terminal:"
    echo "  mitmproxy -s scripts/capture-anthropic.py -p 8080"
    echo ""
    echo "Then capture traffic:"
    echo "  $0 claude   # Capture real Claude Code traffic"
    echo "  $0 agi      # Capture AGI spoofed traffic"
fi
