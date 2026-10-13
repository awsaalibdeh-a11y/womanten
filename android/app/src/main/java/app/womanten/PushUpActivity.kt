package app.womanten

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Typeface
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.pose.Pose
import com.google.mlkit.vision.pose.PoseDetection
import com.google.mlkit.vision.pose.PoseLandmark
import com.google.mlkit.vision.pose.defaults.PoseDetectorOptions
import java.util.concurrent.Executors

/**
 * Open the camera, watch the exercise you picked, and pay out scrolls for it (or, in Focus mode, count down the reps that end focus early).
 * The video is analysed on the phone and never stored or sent anywhere.
 */
class PushUpActivity : ComponentActivity() {
    private val executor = Executors.newSingleThreadExecutor()
    private val detector by lazy { PoseDetection.getClient(PoseDetectorOptions.Builder().setDetectorMode(PoseDetectorOptions.STREAM_MODE).build()) }
    private lateinit var count: TextView
    private lateinit var earned: TextView
    private lateinit var status: TextView
    private lateinit var picker: LinearLayout
    private var preview: PreviewView? = null

    private lateinit var exercise: Exercise
    private var reps = RepCounter(150.0, 105.0)
    private var jacks = JackCounter()
    private var plank = PlankTimer()
    private var sessionReps = 0

    private val askCamera = registerForActivityResult(ActivityResultContracts.RequestPermission()) { ok -> if (ok) startCamera() else status.text = "Camera permission is needed to count your reps." }

    override fun onCreate(b: Bundle?) {
        super.onCreate(b)
        exercise = Prefs.exercise(this)
        val root = FrameLayout(this).apply { setBackgroundColor(Color.parseColor("#0a0a0a")) }
        preview = PreviewView(this).apply { implementationMode = PreviewView.ImplementationMode.COMPATIBLE }
        root.addView(preview, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))

        picker = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; setBackgroundColor(Color.parseColor("#CC101010")); setPadding(12, 40, 12, 12) }
        Exercise.values().forEach { e -> picker.addView(Button(this).apply { text = e.label.substringBefore(' '); textSize = 12f; isAllCaps = false; tag = e; setOnClickListener { choose(e) } }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)) }
        root.addView(picker, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.TOP))

        val panel = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setBackgroundColor(Color.parseColor("#E6101010")); setPadding(40, 30, 40, 36); gravity = Gravity.CENTER_HORIZONTAL }
        count = TextView(this).apply { text = "0"; textSize = 64f; setTextColor(Color.WHITE); typeface = Typeface.create("sans-serif-light", Typeface.NORMAL); gravity = Gravity.CENTER }
        earned = TextView(this).apply { textSize = 15f; setTextColor(Color.parseColor("#E8998D")); gravity = Gravity.CENTER }
        status = TextView(this).apply { textSize = 14f; setTextColor(Color.parseColor("#BBBBBB")); gravity = Gravity.CENTER; setPadding(0, 14, 0, 14) }
        val done = Button(this).apply { text = "Done"; setOnClickListener { finish() } }
        panel.addView(count); panel.addView(earned); panel.addView(status); panel.addView(done)
        root.addView(panel, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM))
        setContentView(root)
        choose(exercise)

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) startCamera() else askCamera.launch(Manifest.permission.CAMERA)
    }

    private fun choose(e: Exercise) {
        exercise = e; Prefs.setExercise(this, e)
        reps = if (e == Exercise.SQUAT) RepCounter(160.0, 115.0) else RepCounter(150.0, 105.0)
        jacks = JackCounter(); plank = PlankTimer(); sessionReps = 0
        for (i in 0 until picker.childCount) (picker.getChildAt(i) as Button).alpha = if (picker.getChildAt(i).tag == e) 1f else 0.5f
        count.text = "0"
        earned.text = if (Prefs.focusActive(this)) "Focus mode: ${Prefs.focusRepsLeft(this)} reps to end it early" else "${Prefs.perPushup(this)} scrolls for each ${e.unit}"
        status.text = e.setup
    }

    private fun startCamera() {
        val future = ProcessCameraProvider.getInstance(this)
        future.addListener({
            val provider = future.get()
            val previewUse = Preview.Builder().build().also { it.setSurfaceProvider(preview!!.surfaceProvider) }
            val analysis = ImageAnalysis.Builder().setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST).build()
            analysis.setAnalyzer(executor) { img -> analyze(img) }
            try {
                provider.unbindAll()
                provider.bindToLifecycle(this, CameraSelector.DEFAULT_FRONT_CAMERA, previewUse, analysis)
            } catch (e: Exception) { status.text = "Could not open the camera." }
        }, ContextCompat.getMainExecutor(this))
    }

    @androidx.annotation.OptIn(androidx.camera.core.ExperimentalGetImage::class)
    private fun analyze(proxy: ImageProxy) {
        val media = proxy.image
        if (media == null) { proxy.close(); return }
        val input = InputImage.fromMediaImage(media, proxy.imageInfo.rotationDegrees)
        detector.process(input).addOnSuccessListener { pose -> onPose(pose) }.addOnCompleteListener { proxy.close() }
    }

    private fun lm(p: Pose, type: Int): PoseLandmark? = p.getPoseLandmark(type)?.takeIf { it.inFrameLikelihood >= 0.5f }

    private fun angle(p: Pose, a: Int, b: Int, c: Int): Double {
        val x = lm(p, a) ?: return Double.NaN; val y = lm(p, b) ?: return Double.NaN; val z = lm(p, c) ?: return Double.NaN
        return RepCounter.angle(x.position.x.toDouble(), x.position.y.toDouble(), y.position.x.toDouble(), y.position.y.toDouble(), z.position.x.toDouble(), z.position.y.toDouble())
    }

    private fun best(l: Double, r: Double) = when { !l.isNaN() && !r.isNaN() -> (l + r) / 2; !l.isNaN() -> l; else -> r }

    private fun onPose(p: Pose) {
        val now = System.currentTimeMillis()
        var rep = false
        when (exercise) {
            Exercise.PUSHUP -> {
                val a = best(angle(p, PoseLandmark.LEFT_SHOULDER, PoseLandmark.LEFT_ELBOW, PoseLandmark.LEFT_WRIST), angle(p, PoseLandmark.RIGHT_SHOULDER, PoseLandmark.RIGHT_ELBOW, PoseLandmark.RIGHT_WRIST))
                if (a.isNaN()) return lost("I cannot see your arms yet. Move back a little.")
                rep = reps.update(a, now); hint(rep, reps.phase == RepCounter.Phase.DOWN, "Lower your chest toward the floor.", "Now push back up.")
            }
            Exercise.SQUAT -> {
                val a = best(angle(p, PoseLandmark.LEFT_HIP, PoseLandmark.LEFT_KNEE, PoseLandmark.LEFT_ANKLE), angle(p, PoseLandmark.RIGHT_HIP, PoseLandmark.RIGHT_KNEE, PoseLandmark.RIGHT_ANKLE))
                if (a.isNaN()) return lost("I cannot see your legs yet. Step back so your whole body is in view.")
                rep = reps.update(a, now); hint(rep, reps.phase == RepCounter.Phase.DOWN, "Sit back and down like a chair.", "Now stand tall.")
            }
            Exercise.JACK -> {
                val s = JackCounter.classify(
                    lm(p, PoseLandmark.LEFT_SHOULDER)?.position?.y?.toDouble() ?: return lost("I cannot see you yet. Step back."), lm(p, PoseLandmark.RIGHT_SHOULDER)?.position?.y?.toDouble() ?: return lost("I cannot see you yet. Step back."),
                    lm(p, PoseLandmark.LEFT_WRIST)?.position?.y?.toDouble() ?: return lost("Keep both arms in view."), lm(p, PoseLandmark.RIGHT_WRIST)?.position?.y?.toDouble() ?: return lost("Keep both arms in view."),
                    lm(p, PoseLandmark.LEFT_SHOULDER)!!.position.x.toDouble(), lm(p, PoseLandmark.RIGHT_SHOULDER)!!.position.x.toDouble(),
                    lm(p, PoseLandmark.LEFT_ANKLE)?.position?.x?.toDouble() ?: return lost("Step back so your feet are in view."), lm(p, PoseLandmark.RIGHT_ANKLE)?.position?.x?.toDouble() ?: return lost("Step back so your feet are in view."))
                rep = jacks.update(s, now)
            }
            Exercise.PLANK -> {
                val a = best(angle(p, PoseLandmark.LEFT_SHOULDER, PoseLandmark.LEFT_HIP, PoseLandmark.LEFT_ANKLE), angle(p, PoseLandmark.RIGHT_SHOULDER, PoseLandmark.RIGHT_HIP, PoseLandmark.RIGHT_ANKLE))
                if (a.isNaN()) return lost("I cannot see your whole body line. Turn side on.")
                rep = plank.update(a, now)
                runOnUiThread { count.text = (plank.heldMs / 1000).toString() + "s"; status.text = if (a >= 160) "Hold it. Keep your body in one straight line." else "Lift your hips or lower them to make a straight line." }
            }
        }
        if (rep) payOut()
    }

    private fun lost(msg: String) { runOnUiThread { status.text = msg } }

    private fun hint(rep: Boolean, down: Boolean, downMsg: String, upMsg: String) { if (!rep) runOnUiThread { status.text = if (down) upMsg else downMsg } }

    private fun payOut() {
        sessionReps++
        runOnUiThread {
            if (exercise != Exercise.PLANK) count.text = sessionReps.toString()
            if (Prefs.focusActive(this)) {
                val left = Prefs.focusRep(this)
                if (left == 0) { status.text = "Focus mode ended. Well done!"; earned.text = "" } else { status.text = "$left more to end focus early."; earned.text = "Focus mode: $left reps to end it early" }
            } else {
                Prefs.addPushup(this); Prefs.addScrolls(this, Prefs.perPushup(this))
                status.text = "Nice! You have ${Prefs.scrolls(this)} scrolls now. Keep going or tap Done."
            }
        }
    }

    override fun onDestroy() { super.onDestroy(); executor.shutdown(); runCatching { detector.close() } }
}
