package app.womanten

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.view.accessibility.AccessibilityEvent
import android.widget.Toast

/**
 * The lock. It only ever looks at WHICH app is in front and how often that app scrolls, never at what is on screen.
 * Locked app opens with no scrolls left: send the person home and open the push-up screen.
 * Locked app scrolls: spend one scroll; at zero, lock again.
 */
class LockService : AccessibilityService() {
    private var lastScrollAt = 0L
    private var lastBlockAt = 0L

    override fun onAccessibilityEvent(e: AccessibilityEvent?) {
        e ?: return
        val pkg = e.packageName?.toString() ?: return
        if (pkg == packageName || !Prefs.enabled(this) || pkg !in Prefs.locked(this)) return
        when (e.eventType) {
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> if (Prefs.scrolls(this) <= 0) block()
            AccessibilityEvent.TYPE_VIEW_SCROLLED -> {
                val now = System.currentTimeMillis()
                if (Prefs.scrolls(this) <= 0) { block(); return }
                if (now - lastScrollAt < 650) return                 // one swipe fires many events; count it once
                lastScrollAt = now
                if (Prefs.useScroll(this) <= 0) block()
            }
        }
    }

    private fun block() {
        val now = System.currentTimeMillis()
        if (now - lastBlockAt < 2500) return
        lastBlockAt = now
        performGlobalAction(GLOBAL_ACTION_HOME)
        Toast.makeText(this, "Locked. Do a push-up to earn ${Prefs.perPushup(this)} scrolls.", Toast.LENGTH_SHORT).show()
        startActivity(Intent(this, PushUpActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP))
    }

    override fun onInterrupt() {}

    companion object {
        /** Is the lock switched on in Android's accessibility settings? */
        fun isOn(c: android.content.Context): Boolean {
            val enabled = android.provider.Settings.Secure.getString(c.contentResolver, android.provider.Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES) ?: return false
            return enabled.split(':').any { it.equals("${c.packageName}/${LockService::class.java.name}", true) || it.endsWith("/.LockService") && it.startsWith(c.packageName) }
        }
    }
}
