@echo off
setlocal enabledelayedexpansion

set "ROOT_DIR=%~dp0"
set "BACKEND_DIR=%ROOT_DIR%backend"
set "FRONTEND_DIR=%ROOT_DIR%frontend"

set "PYTHON_CMD=python"
if exist "%BACKEND_DIR%\.venv\Scripts\python.exe" (
  set "PYTHON_CMD=%BACKEND_DIR%\.venv\Scripts\python.exe"
) else (
  where py >nul 2>&1
  if !errorlevel! == 0 set "PYTHON_CMD=py -3"
)

call %PYTHON_CMD% -m pytest --version >nul 2>&1
if errorlevel 1 (
  where py >nul 2>&1
  if !errorlevel! == 0 (
    call py -3 -m pytest --version >nul 2>&1
    if !errorlevel! == 0 set "PYTHON_CMD=py -3"
  )
)

set "EXIT_CODE=0"

echo Running full project checks from: %ROOT_DIR%
echo Using Python command: %PYTHON_CMD%

echo.
echo ============================================================
echo ^>^> Backend syntax compile
echo ============================================================
call %PYTHON_CMD% -m compileall -q ^
  "%BACKEND_DIR%\app.py" ^
  "%BACKEND_DIR%\main.py" ^
  "%BACKEND_DIR%\database" ^
  "%BACKEND_DIR%\detection_modules" ^
  "%BACKEND_DIR%\middleware" ^
  "%BACKEND_DIR%\models" ^
  "%BACKEND_DIR%\routes" ^
  "%BACKEND_DIR%\services" ^
  "%BACKEND_DIR%\utils" ^
  "%BACKEND_DIR%\test_db.py"
if errorlevel 1 (
  echo FAILED: Backend syntax compile
  set "EXIT_CODE=1"
) else (
  echo PASSED: Backend syntax compile
)

echo.
echo ============================================================
echo ^>^> Backend pytest
echo ============================================================
call %PYTHON_CMD% -m pytest -q -p pytest_asyncio --asyncio-mode=auto "%BACKEND_DIR%\test_db.py"
if errorlevel 1 (
  echo FAILED: Backend pytest
  set "EXIT_CODE=1"
) else (
  echo PASSED: Backend pytest
)

echo.
echo ============================================================
echo ^>^> Frontend install
echo ============================================================
pushd "%FRONTEND_DIR%"
call npm install
if errorlevel 1 (
  echo FAILED: Frontend install
  set "EXIT_CODE=1"
) else (
  echo PASSED: Frontend install
)

echo.
echo ============================================================
echo ^>^> Frontend lint
echo ============================================================
call npm run lint
if errorlevel 1 (
  echo FAILED: Frontend lint
  set "EXIT_CODE=1"
) else (
  echo PASSED: Frontend lint
)

echo.
echo ============================================================
echo ^>^> Frontend build
echo ============================================================
call npm run build
if errorlevel 1 (
  echo FAILED: Frontend build
  set "EXIT_CODE=1"
) else (
  echo PASSED: Frontend build
)
popd

echo.
echo ============================================================
if "%EXIT_CODE%"=="0" (
  echo All checks passed.
) else (
  echo One or more checks failed. See logs above.
)
echo ============================================================

exit /b %EXIT_CODE%