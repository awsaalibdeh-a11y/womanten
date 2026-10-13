package app.womanten

import android.content.Context

/** Everything the lock remembers. Plain SharedPreferences; nothing leaves the phone. */
object Prefs {
    private fun sp(c: Context) = c.applicationContext.getSharedPreferences("womanten", Context.MODE_PRIVATE)

    fun enabled(c: Context) = sp(c).getBoolean("enabled", false)
    fun setEnabled(c: Context, v: Boolean) = sp(c).edit().putBoolean("enabled", v).apply()

    fun locked(c: Context): Set<String> = sp(c).getStringSet("locked", emptySet()) ?: emptySet()
    fun setLocked(c: Context, v: Set<String>) = sp(c).edit().putStringSet("locked", v).apply()

    fun perPushup(c: Context) = sp(c).getInt("per", 10)
    fun setPerPushup(c: Context, v: Int) = sp(c).edit().putInt("per", v.coerceIn(1, 50)).apply()

    @Synchronized fun scrolls(c: Context) = sp(c).getInt("scrolls", 0)
    @Synchronized fun addScrolls(c: Context, n: Int) { sp(c).edit().putInt("scrolls", (scrolls(c) + n).coerceAtLeast(0)).apply() }
    /** Uses one scroll. Returns how many are left. */
    @Synchronized fun useScroll(c: Context): Int { val left = (scrolls(c) - 1).coerceAtLeast(0); sp(c).edit().putInt("scrolls", left).apply(); return left }

    fun pushupsToday(c: Context): Int { val s = sp(c); return if (s.getString("pday", "") == today()) s.getInt("pcount", 0) else 0 }
    fun addPushup(c: Context) { val s = sp(c); val n = pushupsToday(c) + 1; s.edit().putString("pday", today()).putInt("pcount", n).apply() }
    private fun today() = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(java.util.Date())

    fun remindersOn(c: Context) = sp(c).getBoolean("reminders", false)
    fun setRemindersOn(c: Context, v: Boolean) = sp(c).edit().putBoolean("reminders", v).apply()
}
