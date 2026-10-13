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
    @Synchronized fun useScroll(c: Context): Int { val left = (scrolls(c) - 1).coerceAtLeast(0); sp(c).edit().putInt("scrolls", left).apply(); noteScrollUsed(c); return left }

    fun pushupsToday(c: Context): Int { val s = sp(c); return if (s.getString("pday", "") == today()) s.getInt("pcount", 0) else 0 }
    fun addPushup(c: Context) { val s = sp(c); val n = pushupsToday(c) + 1; s.edit().putString("pday", today()).putInt("pcount", n).apply() }
    private fun today() = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(java.util.Date())

    fun exercise(c: Context): Exercise = runCatching { Exercise.valueOf(sp(c).getString("exercise", "PUSHUP")!!) }.getOrDefault(Exercise.PUSHUP)
    fun setExercise(c: Context, e: Exercise) = sp(c).edit().putString("exercise", e.name).apply()

    /** Focus mode: locked apps are blocked outright until the time is up, or until you earn your way out with FOCUS_EXIT_REPS reps. */
    const val FOCUS_EXIT_REPS = 10
    fun focusUntil(c: Context) = sp(c).getLong("focusUntil", 0L)
    fun focusActive(c: Context) = focusUntil(c) > System.currentTimeMillis()
    fun focusLeftSeconds(c: Context) = ((focusUntil(c) - System.currentTimeMillis()) / 1000).coerceAtLeast(0)
    fun startFocus(c: Context, minutes: Int) { sp(c).edit().putLong("focusUntil", System.currentTimeMillis() + minutes.coerceIn(1, 180) * 60_000L).putInt("focusReps", FOCUS_EXIT_REPS).apply() }
    fun endFocus(c: Context) = sp(c).edit().putLong("focusUntil", 0L).apply()
    fun focusRepsLeft(c: Context) = sp(c).getInt("focusReps", FOCUS_EXIT_REPS)
    /** One rep towards leaving focus early. Returns how many are still needed (0 means focus has ended). */
    fun focusRep(c: Context): Int { val left = (focusRepsLeft(c) - 1).coerceAtLeast(0); sp(c).edit().putInt("focusReps", left).apply(); if (left == 0) endFocus(c); return left }

    /** Optional lock hours, for example 21 to 7 for nights only, or 8 to 15 for school. Off means the lock is on all day. */
    fun scheduleOn(c: Context) = sp(c).getBoolean("schedOn", false)
    fun setScheduleOn(c: Context, v: Boolean) = sp(c).edit().putBoolean("schedOn", v).apply()
    fun schedFrom(c: Context) = sp(c).getInt("schedFrom", 21)
    fun schedTo(c: Context) = sp(c).getInt("schedTo", 7)
    fun setSchedule(c: Context, from: Int, to: Int) = sp(c).edit().putInt("schedFrom", from.coerceIn(0, 23)).putInt("schedTo", to.coerceIn(0, 23)).apply()
    fun lockWindowActive(c: Context, hour: Int = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY)): Boolean {
        if (!scheduleOn(c)) return true
        return inLockWindow(hour, schedFrom(c), schedTo(c))
    }

    fun scrollsUsedToday(c: Context): Int { val s = sp(c); return if (s.getString("uday", "") == today()) s.getInt("ucount", 0) else 0 }
    fun noteScrollUsed(c: Context) { val s = sp(c); s.edit().putString("uday", today()).putInt("ucount", scrollsUsedToday(c) + 1).apply() }

    fun remindersOn(c: Context) = sp(c).getBoolean("reminders", false)
    fun setRemindersOn(c: Context, v: Boolean) = sp(c).edit().putBoolean("reminders", v).apply()
}
