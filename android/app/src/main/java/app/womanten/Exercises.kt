package app.womanten

/** The exercises that unlock your apps. Each one turns the pose from the camera into reps. All of it is pure maths, so it is unit tested. */
enum class Exercise(val label: String, val unit: String, val setup: String) {
    PUSHUP("Push-ups", "push-up", "Prop your phone on the floor and get in a push-up position so your arms are in view. Go slowly."),
    SQUAT("Squats", "squat", "Prop your phone at waist height and step back until your whole body is in view."),
    JACK("Jumping jacks", "jumping jack", "Prop your phone at waist height and step back until your whole body and both arms are in view."),
    PLANK("Plank hold", "10 seconds held", "Prop your phone on the floor, side on to you, and hold a straight plank so your body is in view."),
}

/** Counts jumping jacks: arms up and feet wide is OPEN, arms down and feet together is CLOSED. One jack = open then closed. */
class JackCounter(private val minGapMs: Long = 450) {
    var reps = 0; private set
    private var wasOpen = false
    private var lastAt = -1_000_000L

    fun update(state: Boolean?, nowMs: Long): Boolean {
        if (state == null) return false
        if (state) { wasOpen = true; return false }
        if (wasOpen && nowMs - lastAt >= minGapMs) { wasOpen = false; reps++; lastAt = nowMs; return true }
        if (wasOpen) wasOpen = false
        return false
    }

    companion object {
        /**
         * true = open, false = closed, null = somewhere in between (ignored).
         * y grows downward, so "above the shoulder" means a smaller y.
         */
        fun classify(leftShoulderY: Double, rightShoulderY: Double, leftWristY: Double, rightWristY: Double,
                     leftShoulderX: Double, rightShoulderX: Double, leftAnkleX: Double, rightAnkleX: Double): Boolean? {
            val shoulderW = Math.abs(leftShoulderX - rightShoulderX)
            if (shoulderW < 1.0) return null
            val feet = Math.abs(leftAnkleX - rightAnkleX) / shoulderW
            val shoulderY = (leftShoulderY + rightShoulderY) / 2
            val armsUp = leftWristY < shoulderY && rightWristY < shoulderY
            val armsDown = leftWristY > shoulderY && rightWristY > shoulderY
            return when {
                armsUp && feet >= 1.5 -> true
                armsDown && feet <= 1.2 -> false
                else -> null
            }
        }
    }
}

/** Plank: counts seconds of holding a straight body line (shoulder, hip, ankle) and pays out one "rep" for every full 10 seconds. */
class PlankTimer(private val straightAbove: Double = 160.0, private val chunkMs: Long = 10_000) {
    var heldMs = 0L; private set
    var chunks = 0; private set
    private var lastAt = -1L

    fun update(bodyAngle: Double, nowMs: Long): Boolean {
        val dt = if (lastAt < 0) 0 else (nowMs - lastAt).coerceIn(0, 500)
        lastAt = nowMs
        if (bodyAngle.isNaN() || bodyAngle < straightAbove) return false       // sagging or piking: the clock waits
        val before = heldMs / chunkMs
        heldMs += dt
        if (heldMs / chunkMs > before) { chunks++; return true }
        return false
    }
}

/** Is this hour inside the lock window? Handles windows that cross midnight (21 to 7). Equal hours mean all day. */
fun inLockWindow(hour: Int, from: Int, to: Int): Boolean = if (from == to) true else if (from < to) hour in from until to else hour >= from || hour < to
