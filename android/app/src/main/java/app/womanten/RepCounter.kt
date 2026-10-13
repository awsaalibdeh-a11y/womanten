package app.womanten

/**
 * Counts push-ups from the elbow angle (shoulder, elbow, wrist). One rep is a full trip from arms
 * straight (UP) down to bent (DOWN) and back up again. The two thresholds are far apart on purpose, so
 * a wobble or a half push-up does not count, and a minimum gap stops one rep being counted twice.
 */
class RepCounter(private val upAbove: Double = 150.0, private val downBelow: Double = 105.0, private val minGapMs: Long = 600) {
    enum class Phase { UNKNOWN, UP, DOWN }

    var reps = 0; private set
    var phase = Phase.UNKNOWN; private set
    private var smooth = Double.NaN
    private var lastRepAt = -1_000_000L

    /** Feed one angle in degrees with the time in ms. Returns true when this frame finished a rep. */
    fun update(angle: Double, nowMs: Long): Boolean {
        if (angle.isNaN()) return false
        smooth = if (smooth.isNaN()) angle else smooth * 0.5 + angle * 0.5
        when {
            smooth >= upAbove -> {
                val finished = phase == Phase.DOWN && nowMs - lastRepAt >= minGapMs
                phase = Phase.UP
                if (finished) { reps++; lastRepAt = nowMs; return true }
            }
            smooth <= downBelow -> if (phase == Phase.UP) phase = Phase.DOWN
        }
        return false
    }

    fun reset() { reps = 0; phase = Phase.UNKNOWN; smooth = Double.NaN; lastRepAt = -1_000_000L }

    companion object {
        /** Angle at b between the lines b-a and b-c, in degrees (0 to 180). */
        fun angle(ax: Double, ay: Double, bx: Double, by: Double, cx: Double, cy: Double): Double {
            val v1x = ax - bx; val v1y = ay - by; val v2x = cx - bx; val v2y = cy - by
            val n = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y)
            if (n == 0.0) return Double.NaN
            return Math.toDegrees(Math.acos(((v1x * v2x + v1y * v2y) / n).coerceIn(-1.0, 1.0)))
        }
    }
}
