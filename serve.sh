#!/bin/bash
PORT=8888
cd "$(dirname "$0")/public"
echo "Serving at http://localhost:$PORT"
echo "Responsive tester: http://localhost:$PORT/responsive-test.html"
open "http://localhost:$PORT/responsive-test.html"
python3 -m http.server $PORT
