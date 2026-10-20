// CarPlay and Android Auto, Android side: the plugin the web app talks to
// (car.js, "CarAudio"). WxpnCarService (the car's view of the app) sends the
// listener's choices here; the app plays them, and tells the car what's on.
//
// Registered in MainActivity. Try it with Android Studio's Desktop Head Unit
// (see README › CarPlay and Android Auto).

package org.xpn.wxpn

import android.os.Handler
import android.os.Looper
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Shared between the plugin (the app) and the service (the car). The car's
 * media session calls in on the main thread and the app's plugin calls on
 * Capacitor's own, so everything here runs on the main thread.
 */
object CarBridge {
    private val main = Handler(Looper.getMainLooper())

    /** Set while the web app is listening. */
    var onCommand: ((JSObject) -> Unit)? = null
        set(value) {
            field = value
            // A choice made in the car before the app was listening.
            main.post {
                val listener = onCommand ?: return@post
                val cmd = pending ?: return@post
                pending = null
                listener(cmd)
            }
        }
    private var pending: JSObject? = null

    fun command(action: String, stationId: String? = null) {
        val cmd = JSObject().put("action", action)
        if (stationId != null) cmd.put("stationId", stationId)
        main.post { onCommand?.invoke(cmd) ?: run { pending = cmd } }
    }

    /** What's playing, for the car; set by the app, read by the service. */
    data class NowPlaying(
        val stationId: String = "xpn",
        val playing: Boolean = false,
        val title: String = "WXPN",
        val artist: String = "88.5 FM · Public Radio",
        /** The song's artwork (an https address), or "" for the station's tile. */
        val artwork: String = "",
    )
    @Volatile var nowPlaying = NowPlaying()
        private set
    var onNowPlaying: ((NowPlaying) -> Unit)? = null

    fun setNowPlaying(value: NowPlaying) {
        nowPlaying = value
        // The service updates its media session, which belongs on main.
        main.post { onNowPlaying?.invoke(value) }
    }
}

@CapacitorPlugin(name = "CarAudio")
class CarAudioPlugin : Plugin() {
    override fun load() {
        CarBridge.onCommand = { cmd -> notifyListeners("command", cmd, true) }
    }

    override fun handleOnDestroy() {
        CarBridge.onCommand = null
    }

    @PluginMethod
    fun setNowPlaying(call: PluginCall) {
        CarBridge.setNowPlaying(
            CarBridge.NowPlaying(
                stationId = call.getString("stationId") ?: "xpn",
                playing = call.getBoolean("playing") ?: false,
                title = call.getString("title") ?: "WXPN",
                artist = call.getString("artist") ?: "",
                artwork = call.getString("artwork") ?: "",
            ),
        )
        call.resolve()
    }
}
