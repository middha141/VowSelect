@echo off
cd /d "C:\Users\middh\Desktop\Python\Projects\VowSelect\backend"
"C:\Users\middh\Desktop\Python\Projects\VowSelect\backend\venv\Scripts\python.exe" -m uvicorn server:app --reload --host 0.0.0.0 --port 8001
pause
