package app.womanten

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class RepCounterTest {
    private fun run(angles: List<Double>, stepMs: Long = 200): Int {
        val c = RepCounter(); var t = 0L
        angles.forEach { c.update(it, t); t += stepMs }
        return c.reps
    }

    private val rep = listOf(170.0, 160.0, 130.0, 95.0, 85.0, 100.0, 140.0, 165.0, 172.0)

    @Test fun oneFullPushupIsOneRep() = assertEquals(1, run(rep))

    @Test fun threePushupsAreThree() = assertEquals(3, run(rep + rep + rep))

    @Test fun halfPushupDoesNotCount() = assertEquals(0, run(listOf(170.0, 150.0, 125.0, 130.0, 160.0, 170.0)))

    @Test fun standingStillIsZero() = assertEquals(0, run(List(30) { 168.0 }))

    @Test fun startingAtTheBottomDoesNotCount() = assertEquals(0, run(listOf(90.0, 92.0, 88.0, 90.0)))

    @Test fun jitterAtTheTopDoesNotCount() = assertEquals(0, run(listOf(170.0, 150.0, 172.0, 148.0, 171.0, 155.0, 170.0)))

    @Test fun veryFastWobbleIsCountedOnce() {
        val c = RepCounter(); var t = 0L
        listOf(170.0, 90.0, 170.0, 90.0, 170.0).forEach { c.update(it, t); t += 100 }
        assertTrue(c.reps <= 1)
    }

    @Test fun nanIsIgnored() {
        val c = RepCounter(); assertEquals(false, c.update(Double.NaN, 0)); assertEquals(0, c.reps)
    }

    @Test fun angleOfAStraightArmIs180AndABentOneIs90() {
        assertEquals(180.0, RepCounter.angle(0.0, 0.0, 1.0, 0.0, 2.0, 0.0), 0.01)
        assertEquals(90.0, RepCounter.angle(0.0, 1.0, 0.0, 0.0, 1.0, 0.0), 0.01)
    }
}
