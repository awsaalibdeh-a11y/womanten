# Womanten for Windows

`Womanten.cs` is the whole app (C# 5, builds with the compiler that ships with Windows). `build.ps1` compiles it.

It needs Microsoft's WebView2 .NET library, which is not in git. Get `Microsoft.Web.WebView2` from nuget.org (tested with 1.0.2903.40) and put these three files in `windows/lib/`:
`Microsoft.Web.WebView2.Core.dll`, `Microsoft.Web.WebView2.WinForms.dll` (from `lib/net462`) and `WebView2Loader.dll` (from `runtimes/win-x64/native`). They are signed by Microsoft; check with `Get-AuthenticodeSignature`.

`dist\Womanten.exe --selftest` is not available (it is a Windows app); build also produces `test\WomantenTest.exe --selftest`, which checks the lock rules.
The packaged download is `static/Womanten-Windows.zip`. Bump `windows/BUILD` and `MainForm.Build` together when you release a new one.
