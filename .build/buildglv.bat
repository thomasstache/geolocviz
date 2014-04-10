@echo off
set BASE_PATH=D:\Thomas\Documents\GitHub

cd /d %BASE_PATH%\geolocviz\js

node %BASE_PATH%\r.js -o app.build.js
pause;
