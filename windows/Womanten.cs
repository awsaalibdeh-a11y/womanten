// Womanten for Windows.
//   * A real app window showing Womanten (Microsoft WebView2), that lives in the system tray.
//   * Locks distracting apps and websites (TikTok, Instagram, YouTube in browsers, plus any program you pick) until you earn time with reps on your webcam.
//   * Focus mode, lock hours, and gentle daily reminders.
// It only ever looks at WHICH program is in front and its window title, never at what is inside it. Everything is stored on this PC.
// Build (no SDK needed):  see build.ps1.  Written for the C# 5 compiler that ships with Windows.

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using Microsoft.Win32;

namespace WomantenApp
{
    // ------------------------------------------------------------------ what is saved
    public class Data
    {
        public bool Enabled = false;
        public List<string> Presets = new List<string>();
        public List<string> Custom = new List<string>();
        public int MinutesPerRep = 2;
        public bool ScheduleOn = false;
        public int From = 21;
        public int To = 7;
        public bool Reminders = true;
        public string Exercise = "pushup";
        public double EarnedSeconds = 0;
        public long FocusUntil = 0;          // UTC ticks
        public int FocusRepsLeft = 10;
        public string Day = "";
        public int RepsToday = 0;
        public int UsedSeconds = 0;
        public List<string> Fired = new List<string>();
        public string LastUpdateNag = "";
    }

    static class Native
    {
        [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder sb, int max);
        [DllImport("user32.dll")] public static extern int GetWindowThreadProcessId(IntPtr h, out int pid);
        [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
        [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
        [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
        [DllImport("user32.dll")] public static extern bool DestroyIcon(IntPtr h);
    }

    // ------------------------------------------------------------------ the rules of the lock (pure, so they can be tested)
    static class Rules
    {
        public static readonly string[] Browsers = { "chrome", "msedge", "firefox", "brave", "opera", "vivaldi", "arc", "chromium", "iexplore" };
        static readonly string[] Protected = { "explorer", "searchhost", "searchapp", "startmenuexperiencehost", "shellexperiencehost", "taskmgr", "lockapp", "dwm", "winlogon", "csrss", "systemsettings", "womanten", "msedgewebview2" };

        public static readonly Dictionary<string, string[]> PresetWords = new Dictionary<string, string[]>
        {
            { "TikTok", new[] { "tiktok" } }, { "Instagram", new[] { "instagram" } }, { "YouTube", new[] { "youtube" } }, { "Netflix", new[] { "netflix" } },
            { "Reddit", new[] { "reddit" } }, { "X (Twitter)", new[] { "twitter", "/ x -", "/ x —" } }, { "Facebook", new[] { "facebook" } }, { "Snapchat", new[] { "snapchat" } },
            { "Twitch", new[] { "twitch" } }, { "Discord", new[] { "discord" } }, { "Steam", new[] { "steam" } },
        };

        public static List<string> Words(Data d)
        {
            var w = new List<string>();
            foreach (var p in d.Presets) { string[] ws; if (PresetWords.TryGetValue(p, out ws)) w.AddRange(ws); }
            foreach (var c in d.Custom) { var t = (c ?? "").Trim().ToLowerInvariant(); if (t.Length >= 2) w.Add(t); }
            return w;
        }

        /// A browser is judged by its window title (the tab in front), any other program by its name.
        public static bool Matches(List<string> words, string proc, string title)
        {
            string p = (proc ?? "").ToLowerInvariant(), t = (title ?? "").ToLowerInvariant();
            if (p.Length == 0 || Array.IndexOf(Protected, p) >= 0) return false;
            bool browser = Array.IndexOf(Browsers, p) >= 0;
            foreach (var k in words)
            {
                if (browser && t.Contains(k)) return true;
                if (k.Length >= 4 && p.Contains(k)) return true;
            }
            return false;
        }

        public static bool InWindow(int hour, int from, int to)
        {
            if (from == to) return true;
            return from < to ? (hour >= from && hour < to) : (hour >= from || hour < to);
        }

        public static readonly string[,] Exercises = { { "pushup", "Push-ups" }, { "squat", "Squats" }, { "jack", "Jumping jacks" }, { "plank", "Plank hold" } };
        public static string ExLabel(string key) { for (int i = 0; i < Exercises.GetLength(0); i++) if (Exercises[i, 0] == key) return Exercises[i, 1]; return "Push-ups"; }
    }

    // ------------------------------------------------------------------ a small pop-up that never steals focus
    class Toast : Form
    {
        System.Windows.Forms.Timer life = new System.Windows.Forms.Timer();
        protected override bool ShowWithoutActivation { get { return true; } }
        protected override CreateParams CreateParams { get { var cp = base.CreateParams; cp.ExStyle |= 0x08000000 | 0x00000080 | 0x00000008; return cp; } }

        public static void Pop(string title, string text, Action click)
        {
            var t = new Toast(title, text, click); t.Show();
        }

        Toast(string title, string text, Action click)
        {
            FormBorderStyle = FormBorderStyle.None; StartPosition = FormStartPosition.Manual; ShowInTaskbar = false; TopMost = true;
            BackColor = Color.FromArgb(24, 24, 24); Size = new Size(380, 104); Padding = new Padding(1);
            var inner = new Panel { Dock = DockStyle.Fill, BackColor = Color.FromArgb(18, 18, 18), Padding = new Padding(16, 12, 16, 10), Cursor = Cursors.Hand };
            var h = new Label { Text = title, ForeColor = Color.FromArgb(232, 153, 141), Font = new Font("Segoe UI Semibold", 11f), Dock = DockStyle.Top, Height = 26, Cursor = Cursors.Hand };
            var b = new Label { Text = text, ForeColor = Color.FromArgb(236, 236, 236), Font = new Font("Segoe UI", 10f), Dock = DockStyle.Fill, Cursor = Cursors.Hand };
            inner.Controls.Add(b); inner.Controls.Add(h); Controls.Add(inner);
            EventHandler go = delegate { if (click != null) click(); Close(); };
            inner.Click += go; h.Click += go; b.Click += go;
            var wa = Screen.PrimaryScreen.WorkingArea; Location = new Point(wa.Right - Width - 16, wa.Bottom - Height - 16);
            life.Interval = 8000; life.Tick += delegate { life.Stop(); Close(); }; life.Start();
        }
    }

    // ------------------------------------------------------------------ the lock settings window
    class LockForm : Form
    {
        readonly Data d; readonly Action saved;
        CheckedListBox presets; ListBox custom; NumericUpDown per, from, to; ComboBox ex; CheckBox on, sched, remind, auto;

        public LockForm(Data data, Action onSave)
        {
            d = data; saved = onSave;
            Text = "Womanten: lock settings"; StartPosition = FormStartPosition.CenterScreen; FormBorderStyle = FormBorderStyle.FixedDialog; MaximizeBox = false; MinimizeBox = false;
            ClientSize = new Size(470, 700); BackColor = Color.FromArgb(10, 10, 10); ForeColor = Color.FromArgb(236, 236, 236); Font = new Font("Segoe UI", 10f);
            int y = 14;
            Func<string, float, Color, Label> lbl = delegate (string t, float size, Color c) { var l = new Label { Text = t, Left = 20, Top = y, Width = 430, AutoSize = false, ForeColor = c, Font = new Font("Segoe UI", size) }; return l; };
            var title = lbl("🔒 Lock your distracting apps", 15f, Color.White); title.Height = 32; Controls.Add(title); y += 36;
            var sub = lbl("A locked app or site is minimised until you earn time with reps on your webcam. Nothing is read, only which program and which tab is in front.", 9f, Color.FromArgb(150, 150, 150)); sub.Height = 44; Controls.Add(sub); y += 52;

            on = new CheckBox { Text = "The lock is on", Left = 20, Top = y, Width = 430, Checked = d.Enabled }; Controls.Add(on); y += 32;
            sched = new CheckBox { Text = "Only lock during these hours:", Left = 20, Top = y, Width = 230, Checked = d.ScheduleOn }; Controls.Add(sched);
            from = new NumericUpDown { Left = 260, Top = y - 2, Width = 56, Minimum = 0, Maximum = 23, Value = Math.Max(0, Math.Min(23, d.From)) }; Controls.Add(from);
            var tl = new Label { Text = "to", Left = 322, Top = y + 2, Width = 22, ForeColor = Color.Gray }; Controls.Add(tl);
            to = new NumericUpDown { Left = 346, Top = y - 2, Width = 56, Minimum = 0, Maximum = 23, Value = Math.Max(0, Math.Min(23, d.To)) }; Controls.Add(to); y += 38;

            Controls.Add(lbl("What do you do to unlock?", 10f, Color.White)); y += 26;
            ex = new ComboBox { Left = 20, Top = y, Width = 220, DropDownStyle = ComboBoxStyle.DropDownList };
            for (int i = 0; i < Rules.Exercises.GetLength(0); i++) { ex.Items.Add(Rules.Exercises[i, 1]); if (Rules.Exercises[i, 0] == d.Exercise) ex.SelectedIndex = i; }
            if (ex.SelectedIndex < 0) ex.SelectedIndex = 0; Controls.Add(ex);
            var pl = new Label { Text = "Minutes earned per rep:", Left = 252, Top = y + 3, Width = 140, ForeColor = Color.Gray }; Controls.Add(pl);
            per = new NumericUpDown { Left = 396, Top = y, Width = 54, Minimum = 1, Maximum = 30, Value = Math.Max(1, Math.Min(30, d.MinutesPerRep)) }; Controls.Add(per); y += 40;

            Controls.Add(lbl("Apps and sites to lock", 10f, Color.White)); y += 26;
            presets = new CheckedListBox { Left = 20, Top = y, Width = 210, Height = 200, BackColor = Color.FromArgb(24, 24, 24), ForeColor = Color.White, BorderStyle = BorderStyle.None, CheckOnClick = true };
            foreach (var k in Rules.PresetWords.Keys) presets.Items.Add(k, d.Presets.Contains(k)); Controls.Add(presets);
            custom = new ListBox { Left = 240, Top = y, Width = 210, Height = 150, BackColor = Color.FromArgb(24, 24, 24), ForeColor = Color.White, BorderStyle = BorderStyle.None };
            foreach (var c in d.Custom) custom.Items.Add(c); Controls.Add(custom);
            var add = new Button { Text = "Add a word or program…", Left = 240, Top = y + 156, Width = 210, Height = 26, FlatStyle = FlatStyle.Flat }; add.Click += delegate { AddCustom(); }; Controls.Add(add);
            var running = new Button { Text = "Pick a running program…", Left = 240, Top = y + 186, Width = 210, Height = 26, FlatStyle = FlatStyle.Flat }; running.Click += delegate { PickRunning(running); }; Controls.Add(running);
            y += 222;
            var rm = new Button { Text = "Remove selected", Left = 240, Top = y - 8, Width = 210, Height = 26, FlatStyle = FlatStyle.Flat }; rm.Click += delegate { if (custom.SelectedIndex >= 0) custom.Items.RemoveAt(custom.SelectedIndex); }; Controls.Add(rm); y += 30;

            remind = new CheckBox { Text = "Daily reminders (morning plan, water, evening journal)", Left = 20, Top = y, Width = 430, Checked = d.Reminders }; Controls.Add(remind); y += 30;
            auto = new CheckBox { Text = "Start Womanten with Windows", Left = 20, Top = y, Width = 430, Checked = IsAutostart() }; Controls.Add(auto); y += 36;
            var note = lbl("Honest note: you can quit Womanten from the tray at any time. The lock is a promise you keep to yourself, and it works best when you choose it.", 9f, Color.FromArgb(150, 150, 150)); note.Height = 40; Controls.Add(note); y += 46;
            var ok = new Button { Text = "Save", Left = 20, Top = y, Width = 130, Height = 34, FlatStyle = FlatStyle.Flat, BackColor = Color.FromArgb(232, 153, 141), ForeColor = Color.FromArgb(31, 16, 12) }; ok.Click += delegate { Save(); Close(); }; Controls.Add(ok);
            AcceptButton = ok;
        }

        void AddCustom()
        {
            string v = Prompt("Add a word or program", "A word in a website's tab title (like \"tiktok\"), or a program name (like \"minecraft\"):");
            if (!string.IsNullOrWhiteSpace(v)) custom.Items.Add(v.Trim());
        }

        void PickRunning(Control anchor)
        {
            var menu = new ContextMenuStrip();
            var names = new SortedSet<string>();
            foreach (var p in Process.GetProcesses()) { try { if (p.MainWindowHandle != IntPtr.Zero && !string.IsNullOrEmpty(p.MainWindowTitle)) names.Add(p.ProcessName); } catch { } }
            foreach (var n in names) { string nn = n; if (Array.IndexOf(Rules.Browsers, nn.ToLowerInvariant()) >= 0 || nn.ToLowerInvariant() == "womanten") continue; menu.Items.Add(nn, null, delegate { if (!custom.Items.Contains(nn)) custom.Items.Add(nn); }); }
            if (menu.Items.Count == 0) menu.Items.Add("No other programs are open").Enabled = false;
            menu.Show(anchor, new Point(0, anchor.Height));
        }

        static string Prompt(string title, string text)
        {
            var f = new Form { Text = title, StartPosition = FormStartPosition.CenterParent, FormBorderStyle = FormBorderStyle.FixedDialog, ClientSize = new Size(400, 130), MaximizeBox = false, MinimizeBox = false, BackColor = Color.FromArgb(10, 10, 10), ForeColor = Color.White };
            var l = new Label { Text = text, Left = 14, Top = 12, Width = 372, Height = 40 }; var t = new TextBox { Left = 14, Top = 56, Width = 372 };
            var ok = new Button { Text = "Add", Left = 300, Top = 90, Width = 86, DialogResult = DialogResult.OK, FlatStyle = FlatStyle.Flat };
            f.Controls.AddRange(new Control[] { l, t, ok }); f.AcceptButton = ok;
            return f.ShowDialog() == DialogResult.OK ? t.Text : null;
        }

        void Save()
        {
            d.Enabled = on.Checked; d.ScheduleOn = sched.Checked; d.From = (int)from.Value; d.To = (int)to.Value; d.MinutesPerRep = (int)per.Value; d.Reminders = remind.Checked;
            d.Exercise = Rules.Exercises[Math.Max(0, ex.SelectedIndex), 0];
            d.Presets = presets.CheckedItems.Cast<object>().Select(o => o.ToString()).ToList();
            d.Custom = custom.Items.Cast<object>().Select(o => o.ToString()).ToList();
            SetAutostart(auto.Checked);
            saved();
        }

        public static bool IsAutostart() { try { using (var k = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run")) { return k != null && k.GetValue("Womanten") != null; } } catch { return false; } }
        public static void SetAutostart(bool on)
        {
            try
            {
                using (var k = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run", true))
                {
                    if (on) k.SetValue("Womanten", "\"" + Application.ExecutablePath + "\" --tray"); else k.DeleteValue("Womanten", false);
                }
            }
            catch { }
        }
    }

    // ------------------------------------------------------------------ the app
    class MainForm : Form
    {
        public const int Build = 2;
        public static readonly string SiteUrl = Environment.GetEnvironmentVariable("WOMANTEN_SITE") ?? "https://womanten.onrender.com";
        static readonly string DataDir = Environment.GetEnvironmentVariable("WOMANTEN_DIR") ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Womanten");
        static readonly bool Debug = Environment.GetEnvironmentVariable("WM_DEBUG") == "1";
        static readonly JavaScriptSerializer Json = new JavaScriptSerializer();

        Data data = new Data();
        WebView2 web;
        NotifyIcon tray;
        System.Windows.Forms.Timer engine = new System.Windows.Forms.Timer();
        bool quitting, hidden, trayToldYou;
        long lastBlock;
        string pendingUrl;

        public MainForm(bool startHidden)
        {
            hidden = startHidden;
            Text = "Womanten"; ClientSize = new Size(520, 860); MinimumSize = new Size(380, 560); StartPosition = FormStartPosition.CenterScreen; BackColor = Color.FromArgb(10, 10, 10);
            Icon = MakeIcon();
            Directory.CreateDirectory(DataDir); Load_();
            web = new WebView2 { Dock = DockStyle.Fill, BackColor = Color.FromArgb(10, 10, 10) };
            web.CreationProperties = new CoreWebView2CreationProperties { UserDataFolder = Path.Combine(DataDir, "webview") };
            web.CoreWebView2InitializationCompleted += WebReady;
            Controls.Add(web);
            BuildTray();
            SystemEvents.PowerModeChanged += delegate (object o, PowerModeChangedEventArgs pe)
            {
                if (pe.Mode != PowerModes.Resume) return; Log("resumed from sleep");
                var wake = new System.Windows.Forms.Timer { Interval = 6000 }; wake.Tick += delegate { wake.Stop(); try { if (web != null && web.CoreWebView2 != null) web.CoreWebView2.Reload(); } catch { } }; wake.Start();
            };
            engine.Interval = 1000; engine.Tick += delegate { try { Engine(); } catch (Exception e) { Log("engine: " + e.Message); } }; engine.Start();
            var push = new System.Windows.Forms.Timer { Interval = 2000 }; push.Tick += delegate { PushState(); }; push.Start();
            var minute = new System.Windows.Forms.Timer { Interval = 30000 }; minute.Tick += delegate { Remind(); }; minute.Start();
            var upd = new System.Windows.Forms.Timer { Interval = 6 * 3600 * 1000 }; upd.Tick += delegate { CheckUpdate(); }; upd.Start();
            Load += delegate { Log("load"); web.EnsureCoreWebView2Async(null); };
            var first = new System.Windows.Forms.Timer { Interval = 20000 }; first.Tick += delegate { first.Stop(); CheckUpdate(); }; first.Start();
        }

        protected override void SetVisibleCore(bool value)
        {
            if (hidden) { if (!IsHandleCreated) CreateHandle(); value = false; hidden = false; }
            base.SetVisibleCore(value);
        }

        // ---- storage
        string DataFile { get { return Path.Combine(DataDir, "data.json"); } }
        void Load_() { try { if (File.Exists(DataFile)) data = Json.Deserialize<Data>(File.ReadAllText(DataFile)) ?? new Data(); } catch (Exception e) { Log("load: " + e.Message); data = new Data(); } }
        void Save_() { try { File.WriteAllText(DataFile, Json.Serialize(data)); } catch (Exception e) { Log("save: " + e.Message); } }
        static void Log(string s) { if (!Debug) return; try { File.AppendAllText(Path.Combine(DataDir, "log.txt"), DateTime.Now.ToString("HH:mm:ss.fff") + " " + s + "\r\n"); } catch { } }

        // ---- icon
        static Icon MakeIcon()
        {
            using (var bmp = new Bitmap(64, 64))
            {
                using (var g = Graphics.FromImage(bmp))
                {
                    g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias; g.Clear(Color.FromArgb(20, 20, 20));
                    using (var pen = new Pen(Color.FromArgb(232, 153, 141), 9f)) g.DrawEllipse(pen, 14, 14, 36, 36);
                }
                IntPtr h = bmp.GetHicon(); var icon = (Icon)Icon.FromHandle(h).Clone(); Native.DestroyIcon(h); return icon;
            }
        }

        // ---- the web view
        void WebReady(object s, CoreWebView2InitializationCompletedEventArgs e)
        {
            if (!e.IsSuccess) { Log("webview failed: " + e.InitializationException); MessageBox.Show("Womanten needs the Microsoft Edge WebView2 runtime, which could not start.\r\n\r\nInstall it from microsoft.com/edge/webview2 and open Womanten again.", "Womanten", MessageBoxButtons.OK, MessageBoxIcon.Information); return; }
            var c = web.CoreWebView2;
            c.Settings.UserAgent = c.Settings.UserAgent + " WomantenApp WomantenWindows";
            c.Settings.IsStatusBarEnabled = false; c.Settings.AreDevToolsEnabled = Debug;
            c.AddScriptToExecuteOnDocumentCreatedAsync(BridgeJs);
            c.WebMessageReceived += delegate (object o, CoreWebView2WebMessageReceivedEventArgs m) { try { OnMessage(m.WebMessageAsJson); } catch (Exception ex) { Log("msg: " + ex.Message); } };
            c.PermissionRequested += delegate (object o, CoreWebView2PermissionRequestedEventArgs p)
            {
                bool ours = false; try { ours = new Uri(p.Uri).Host == new Uri(SiteUrl).Host; } catch { }
                p.State = (ours && p.PermissionKind == CoreWebView2PermissionKind.Camera) ? CoreWebView2PermissionState.Allow : CoreWebView2PermissionState.Deny;
            };
            c.ProcessFailed += delegate (object o, CoreWebView2ProcessFailedEventArgs f) { Log("process failed " + f.ProcessFailedKind); try { c.Reload(); } catch { } };
            c.NavigationStarting += delegate (object o, CoreWebView2NavigationStartingEventArgs n)
            {
                try { var u = new Uri(n.Uri); if ((u.Scheme == "http" || u.Scheme == "https") && u.Host != new Uri(SiteUrl).Host) { n.Cancel = true; Process.Start(n.Uri); } } catch { }
            };
            c.NewWindowRequested += delegate (object o, CoreWebView2NewWindowRequestedEventArgs n) { n.Handled = true; try { Process.Start(n.Uri); } catch { } };
            c.NavigationCompleted += delegate (object o, CoreWebView2NavigationCompletedEventArgs n)
            {
                Log("navigated ok=" + n.IsSuccess + " status=" + n.HttpStatusCode + " err=" + n.WebErrorStatus + " " + c.Source);
                if (!n.IsSuccess && n.WebErrorStatus == CoreWebView2WebErrorStatus.OperationCanceled) return;          // another navigation took over: not a problem
                bool ours = false; try { ours = new Uri(c.Source).Host == new Uri(SiteUrl).Host; } catch { }
                if ((!n.IsSuccess && c.Source.StartsWith("http")) || (n.IsSuccess && ours && (n.HttpStatusCode >= 500 || n.HttpStatusCode == 404))) { Log("showing the reconnecting page"); c.NavigateToString(OfflineHtml()); }
                else PushState();
            };
            Log("webview ready");
            c.Navigate(pendingUrl ?? (SiteUrl + "/app"));
        }

        const string BridgeJs = @"(function(){
  window.__wmState = {enabled:false,scrolls:0,currency:'minutes',perPushup:2,exercise:'Push-ups',unit:'push-up',apps:[],repsToday:0,usedToday:0,schedule:'',focusLeft:0,canFocus:true};
  function post(o){ try { window.chrome.webview.postMessage(o); } catch(e){} }
  window.WomantenNative = {
    lockInfo: function(){ return JSON.stringify(window.__wmState); },
    openLock: function(){ post({type:'openLock'}); },
    openPushups: function(){ post({type:'openReps'}); },
    startFocus: function(m){ post({type:'startFocus', minutes:m}); return true; },
    focusLeft: function(){ return window.__wmState.focusLeft || 0; },
    saveFile: function(n,t){ post({type:'saveFile', name:n, text:t}); }
  };
})();";

        static string OfflineHtml()
        {
            return ("<!doctype html><meta charset='utf-8'><body style='background:#0a0a0a;color:#eee;font-family:Segoe UI,sans-serif;text-align:center;padding:60px 24px'><h2>Reconnecting to Womanten…</h2>"
                + "<p style='color:#999;max-width:34em;margin:12px auto'>Womanten could not be reached. If the server was asleep it can take up to a minute to wake up. I will keep trying by myself.</p>"
                + "<p style='color:#e8998d' id='s'>Trying again in <b id='n'>5</b> seconds</p><button onclick='go()' style='padding:12px 22px;border-radius:12px;border:0;background:#e8998d;font-weight:700;font-size:16px'>Try now</button>"
                + "<script>var t=5,busy=false;function go(){location.href='@SITE@/app';}setInterval(function(){t--;if(t<=0&&!busy){t=8;busy=true;fetch('@SITE@/health',{mode:'no-cors',cache:'no-store'}).then(function(){go();}).catch(function(){busy=false;});}"
                + "if(t<0)t=0;document.getElementById('n').textContent=t;},1000);</script></body>").Replace("@SITE@", SiteUrl);
        }

        void OnMessage(string json)
        {
            var m = Json.DeserializeObject(json) as Dictionary<string, object>; if (m == null) return;
            string type = m.ContainsKey("type") ? Convert.ToString(m["type"]) : "";
            Log("message " + type);
            switch (type)
            {
                case "openLock": ShowSettings(); break;
                case "openReps": ShowReps(); break;
                case "startFocus":
                    int mins = m.ContainsKey("minutes") ? Convert.ToInt32(m["minutes"]) : 25;
                    if (Rules.Words(data).Count == 0) { Toast.Pop("Pick apps to lock first", "Choose what to block during focus.", ShowSettings); ShowSettings(); break; }
                    data.FocusUntil = DateTime.UtcNow.AddMinutes(Math.Max(1, Math.Min(180, mins))).Ticks; data.FocusRepsLeft = 10; Save_(); PushState(); break;
                case "rep": OnRep(m.ContainsKey("n") ? Convert.ToInt32(m["n"]) : 1); break;
                case "saveFile":
                    string name = Path.GetFileName(m.ContainsKey("name") ? Convert.ToString(m["name"]) : "womanten-backup.json"); string text = m.ContainsKey("text") ? Convert.ToString(m["text"]) : "";
                    string dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads"); Directory.CreateDirectory(dir);
                    File.WriteAllText(Path.Combine(dir, name), text); Toast.Pop("Saved", name + " is in your Downloads folder.", null); break;
            }
        }

        void OnRep(int n)
        {
            RollDay();
            data.RepsToday += n;
            if (FocusActive())
            {
                data.FocusRepsLeft -= n;
                if (data.FocusRepsLeft <= 0) { data.FocusUntil = 0; data.FocusRepsLeft = 10; Toast.Pop("Focus mode ended", "Nice work. Your locked apps are available again.", null); }
            }
            else data.EarnedSeconds += n * data.MinutesPerRep * 60.0;
            Save_(); PushState();
        }

        void PushState()
        {
            try
            {
                if (web == null || web.CoreWebView2 == null) return;
                var d = new Dictionary<string, object>();
                var apps = new List<string>(data.Presets); apps.AddRange(data.Custom);
                d["enabled"] = data.Enabled; d["scrolls"] = (int)Math.Ceiling(data.EarnedSeconds / 60.0); d["currency"] = "minutes"; d["perPushup"] = data.MinutesPerRep;
                d["exercise"] = Rules.ExLabel(data.Exercise); d["unit"] = Rules.ExLabel(data.Exercise).ToLowerInvariant().TrimEnd('s'); d["apps"] = apps;
                d["repsToday"] = data.RepsToday; d["usedToday"] = data.UsedSeconds / 60;
                d["schedule"] = data.ScheduleOn ? data.From + ":00 to " + data.To + ":00" : "";
                d["focusLeft"] = FocusActive() ? (int)Math.Max(0, (new DateTime(data.FocusUntil, DateTimeKind.Utc) - DateTime.UtcNow).TotalSeconds) : 0; d["canFocus"] = true;
                web.CoreWebView2.ExecuteScriptAsync("window.__wmState=" + Json.Serialize(d) + ";");
            }
            catch (Exception e) { Log("push: " + e.Message); }
        }

        // ---- showing things
        public void ShowMain()
        {
            if (!Visible) Show();
            if (WindowState == FormWindowState.Minimized) WindowState = FormWindowState.Normal;
            Activate(); Native.SetForegroundWindow(Handle);
        }

        void ShowReps()
        {
            string url = SiteUrl + "/reps?host=win&ex=" + data.Exercise;
            if (web != null && web.CoreWebView2 != null) web.CoreWebView2.Navigate(url); else pendingUrl = url;
            ShowMain();
        }

        void ShowSettings()
        {
            ShowMain();
            using (var f = new LockForm(data, delegate { Save_(); PushState(); Reminders_(); })) f.ShowDialog(this);
        }

        void Reminders_() { }

        // ---- the lock
        bool FocusActive() { return data.FocusUntil > DateTime.UtcNow.Ticks; }

        void RollDay()
        {
            string today = DateTime.Now.ToString("yyyy-MM-dd");
            if (data.Day != today) { data.Day = today; data.RepsToday = 0; data.UsedSeconds = 0; }
        }

        void DebugHooks()
        {
            if (!Debug) return;
            string cmd = Path.Combine(DataDir, "cmd.json"), js = Path.Combine(DataDir, "js.txt");
            if (File.Exists(cmd)) { string m = File.ReadAllText(cmd); File.Delete(cmd); Log("debug cmd " + m); OnMessage(m); }
            if (File.Exists(js) && web != null && web.CoreWebView2 != null)
            {
                string code = File.ReadAllText(js); File.Delete(js);
                web.CoreWebView2.ExecuteScriptAsync(code).ContinueWith(delegate (System.Threading.Tasks.Task<string> x) { try { File.WriteAllText(Path.Combine(DataDir, "jsout.txt"), x.Result ?? "null"); } catch { } });
            }
        }

        void Engine()
        {
            DebugHooks();
            RollDay();
            bool focus = FocusActive();
            if (!focus && data.FocusUntil != 0) { data.FocusUntil = 0; data.FocusRepsLeft = 10; Save_(); }
            bool on = focus || (data.Enabled && (!data.ScheduleOn || Rules.InWindow(DateTime.Now.Hour, data.From, data.To)));
            if (!on) return;
            var words = Rules.Words(data); if (words.Count == 0) return;
            IntPtr h = Native.GetForegroundWindow(); if (h == IntPtr.Zero) return;
            int pid; Native.GetWindowThreadProcessId(h, out pid);
            if (pid == Process.GetCurrentProcess().Id) return;
            string proc = ""; try { proc = Process.GetProcessById(pid).ProcessName; } catch { return; }
            var sb = new StringBuilder(512); Native.GetWindowText(h, sb, sb.Capacity);
            if (!Rules.Matches(words, proc, sb.ToString())) return;
            if (focus) { Block(h, true); return; }
            if (data.EarnedSeconds > 0)
            {
                data.EarnedSeconds -= 1; data.UsedSeconds += 1;
                if (data.EarnedSeconds <= 0) { data.EarnedSeconds = 0; Save_(); Block(h, false); }
                else if (data.UsedSeconds % 15 == 0) Save_();
                return;
            }
            Block(h, false);
        }

        void Block(IntPtr h, bool focus)
        {
            long now = Environment.TickCount;
            if (now - lastBlock < 3000 && lastBlock != 0) { Native.ShowWindow(h, 6); return; }
            lastBlock = now;
            Native.ShowWindow(h, 6);                                   // minimise it
            Log("blocked focus=" + focus);
            if (focus)
            {
                int left = (int)Math.Max(1, Math.Ceiling((new DateTime(data.FocusUntil, DateTimeKind.Utc) - DateTime.UtcNow).TotalMinutes));
                Toast.Pop("Focus mode", left + " min left. Do " + data.FocusRepsLeft + " reps to end it early.", ShowReps);
            }
            else Toast.Pop("Locked", "Do " + Rules.ExLabel(data.Exercise).ToLowerInvariant() + " to earn " + data.MinutesPerRep + " minutes per rep.", ShowReps);
            ShowReps();
        }

        // ---- reminders and updates
        static readonly int[][] Times = { new[] { 8, 0 }, new[] { 13, 0 }, new[] { 17, 0 }, new[] { 20, 30 } };
        static readonly string[] Texts = { "Good morning! Check today's plan and pick your first step.", "Time for a glass of water. 💧", "Another glass of water, and a quick stretch?", "Evening: tick off your day and write one line in your journal." };

        void Remind()
        {
            if (!data.Reminders) return;
            var now = DateTime.Now; string day = now.ToString("yyyy-MM-dd");
            for (int i = 0; i < Times.Length; i++)
            {
                var due = new DateTime(now.Year, now.Month, now.Day, Times[i][0], Times[i][1], 0); string key = day + " " + i;
                if (now >= due && now < due.AddMinutes(90) && !data.Fired.Contains(key))
                {
                    data.Fired.Add(key); if (data.Fired.Count > 40) data.Fired.RemoveRange(0, data.Fired.Count - 40); Save_();
                    Toast.Pop("Womanten", Texts[i], ShowMain);
                }
            }
        }

        void CheckUpdate()
        {
            ThreadPool.QueueUserWorkItem(delegate
            {
                try
                {
                    using (var wc = new System.Net.WebClient())
                    {
                        wc.Headers["User-Agent"] = "WomantenWindows/" + Build;
                        var r = Json.DeserializeObject(wc.DownloadString(SiteUrl + "/api/windows/version")) as Dictionary<string, object>;
                        int latest = Convert.ToInt32(r["build"]);
                        if (latest > Build && data.LastUpdateNag != latest.ToString())
                        {
                            data.LastUpdateNag = latest.ToString(); Save_();
                            BeginInvoke(new Action(delegate { Toast.Pop("A new Womanten for Windows is ready", "Click to download it. Your data is kept.", delegate { Process.Start(SiteUrl + "/download/windows"); }); }));
                        }
                    }
                }
                catch (Exception e) { Log("update: " + e.Message); }
            });
        }

        // ---- tray
        void BuildTray()
        {
            var menu = new ContextMenuStrip();
            menu.Items.Add("Open Womanten", null, delegate { ShowMain(); });
            menu.Items.Add("Do reps now", null, delegate { ShowReps(); });
            menu.Items.Add("Lock settings…", null, delegate { ShowSettings(); });
            menu.Items.Add(new ToolStripSeparator());
            var rem = new ToolStripMenuItem("Daily reminders") { Checked = data.Reminders, CheckOnClick = true };
            rem.CheckedChanged += delegate { data.Reminders = rem.Checked; Save_(); }; menu.Items.Add(rem);
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("Quit Womanten", null, delegate { quitting = true; Save_(); tray.Visible = false; Application.Exit(); });
            tray = new NotifyIcon { Icon = Icon, Text = "Womanten", Visible = true, ContextMenuStrip = menu };
            tray.MouseClick += delegate (object o, MouseEventArgs e) { if (e.Button == MouseButtons.Left) ShowMain(); };
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            if (!quitting && e.CloseReason == CloseReason.UserClosing)
            {
                e.Cancel = true; Hide();
                if (!trayToldYou) { trayToldYou = true; Toast.Pop("Womanten is still running", "It stays in the tray so your locks keep working. Right-click the icon to quit.", null); }
                return;
            }
            Save_(); base.OnFormClosing(e);
        }

        // ---- self test, no window: the rules that decide what gets locked
        public static int SelfTest()
        {
            int fail = 0; Action<string, bool> t = delegate (string n, bool ok) { Console.WriteLine((ok ? "ok   " : "FAIL ") + n); if (!ok) fail++; };
            var d = new Data(); d.Presets.Add("TikTok"); d.Presets.Add("YouTube"); d.Presets.Add("Discord"); d.Custom.Add("minecraft");
            var w = Rules.Words(d);
            t("tiktok in a Chrome tab", Rules.Matches(w, "chrome", "TikTok - Make Your Day - Google Chrome"));
            t("youtube in Edge", Rules.Matches(w, "msedge", "Funny cats - YouTube - Microsoft Edge"));
            t("homework in Chrome is NOT locked", !Rules.Matches(w, "chrome", "Chemistry homework - Google Docs - Google Chrome"));
            t("a Chrome tab that only mentions a locked word in a different language is still judged by title", !Rules.Matches(w, "chrome", "Wikipedia - Google Chrome"));
            t("Discord app by process name", Rules.Matches(w, "Discord", "General | Server - Discord"));
            t("custom program by name", Rules.Matches(w, "Minecraft.Windows", "Minecraft"));
            t("notepad whose text mentions youtube is NOT locked", !Rules.Matches(w, "notepad", "youtube ideas.txt - Notepad"));
            t("Explorer is never locked", !Rules.Matches(new List<string> { "explorer", "tiktok" }, "explorer", "TikTok videos"));
            t("Womanten itself is never locked", !Rules.Matches(new List<string> { "womanten" }, "Womanten", "Womanten"));
            t("short words never match process names", !Rules.Matches(new List<string> { "ab" }, "abcdef", "x"));
            t("X preset matches a tab like 'Home / X'", Rules.Matches(Rules.Words(new Data { Presets = { "X (Twitter)" } }), "chrome", "Home / X - Google Chrome"));
            t("X preset does not match 'Docs / Xbox'", !Rules.Matches(Rules.Words(new Data { Presets = { "X (Twitter)" } }), "chrome", "Docs / Xbox - Google Chrome"));
            t("window 22 in 21-7", Rules.InWindow(22, 21, 7)); t("window 3 in 21-7", Rules.InWindow(3, 21, 7)); t("window 12 not in 21-7", !Rules.InWindow(12, 21, 7)); t("window 7 not in 21-7", !Rules.InWindow(7, 21, 7));
            t("window 9 in 8-15", Rules.InWindow(9, 8, 15)); t("window 15 not in 8-15", !Rules.InWindow(15, 8, 15)); t("equal hours means all day", Rules.InWindow(5, 6, 6));
            var d2 = Json.Deserialize<Data>(Json.Serialize(d)); t("settings survive a save and load", d2.Presets.Count == 3 && d2.Custom[0] == "minecraft" && d2.MinutesPerRep == 2);
            Console.WriteLine(fail == 0 ? "ALL OK" : fail + " FAILED"); return fail;
        }
    }

    static class Program
    {
        [STAThread]
        static int Main(string[] args)
        {
            if (args.Length > 0 && args[0] == "--selftest") return MainForm.SelfTest();
            Native.SetProcessDPIAware();
            string dir = Environment.GetEnvironmentVariable("WOMANTEN_DIR") ?? "default";
            string id = Math.Abs(dir.ToLowerInvariant().GetHashCode()).ToString();
            bool created;
            using (var mutex = new Mutex(true, "Womanten.Single." + id, out created))
            {
                if (!created)
                {
                    try { EventWaitHandle.OpenExisting("Womanten.Show." + id).Set(); } catch { }
                    return 0;
                }
                Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
                bool tray = args.Contains("--tray");
                var form = new MainForm(tray);
                var show = new EventWaitHandle(false, EventResetMode.AutoReset, "Womanten.Show." + id);
                var th = new Thread(delegate () { while (true) { show.WaitOne(); try { form.BeginInvoke(new Action(form.ShowMain)); } catch { } } }) { IsBackground = true };
                th.Start();
                Application.Run(form);
            }
            return 0;
        }
    }
}
