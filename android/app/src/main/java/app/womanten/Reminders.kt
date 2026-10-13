package app.womanten

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import java.util.Calendar

/** A few gentle daily nudges. They are set inexactly (Android may shift them by a few minutes to save battery). */
object Reminders {
    private val ALL = listOf(
        Triple(8, 0, "Good morning! Check today's plan and pick your first step."),
        Triple(13, 0, "Time for a glass of water. 💧"),
        Triple(17, 0, "Another glass of water, and a quick stretch?"),
        Triple(20, 30, "Evening: tick off your day and write one line in your journal."),
    )

    fun apply(c: Context) {
        val am = c.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        ALL.forEachIndexed { i, (h, m, text) ->
            val pi = pending(c, i, text)
            am.cancel(pi)
            if (Prefs.remindersOn(c)) {
                val t = Calendar.getInstance().apply { set(Calendar.HOUR_OF_DAY, h); set(Calendar.MINUTE, m); set(Calendar.SECOND, 0); if (timeInMillis <= System.currentTimeMillis()) add(Calendar.DAY_OF_YEAR, 1) }
                am.setInexactRepeating(AlarmManager.RTC, t.timeInMillis, AlarmManager.INTERVAL_DAY, pi)
            }
        }
    }

    private fun pending(c: Context, i: Int, text: String) =
        PendingIntent.getBroadcast(c, 100 + i, Intent(c, ReminderReceiver::class.java).putExtra("text", text), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
}

class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(c: Context, i: Intent) {
        if (!Prefs.remindersOn(c)) return
        val nm = c.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.createNotificationChannel(NotificationChannel("daily", "Daily reminders", NotificationManager.IMPORTANCE_DEFAULT))
        val open = PendingIntent.getActivity(c, 0, Intent(c, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
        nm.notify((System.currentTimeMillis() % 100000).toInt(), NotificationCompat.Builder(c, "daily").setSmallIcon(android.R.drawable.ic_popup_reminder)
            .setContentTitle("Womanten").setContentText(i.getStringExtra("text") ?: "A small step today?").setContentIntent(open).setAutoCancel(true).build())
    }
}

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(c: Context, i: Intent) { Reminders.apply(c) }
}
