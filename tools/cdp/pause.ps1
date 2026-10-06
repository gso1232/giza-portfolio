# suspend or resume my background Blender (only the one rendering from this project), so a measurement has the GPU
param([switch]$Resume)
Add-Type -TypeDefinition @"
using System; using System.Runtime.InteropServices;
public static class P { [DllImport("ntdll.dll")] public static extern int NtSuspendProcess(IntPtr h); [DllImport("ntdll.dll")] public static extern int NtResumeProcess(IntPtr h); }
"@
$procs = Get-CimInstance Win32_Process -Filter "Name='blender.exe'" | Where-Object { $_.CommandLine -match 'factory-startup' -and $_.CommandLine -match 'tools/blender' }
foreach ($p in $procs) {
  $h = (Get-Process -Id $p.ProcessId).Handle
  if ($Resume) { [void][P]::NtResumeProcess($h); "resumed $($p.ProcessId)" } else { [void][P]::NtSuspendProcess($h); "suspended $($p.ProcessId)" }
}
