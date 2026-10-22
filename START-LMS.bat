@echo off
title Self Scale Academy LMS - Local Server
cd /d "%~dp0"
echo.
echo  ============================================
echo   Self Scale Academy LMS is starting...
echo   Open in your browser:  http://localhost:8000
echo   Keep this window OPEN while using the LMS.
echo   Close this window to stop.
echo  ============================================
echo.
where python >nul 2>nul && (start "" http://localhost:8000 & python -m http.server 8000 & goto :eof)
where py >nul 2>nul && (start "" http://localhost:8000 & py -m http.server 8000 & goto :eof)
where npx >nul 2>nul && (start "" http://localhost:8000 & npx --yes serve -l 8000 . & goto :eof)
echo  Python was not found on this PC.
echo  Please install Python from https://www.python.org/downloads/ (tick "Add to PATH"), then run this file again.
pause
