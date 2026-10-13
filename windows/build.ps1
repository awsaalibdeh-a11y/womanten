# Builds Womanten for Windows with the C# compiler that ships with Windows (no SDK needed).
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$csc = 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
New-Item -ItemType Directory -Force dist, test | Out-Null
$refs = @('/r:System.Windows.Forms.dll','/r:System.Drawing.dll','/r:System.Web.Extensions.dll','/r:System.Core.dll','/r:lib\Microsoft.Web.WebView2.Core.dll','/r:lib\Microsoft.Web.WebView2.WinForms.dll')
& $csc /nologo /target:winexe /platform:x64 /codepage:65001 /out:dist\Womanten.exe @refs Womanten.cs
if ($LASTEXITCODE) { throw 'compile failed' }
& $csc /nologo /target:exe /platform:x64 /codepage:65001 /out:test\WomantenTest.exe @refs Womanten.cs
if ($LASTEXITCODE) { throw 'test build failed' }
Copy-Item lib\*.dll dist\ -Force; Copy-Item lib\*.dll test\ -Force
Get-Item dist\Womanten.exe | Select-Object Name, Length
