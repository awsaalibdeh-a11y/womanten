package app.womanten

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ExercisesTest {
    // squats use the same state machine as push-ups with the knee angle
    @Test fun squatsCountFromKneeAngle() {
        val c = RepCounter(upAbove = 160.0, downBelow = 115.0); var t = 0L
        val squat = listOf(172.0, 165.0, 140.0, 105.0, 95.0, 120.0, 150.0, 168.0, 172.0)
        repeat(3) { squat.forEach { c.update(it, t); t += 250 } }
        assertEquals(3, c.reps)
    }

    @Test fun shallowSquatDoesNotCount() {
        val c = RepCounter(160.0, 115.0); var t = 0L
        listOf(172.0, 150.0, 130.0, 128.0, 150.0, 172.0).forEach { c.update(it, t); t += 250 }
        assertEquals(0, c.reps)
    }

    private fun open() = JackCounter.classify(200.0, 200.0, 100.0, 100.0, 300.0, 400.0, 150.0, 550.0)     // arms above shoulders, feet very wide
    private fun closed() = JackCounter.classify(200.0, 200.0, 320.0, 320.0, 300.0, 400.0, 340.0, 360.0)   // arms down, feet together

    @Test fun jackPoseClassification() {
        assertEquals(true, open()); assertEquals(false, closed())
        assertNull(JackCounter.classify(200.0, 200.0, 100.0, 320.0, 300.0, 400.0, 340.0, 360.0))           // one arm up: ignored
        assertNull(JackCounter.classify(200.0, 200.0, 100.0, 100.0, 300.0, 300.5, 0.0, 10.0))               // shoulders not visible properly
    }

    @Test fun jumpingJacksCountOnReturn() {
        val c = JackCounter(); var t = 0L; var n = 0
        repeat(4) { listOf(closed(), open(), open(), closed()).forEach { s -> if (c.update(s, t)) n++; t += 300 } }
        assertEquals(4, n); assertEquals(4, c.reps)
    }

    @Test fun standingStillDoesNotCountJacks() {
        val c = JackCounter(); var t = 0L
        repeat(20) { c.update(closed(), t); t += 300 }
        assertEquals(0, c.reps)
    }

    @Test fun plankPaysOutEveryTenSecondsOfHolding() {
        val p = PlankTimer(); var t = 0L; var paid = 0
        repeat(130) { if (p.update(170.0, t)) paid++; t += 250 }          // 32.5 seconds
        assertEquals(3, paid)
    }

    @Test fun saggingPlankStopsTheClock() {
        val p = PlankTimer(); var t = 0L
        repeat(42) { p.update(170.0, t); t += 250 }                        // just over 10 s
        val held = p.heldMs
        repeat(40) { p.update(140.0, t); t += 250 }                        // sag for 10 s
        assertEquals(held, p.heldMs)
        assertFalse(p.update(Double.NaN, t))
        assertTrue(p.chunks >= 1)
    }

    @Test fun lockWindowCrossingMidnight() {
        assertTrue(inLockWindow(22, 21, 7)); assertTrue(inLockWindow(3, 21, 7)); assertFalse(inLockWindow(12, 21, 7)); assertFalse(inLockWindow(7, 21, 7))
    }

    @Test fun lockWindowSameDayAndAllDay() {
        assertTrue(inLockWindow(9, 8, 15)); assertFalse(inLockWindow(15, 8, 15)); assertFalse(inLockWindow(20, 8, 15)); assertTrue(inLockWindow(5, 6, 6))
    }
}
