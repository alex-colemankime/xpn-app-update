// The home screen widget, the app's side: the plugin the web app talks to
// (widget.js, "HomeWidget"). It keeps what's playing where the widget
// (WxpnWidget) reads it, fetches the song's artwork for it, and redraws it.
//
// Registered in MainActivity.

package org.xpn.wxpn

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/** What the widget shows, kept in the app's preferences. */
object WidgetState {
    private const val PREFS = "wxpn_widget"
    private const val ART = "widget_art.png"

    data class NowPlaying(
        val station: String = "WXPN",
        val detail: String = "88.5 FM · Public Radio",
        val title: String = "WXPN",
        val artist: String = "88.5 FM · Public Radio",
        val show: String = "",
        val artwork: String = "",
        val playing: Boolean = false,
    )

    fun read(context: Context): NowPlaying {
        val p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val d = NowPlaying()
        return NowPlaying(
            station = p.getString("station", d.station) ?: d.station,
            detail = p.getString("detail", d.detail) ?: d.detail,
            title = p.getString("title", d.title) ?: d.title,
            artist = p.getString("artist", d.artist) ?: d.artist,
            show = p.getString("show", d.show) ?: d.show,
            artwork = p.getString("artwork", d.artwork) ?: d.artwork,
            playing = p.getBoolean("playing", d.playing),
        )
    }

    fun write(context: Context, now: NowPlaying) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString("station", now.station)
            .putString("detail", now.detail)
            .putString("title", now.title)
            .putString("artist", now.artist)
            .putString("show", now.show)
            .putString("artwork", now.artwork)
            .putBoolean("playing", now.playing)
            .apply()
    }

    fun artFile(context: Context) = File(context.filesDir, ART)

    /** The artwork as drawn, or null for the station's own. */
    fun art(context: Context): Bitmap? {
        val file = artFile(context)
        return if (file.exists()) BitmapFactory.decodeFile(file.path) else null
    }
}

@CapacitorPlugin(name = "HomeWidget")
class HomeWidgetPlugin : Plugin() {
    // Artwork is fetched off the main thread, one at a time.
    private val fetcher = Executors.newSingleThreadExecutor()

    @PluginMethod
    fun update(call: PluginCall) {
        val app = context.applicationContext
        val before = WidgetState.read(app)
        val now = WidgetState.NowPlaying(
            station = call.getString("station") ?: "WXPN",
            detail = call.getString("detail") ?: "",
            title = call.getString("title") ?: "WXPN",
            artist = call.getString("artist") ?: "",
            show = call.getString("show") ?: "",
            artwork = call.getString("artwork") ?: "",
            playing = call.getBoolean("playing") ?: false,
        )
        WidgetState.write(app, now)
        call.resolve()
        if (now.artwork == before.artwork && (now.artwork.isEmpty() || WidgetState.artFile(app).exists())) {
            WxpnWidget.refresh(app)
            return
        }
        // New artwork: the words change now, the picture once it's here.
        WidgetState.artFile(app).delete()
        WxpnWidget.refresh(app)
        if (now.artwork.isEmpty()) return
        fetcher.execute {
            val art = fetch(now.artwork) ?: return@execute
            // Still the song playing? A later one may have taken its place.
            if (WidgetState.read(app).artwork != now.artwork) return@execute
            WidgetState.artFile(app).outputStream().use { art.compress(Bitmap.CompressFormat.PNG, 100, it) }
            WxpnWidget.refresh(app)
        }
    }

    /** The artwork, scaled to the widget's size (a widget's picture must stay small). */
    private fun fetch(url: String): Bitmap? =
        try {
            val connection = URL(url).openConnection() as HttpURLConnection
            connection.connectTimeout = 10000
            connection.readTimeout = 10000
            connection.inputStream.use { stream ->
                BitmapFactory.decodeStream(stream)?.let { Bitmap.createScaledBitmap(it, ART_PX, ART_PX, true) }
            }
        } catch (e: Exception) {
            null
        }

    override fun handleOnDestroy() {
        fetcher.shutdown()
    }

    companion object {
        private const val ART_PX = 360
    }
}
