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

/** Open the camera, watch for push-ups, and pay out scrolls for each one. The video never leaves the phone. */
class PushUpActivity : ComponentActivity() {
    private val counter = RepCounter()
    private val executor = Executors.newSingleThreadExecutor()
    private val detector by lazy { PoseDetection.getClient(PoseDetectorOptions.Builder().setDetectorMode(PoseDetectorOptions.STREAM_MODE).build()) }
    private lateinit var count: TextView
    private lateinit var earned: TextView
    private lateinit var status: TextView
    private var sessionReps = 0

    private val askCamera = registerForActivityResult(ActivityResultContracts.RequestPermission()) { ok -> if (ok) startCamera() else status.text = "Camera permission is needed to count your push-ups." }

    override fun onCreate(b: Bundle?) {
        super.onCreate(b)
        val root = FrameLayout(this).apply { setBackgroundColor(Color.parseColor("#0a0a0a")) }
        val preview = PreviewView(this).apply { implementationMode = PreviewView.ImplementationMode.COMPATIBLE }
        root.addView(preview, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))

        val panel = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setBackgroundColor(Color.parseColor("#E6101010")); setPadding(40, 30, 40, 36); gravity = Gravity.CENTER_HORIZONTAL }
        count = TextView(this).apply { text = "0"; textSize = 64f; setTextColor(Color.WHITE); typeface = Typeface.create("sans-serif-light", Typeface.NORMAL); gravity = Gravity.CENTER }
        earned = TextView(this).apply { text = "push-ups this time"; textSize = 15f; setTextColor(Color.parseColor("#E8998D")); gravity = Gravity.CENTER }
        status = TextView(this).apply { text = "Prop your phone up on the floor, step back, and get in a push-up position so your arms are in view. Go slowly."; textSize = 14f; setTextColor(Color.parseColor("#BBBBBB")); gravity = Gravity.CENTER; setPadding(0, 14, 0, 14) }
        val done = Button(this).apply { text = "Done"; setOnClickListener { finish() } }
        panel.addView(count); panel.addView(earned); panel.addView(status); panel.addView(done)
        root.addView(panel, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM))
        setContentView(root)

        findViewForPreview = preview
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) startCamera() else askCamera.launch(Manifest.permission.CAMERA)
    }

    private var findViewForPreview: PreviewView? = null

    private fun startCamera() {
        val future = ProcessCameraProvider.getInstance(this)
        future.addListener({
            val provider = future.get()
            val previewUse = Preview.Builder().build().also { it.setSurfaceProvider(findViewForPreview!!.surfaceProvider) }
            val analysis = ImageAnalysis.Builder().setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST).build()
            analysis.setAnalyzer(executor) { img -> analyze(img) }
            try {
                provider.unbindAll()
                provider.bindToLifecycle(this, CameraSelector.DEFAULT_FRONT_CAMERA, previewUse, analysis)
                status.text = "Looking for you… get your arms and shoulders in view."
            } catch (e: Exception) { status.text = "Could not open the camera." }
        }, ContextCompat.getMainExecutor(this))
    }

    @androidx.annotation.OptIn(androidx.camera.core.ExperimentalGetImage::class)
    private fun analyze(proxy: ImageProxy) {
        val media = proxy.image
        if (media == null) { proxy.close(); return }
        val input = InputImage.fromMediaImage(media, proxy.imageInfo.rotationDegrees)
        detector.process(input)
            .addOnSuccessListener { pose -> onPose(pose) }
            .addOnCompleteListener { proxy.close() }
    }

    private fun elbowAngle(p: Pose, s: Int, e: Int, w: Int): Double {
        val a = p.getPoseLandmark(s); val b = p.getPoseLandmark(e); val c = p.getPoseLandmark(w)
        if (a == null || b == null || c == null || minOf(a.inFrameLikelihood, b.inFrameLikelihood, c.inFrameLikelihood) < 0.5f) return Double.NaN
        return RepCounter.angle(a.position.x.toDouble(), a.position.y.toDouble(), b.position.x.toDouble(), b.position.y.toDouble(), c.position.x.toDouble(), c.position.y.toDouble())
    }

    private fun onPose(p: Pose) {
        val left = elbowAngle(p, PoseLandmark.LEFT_SHOULDER, PoseLandmark.LEFT_ELBOW, PoseLandmark.LEFT_WRIST)
        val right = elbowAngle(p, PoseLandmark.RIGHT_SHOULDER, PoseLandmark.RIGHT_ELBOW, PoseLandmark.RIGHT_WRIST)
        val angle = when { !left.isNaN() && !right.isNaN() -> (left + right) / 2; !left.isNaN() -> left; else -> right }
        if (angle.isNaN()) { runOnUiThread { status.text = "I cannot see your arms yet. Move back a little." }; return }
        if (counter.update(angle, System.currentTimeMillis())) {
            sessionReps++
            Prefs.addPushup(this); Prefs.addScrolls(this, Prefs.perPushup(this))
            runOnUiThread {
                count.text = sessionReps.toString()
                status.text = "Nice! You have ${Prefs.scrolls(this)} scrolls now. Keep going or tap Done."
            }
        } else runOnUiThread { status.text = if (counter.phase == RepCounter.Phase.DOWN) "Now push back up." else "Lower your chest toward the floor." }
    }

    override fun onDestroy() { super.onDestroy(); executor.shutdown(); runCatching { detector.close() } }
}
