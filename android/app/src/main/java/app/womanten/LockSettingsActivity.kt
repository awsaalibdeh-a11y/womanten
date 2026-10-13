package app.womanten

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Bundle
import android.provider.Settings
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.CheckBox
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Switch
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts

/** Choose which apps are locked, how many scrolls a push-up earns, and switch the lock and reminders on. */
class LockSettingsActivity : ComponentActivity() {
    private lateinit var list: LinearLayout
    private lateinit var status: TextView
    private val boxes = LinkedHashMap<String, CheckBox>()
    private val askNotify = registerForActivityResult(ActivityResultContracts.RequestPermission()) { }

    private val KNOWN = mapOf(
        "com.zhiliaoapp.musically" to "TikTok", "com.ss.android.ugc.trill" to "TikTok", "com.instagram.android" to "Instagram", "com.google.android.youtube" to "YouTube",
        "com.snapchat.android" to "Snapchat", "com.twitter.android" to "X", "com.facebook.katana" to "Facebook", "com.reddit.frontpage" to "Reddit",
    )

    private fun tv(t: String, size: Float = 15f, color: String = "#DDDDDD", bold: Boolean = false) = TextView(this).apply {
        text = t; textSize = size; setTextColor(Color.parseColor(color)); setPadding(0, 10, 0, 6); if (bold) setTypeface(typeface, android.graphics.Typeface.BOLD)
    }

    override fun onCreate(b: Bundle?) {
        super.onCreate(b)
        val col = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(44, 56, 44, 56) }
        val scroll = ScrollView(this).apply { setBackgroundColor(Color.parseColor("#0a0a0a")); addView(col) }
        setContentView(scroll)

        col.addView(tv("🔒 Lock your scrolling apps", 24f, "#FFFFFF", true))
        col.addView(tv("Locked apps open to a push-up check. Each push-up you do on camera earns scrolls. When they run out, the app locks again.", 14f, "#A0A0A0"))

        status = tv("", 15f, "#E8998D", true); col.addView(status)

        val sw = Switch(this).apply { text = "Lock is on"; setTextColor(Color.WHITE); isChecked = Prefs.enabled(this@LockSettingsActivity)
            setOnCheckedChangeListener { _, on -> Prefs.setEnabled(this@LockSettingsActivity, on); refresh() } }
        col.addView(sw)

        col.addView(Button(this).apply { text = "1. Allow the lock in Accessibility settings"; setOnClickListener { startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)) } })
        col.addView(tv("Find Womanten app lock in the list and turn it on. It only sees which app is open and how often it scrolls, never your screen or messages.", 12f, "#8E8E8E"))
        col.addView(Button(this).apply { text = "2. Practice push-ups now"; setOnClickListener { startActivity(Intent(this@LockSettingsActivity, PushUpActivity::class.java)) } })

        col.addView(tv("Scrolls earned per push-up", 16f, "#FFFFFF", true))
        val per = TextView(this).apply { textSize = 22f; setTextColor(Color.WHITE); gravity = Gravity.CENTER }
        val row = LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL }
        fun show() { per.text = Prefs.perPushup(this).toString() }
        row.addView(Button(this).apply { text = "−"; setOnClickListener { Prefs.setPerPushup(this@LockSettingsActivity, Prefs.perPushup(this@LockSettingsActivity) - 5); show() } })
        row.addView(per, LinearLayout.LayoutParams(160, ViewGroup.LayoutParams.WRAP_CONTENT)); show()
        row.addView(Button(this).apply { text = "+"; setOnClickListener { Prefs.setPerPushup(this@LockSettingsActivity, Prefs.perPushup(this@LockSettingsActivity) + 5); show() } })
        col.addView(row)

        col.addView(tv("Apps to lock", 16f, "#FFFFFF", true))
        list = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }; col.addView(list)
        loadApps()

        col.addView(tv("Reminders", 16f, "#FFFFFF", true))
        col.addView(Switch(this).apply { text = "Daily nudges (morning plan, water, evening journal)"; setTextColor(Color.WHITE); isChecked = Prefs.remindersOn(this@LockSettingsActivity)
            setOnCheckedChangeListener { _, on -> Prefs.setRemindersOn(this@LockSettingsActivity, on); Reminders.apply(this@LockSettingsActivity)
                if (on && android.os.Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) askNotify.launch(Manifest.permission.POST_NOTIFICATIONS) } })
        col.addView(tv("Honest note: you can turn this lock off any time in Accessibility settings. It is a promise you keep to yourself, and it works best when you choose it.", 12f, "#8E8E8E"))
    }

    private fun loadApps() {
        val pm = packageManager
        val launch = pm.queryIntentActivities(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER), 0)
            .map { it.activityInfo.packageName to it.loadLabel(pm).toString() }.distinctBy { it.first }.filter { it.first != packageName }
        val chosen = Prefs.locked(this)
        val firstRun = chosen.isEmpty() && !getSharedPreferences("womanten", MODE_PRIVATE).contains("locked")
        val sorted = launch.sortedWith(compareByDescending<Pair<String, String>> { it.first in KNOWN }.thenBy { it.second.lowercase() })
        sorted.forEach { (pkg, label) ->
            val cb = CheckBox(this).apply {
                text = label; setTextColor(Color.WHITE); isChecked = pkg in chosen || (firstRun && pkg in KNOWN)
                setOnCheckedChangeListener { _, _ -> save() }
            }
            boxes[pkg] = cb; list.addView(cb)
        }
        save()
    }

    private fun save() { Prefs.setLocked(this, boxes.filter { it.value.isChecked }.keys.toSet()); refresh() }

    private fun refresh() {
        val on = LockService.isOn(this)
        status.text = (if (on) "✅ Lock service is on." else "⚠️ Step 1 is not done yet: the lock service is off.") + "  Scrolls left: ${Prefs.scrolls(this)}"
    }

    override fun onResume() { super.onResume(); refresh() }
}
