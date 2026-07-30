#!/usr/bin/env python3
"""Dev-only static server that disables caching, so edits show up on refresh
without needing cache-busting query strings or hard refreshes."""
import http.server
import sys

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5500
    http.server.test(HandlerClass=NoCacheHandler, port=port)
