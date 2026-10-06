# (final3: the tower print moved onto the lit wall, above the plants; the PC still only re-rendered where it was
# and where it is, the phone views keep it where it was, out of their frame)
# the room again with his new wall (2026-10-02): the two framed prints and his pictures. The old renders are moved
# aside (not deleted); the stills render whole again, the loops only their still base and their pictures' map (the
# moving parts, the plants, the steam and the dust, are nowhere near the new frames and are kept). Restartable.
Set-Location 'D:\projectss\giza-portfolio'
$bl = 'D:\tools\blender-5.2.2-windows-x64\blender.exe'
$F = 'D:\projectss\giza-portfolio\blender\final'
$OLD = "$F\old-2026-10-02"
$common = @('--glb', 'blender/desk-loop.glb', '--info', 'blender/desk-info.json')
$fin = @('--exposure', '-0.9', '--dust', '1.5', '--bloom', '0.08', '--vignette', '0.28', '--split', '0.3', '--grain', '0.006', '--posters', 'D:\projectss\giza-portfolio\blender\posters')
function Stamp($m) { "$(Get-Date -Format HH:mm:ss) $m" }
function Run($script, $rest) { & $bl -b --factory-startup -P $script -- @common @rest 2>&1 | Where-Object { $_ -match 'strip \d|STILL DONE|base in|clear base|frame \d|LOOP DONE|Traceback|Error:|OIDN' -and $_ -notmatch 'HIPEW' } | ForEach-Object { "$(Get-Date -Format HH:mm:ss) $_" } }

if (-not (Test-Path "$OLD\moved.txt")) {
  New-Item -ItemType Directory -Force $OLD, "$OLD\loop-pc", "$OLD\loop-phone" | Out-Null
  foreach ($n in 'pc-main.npy', 'pc-dust.npy', 'pc-cards.npy', 'pc-cards.json', 'pc.png', 'pc.jpg', 'phone-main.npy', 'phone-dust.npy', 'phone-cards.npy', 'phone-cards.json', 'phone.png', 'phone.jpg') {
    if (Test-Path "$F\$n") { Move-Item "$F\$n" "$OLD\$n" -Force }
  }
  foreach ($d in 'loop-pc', 'loop-phone') {
    foreach ($n in 'base.npy', 'base-clear.npy', 'cards.npy', 'cards.json') { if (Test-Path "$F\$d\$n") { Move-Item "$F\$d\$n" "$OLD\$d\$n" -Force } }
  }
  'moved' | Out-File "$OLD\moved.txt"
  Stamp 'old renders moved aside'
}

$PCZ = '-50.5,58,13'; $PHZ = '-129,50,21'
Stamp 'PC still: the two places patched'
$env:DESK_ZLEFT = $PCZ
if (Test-Path "$F\pc-cards.npy") {
  & $bl -b --factory-startup -P tools/blender/patch_still.py -- @common --view wide --w 3840 --h 1800 --samples 256 --rest 0.5 --out "$F\pc" --rect 0,0,620,760 --rect 1060,0,1500,560 2>&1 | Where-Object { $_ -match 'patch \d|PATCH DONE|Traceback|Error:' } | ForEach-Object { "$(Get-Date -Format HH:mm:ss) $_" }
}
Run 'tools/blender/still.py' @('--view', 'wide', '--w', '3840', '--h', '1800', '--samples', '256', '--dust-samples', '160', '--strips', '8', '--rest', '0.5', '--out', "$F\pc")
python tools/blender/finish.py "$F\pc" "$F\pc.png" @fin

Stamp 'phone still'
$env:DESK_ZLEFT = $PHZ
Run 'tools/blender/still.py' @('--view', 'mc4', '--w', '1080', '--h', '2340', '--samples', '256', '--dust-samples', '160', '--strips', '6', '--rest', '0.5', '--out', "$F\phone")
python tools/blender/finish.py "$F\phone" "$F\phone.png" @fin

Stamp 'PC loop (base and pictures)'
$env:DESK_ZLEFT = $PCZ
Run 'tools/blender/loop.py' @('--view', 'wide', '--w', '1920', '--h', '900', '--frames', '96', '--samples', '64', '--base-samples', '384', '--rest', '0.5', '--regions', 'blender/motion-regions.json', '--out', "$F\loop-pc")
python tools/blender/loop_finish.py "$F\loop-pc" "$F\loop-pc.mp4" --fps 24 --keep 556,0,716,244 @fin

Stamp 'phone loop (base and pictures)'
$env:DESK_ZLEFT = $PHZ
Run 'tools/blender/loop.py' @('--view', 'mc4', '--w', '1080', '--h', '2340', '--frames', '96', '--samples', '64', '--base-samples', '384', '--rest', '0.5', '--regions', 'blender/motion-regions.json', '--out', "$F\loop-phone")
python tools/blender/loop_finish.py "$F\loop-phone" "$F\loop-phone-900.mp4" --fps 24 --width 900 --crf 20 @fin

Stamp 'export to the site'
python -c "
import cv2, os, shutil
F = r'D:\projectss\giza-portfolio\blender\final'; O = r'D:\projectss\giza-portfolio\public\desk\final'
pc = cv2.imread(F + r'\pc.png'); ph = cv2.imread(F + r'\phone.png')
for w in (3840, 2560, 1920, 1280):
    im = pc if w == 3840 else cv2.resize(pc, (w, round(w * 1800 / 3840)), interpolation=cv2.INTER_AREA)
    cv2.imwrite(O + r'\pc-%d.webp' % w, im, [cv2.IMWRITE_WEBP_QUALITY, 92])
for w in (1080, 720):
    im = ph if w == 1080 else cv2.resize(ph, (w, round(w * 2340 / 1080)), interpolation=cv2.INTER_AREA)
    cv2.imwrite(O + r'\phone-%d.webp' % w, im, [cv2.IMWRITE_WEBP_QUALITY, 92])
shutil.copy(F + r'\loop-pc.mp4', O + r'\loop-pc.mp4'); shutil.copy(F + r'\loop-phone-900.mp4', O + r'\loop-phone.mp4')
print({f: os.path.getsize(O + '\\\\' + f) // 1024 for f in os.listdir(O)})
"
Stamp 'FINAL3 DONE'
