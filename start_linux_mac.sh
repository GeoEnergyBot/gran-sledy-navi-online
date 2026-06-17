#!/usr/bin/env sh
set -e
cd "$(dirname "$0")"
echo "Грань: Следы Нави доступна по адресу http://localhost:8080"
node server.mjs
