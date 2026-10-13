package app.womanten

import android.annotation.SuppressLint
import android.content.ContentValues
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.MediaStore
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import org.json.JSONArray
import org.json.JSONObject

/** The Womanten website inside an app, plus a small bridge so the page can show and control the lock. */
class MainActivity : ComponentActivity() {
    private lateinit var web: WebView
    private val host = Uri.parse(BuildConfig.SITE).host

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(b: Bundle?) {
        super.onCreate(b)
        web = WebView(this).apply {
            setBackgroundColor(0xFF0A0A0A.toInt())
            layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.userAgentString = settings.userAgentString + " WomantenApp"
            addJavascriptInterface(Bridge(), "WomantenNative")
            webChromeClient = WebChromeClient()
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(v: WebView, r: WebResourceRequest): Boolean {
                    if (r.url.host == host) return false
                    startActivity(Intent(Intent.ACTION_VIEW, r.url)); return true                 // anything else opens in the browser
                }
                override fun onReceivedHttpError(v: WebView, r: WebResourceRequest, e: android.webkit.WebResourceResponse) {
                    if (r.isForMainFrame && (e.statusCode >= 500 || e.statusCode == 404)) v.loadDataWithBaseURL(BuildConfig.SITE, OFFLINE, "text/html", "utf-8", null)
                }
                override fun onReceivedError(v: WebView, r: WebResourceRequest, e: WebResourceError) {
                    if (r.isForMainFrame) v.loadDataWithBaseURL(BuildConfig.SITE, OFFLINE, "text/html", "utf-8", null)
                }
            }
        }
        setContentView(web)
        web.loadUrl(BuildConfig.SITE)
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() { if (web.canGoBack()) web.goBack() else finish() }
        })
        Reminders.apply(this)
    }

    override fun onResume() { super.onResume(); web.evaluateJavascript("window.dispatchEvent(new Event('focus'))", null) }

    /** Called from the page as WomantenNative.something(). Only our own site can see it, because every other address opens in the browser. */
    inner class Bridge {
        @JavascriptInterface fun lockInfo(): String {
            val pm = packageManager
            val names = Prefs.locked(this@MainActivity).mapNotNull { runCatching { pm.getApplicationLabel(pm.getApplicationInfo(it, 0)).toString() }.getOrNull() }
            return JSONObject().put("enabled", Prefs.enabled(this@MainActivity) && LockService.isOn(this@MainActivity)).put("scrolls", Prefs.scrolls(this@MainActivity))
                .put("perPushup", Prefs.perPushup(this@MainActivity)).put("repsToday", Prefs.pushupsToday(this@MainActivity)).put("usedToday", Prefs.scrollsUsedToday(this@MainActivity)).put("schedule", if (Prefs.scheduleOn(this@MainActivity)) "${Prefs.schedFrom(this@MainActivity)}:00 to ${Prefs.schedTo(this@MainActivity)}:00" else "").put("exercise", Prefs.exercise(this@MainActivity).label).put("unit", Prefs.exercise(this@MainActivity).unit).put("apps", JSONArray(names)).toString()
        }
        /** Real focus: the chosen apps are blocked for this many minutes. Returns false if the lock service is not on yet. */
        @JavascriptInterface fun startFocus(minutes: Int): Boolean {
            if (!LockService.isOn(this@MainActivity) || Prefs.locked(this@MainActivity).isEmpty()) { openLock(); return false }
            Prefs.startFocus(this@MainActivity, minutes); return true
        }
        @JavascriptInterface fun focusLeft(): Int = Prefs.focusLeftSeconds(this@MainActivity).toInt()
        @JavascriptInterface fun openLock() { startActivity(Intent(this@MainActivity, LockSettingsActivity::class.java)) }
        @JavascriptInterface fun openPushups() { startActivity(Intent(this@MainActivity, PushUpActivity::class.java)) }
        @JavascriptInterface fun saveFile(name: String, text: String) {
            runCatching {
                val v = ContentValues().apply { put(MediaStore.Downloads.DISPLAY_NAME, name); put(MediaStore.Downloads.MIME_TYPE, "application/json") }
                val uri = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v)!!
                contentResolver.openOutputStream(uri)!!.use { it.write(text.toByteArray()) }
            }.onSuccess { runOnUiThread { Toast.makeText(this@MainActivity, "Saved $name to Downloads", Toast.LENGTH_LONG).show() } }
                .onFailure { runOnUiThread { Toast.makeText(this@MainActivity, "Could not save the backup", Toast.LENGTH_LONG).show() } }
        }
    }

    companion object {
        private const val OFFLINE = "<!doctype html><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><body style='background:#0a0a0a;color:#eee;font-family:sans-serif;text-align:center;padding:48px 24px'><h2>Reconnecting to Womanten…</h2><p style='color:#999'>Womanten could not be reached. If the server was asleep it can take up to a minute to wake up. I will keep trying by myself.</p><p style='color:#e8998d' id='s'>Trying again in <b id='n'>5</b> seconds</p><button onclick='go()' style='padding:12px 22px;border-radius:12px;border:0;background:#e8998d;font-weight:700;font-size:16px'>Try now</button><script>var t=5,busy=false;function go(){location.href='https://womanten.onrender.com/app';}setInterval(function(){t--;if(t<=0&&!busy){t=8;busy=true;fetch('https://womanten.onrender.com/health',{mode:'no-cors',cache:'no-store'}).then(function(){go();}).catch(function(){busy=false;});}if(t<0)t=0;document.getElementById('n').textContent=t;},1000);</script></body>"
    }
}
