`Shift`加右键，在powershell打开

```bat
Invoke-WebRequest -Uri "https://cdn.jsdelivr.net/npm/@chenglou/pretext@0.0.3/dist/layout.js" -OutFile "layout.js"
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/gzuidhof/coi-serviceworker/master/coi-serviceworker.js" -OutFile "coi-serviceworker.js"
Invoke-WebRequest -Uri "https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.min.js" -OutFile "ffmpeg.min.js"
Invoke-WebRequest -Uri "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.js" -OutFile "ffmpeg-core.js"
Invoke-WebRequest -Uri "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.wasm" -OutFile "ffmpeg-core.wasm"

Invoke-WebRequest -Uri "https://cdn.jsdelivr.net/npm/@chenglou/pretext@0.0.3/dist/analysis.js" -OutFile "analysis.js"
Invoke-WebRequest -Uri "https://cdn.jsdelivr.net/npm/@chenglou/pretext@0.0.3/dist/measurement.js" -OutFile "measurement.js"
Invoke-WebRequest -Uri "https://cdn.jsdelivr.net/npm/@chenglou/pretext@0.0.3/dist/bidi.js" -OutFile "bidi.js"
Invoke-WebRequest -Uri "https://cdn.jsdelivr.net/npm/@chenglou/pretext@0.0.3/dist/line-break.js" -OutFile "line-break.js"
Invoke-WebRequest -Uri "https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/umd/814.ffmpeg.js" -OutFile "814.ffmpeg.js"
```

