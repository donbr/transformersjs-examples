# Static server with COOP/COEP (matches vercel.json) plus POST /save for bench results.
import http.server, os, re, sys
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()
    def do_POST(self):
        m = re.match(r"^/save\?name=(scores-[\w.+-]+\.json)$", self.path)
        if not m: return self.send_error(400)
        body = self.rfile.read(int(self.headers["Content-Length"]))
        open(m.group(1), "wb").write(body)
        self.send_response(200); self.end_headers(); self.wfile.write(b"ok")
http.server.ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1])), H).serve_forever()
