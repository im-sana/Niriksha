#!/usr/bin/env bash

set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

if [[ -x "$BACKEND_DIR/.venv/bin/python" ]]; then
  PREFERRED_PYTHON="$BACKEND_DIR/.venv/bin/python"
else
  PREFERRED_PYTHON="python3"
fi

PYTHON_CMD="$PREFERRED_PYTHON"
if ! "$PYTHON_CMD" -m pytest --version >/dev/null 2>&1; then
  for candidate in "/usr/local/bin/python3" "python3" "python"; do
    if command -v "$candidate" >/dev/null 2>&1 || [[ -x "$candidate" ]]; then
      if "$candidate" -m pytest --version >/dev/null 2>&1; then
        PYTHON_CMD="$candidate"
        break
      fi
    fi
  done
fi

EXIT_CODE=0

BACKEND_COMPILE_TARGETS=(
  "$BACKEND_DIR/app.py"
  "$BACKEND_DIR/database"
  "$BACKEND_DIR/detection_modules"
  "$BACKEND_DIR/middleware"
  "$BACKEND_DIR/models"
  "$BACKEND_DIR/routes"
  "$BACKEND_DIR/services"
  "$BACKEND_DIR/utils"
  "$BACKEND_DIR/test_db.py"
)

if [[ -f "$BACKEND_DIR/main.py" ]]; then
  BACKEND_COMPILE_TARGETS=("$BACKEND_DIR/main.py" "${BACKEND_COMPILE_TARGETS[@]}")
fi

run_step() {
  local name="$1"
  shift

  echo
  echo "============================================================"
  echo "▶ $name"
  echo "============================================================"

  "$@"
  local status=$?
  if [[ $status -ne 0 ]]; then
    echo "✗ FAILED: $name"
    EXIT_CODE=1
  else
    echo "✓ PASSED: $name"
  fi
}

echo "Running full project checks from: $ROOT_DIR"
echo "Using Python command: $PYTHON_CMD"

run_step "Backend syntax compile" \
  "$PYTHON_CMD" -m compileall -q \
  "${BACKEND_COMPILE_TARGETS[@]}"

run_step "Backend pytest" \
  "$PYTHON_CMD" -m pytest -q -p pytest_asyncio --asyncio-mode=auto "$BACKEND_DIR/test_db.py"

run_step "Frontend install" bash -c "cd '$FRONTEND_DIR' && npm install"
run_step "Frontend lint" bash -c "cd '$FRONTEND_DIR' && npm run lint"
run_step "Frontend build" bash -c "cd '$FRONTEND_DIR' && npm run build"

echo
echo "============================================================"
if [[ $EXIT_CODE -eq 0 ]]; then
  echo "All checks passed."
else
  echo "One or more checks failed. See logs above."
fi
echo "============================================================"

exit $EXIT_CODE