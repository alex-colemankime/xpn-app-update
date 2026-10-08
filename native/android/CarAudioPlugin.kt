// CarPlay and Android Auto, Android side: the plugin the web app talks to
// (car.js, "CarAudio"). WxpnCarService (the car's view of the app) sends the
// listener's choices here; the app plays them, and tells the car what's on.
//
// Copy into android/app/src/main/java/org/xpn/wxpn/ and register it in
// MainActivity (see README › CarPlay and Android Auto). Untested until the
// native project exists: try it with Android Studio's Desktop Head Unit.

package org.xpn.wxpn

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/** Shared between the plugin (the app) and the service (the car). */
object CarBridge {
    /** Set while the web app is listening. */
    var onCommand: ((JSObject) -> Unit)? = null
        set(value) {
            field = value
            // A choice made in the car before the app was listening.
            pending?.let { cmd -> value?.let { pending = null; it(cmd) } }
        }
    private var pending: JSObject? = null

    fun command(action: String, stationId: String? = null) {
        val cmd = JSObject().put("action", action)
        if (stationId != null) cmd.put("stationId", stationId)
        onCommand?.invoke(cmd) ?: run { pending = cmd }
    }

    /** What's playing, for the car; set by the app, read by the service. */
    data class NowPlaying(
        val stationId: String = "xpn",
        val playing: Boolean = false,
        val title: String = "WXPN",
        val artist: String = "88.5 FM · Public Radio",
    )
    var nowPlaying = NowPlaying()
        private set
    var onNowPlaying: ((NowPlaying) -> Unit)? = null

    fun setNowPlaying(value: NowPlaying) {
        nowPlaying = value
        onNowPlaying?.invoke(value)
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
            ),
        )
        call.resolve()
    }
}
