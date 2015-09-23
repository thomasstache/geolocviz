@echo off
set OPT_PATH=%~dp0
set BASE_PATH=D:\Thomas\Documents\GitHub

cd /d %BASE_PATH%\geolocviz\js

node %OPT_PATH%\r.js -v
node %OPT_PATH%\r.js -o app.build.js
pause;
