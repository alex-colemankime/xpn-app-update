// Android Auto: the car's view of the app. It lists WXPN, XPN2 and
// Homegrown, each with its tile; choosing one, or the car's play and pause
// buttons, goes to the app (CarBridge), which plays the station. What's
// playing comes back from the app and shows on the car's screen, with the
// song's artwork (the station's tile until it's fetched).
//
// The phone's notification and lock-screen controls stay with the media
// session plugin; this session is only active while a car is connected.
//
// If the car starts the app with the phone app closed, the app is opened in
// the background so its audio can play. Android may block that on some
// phones; try it with the Desktop Head Unit before release.

package org.xpn.wxpn

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.support.v4.media.MediaBrowserCompat.MediaItem
import android.support.v4.media.MediaDescriptionCompat
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.media.MediaBrowserServiceCompat
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class WxpnCarService : MediaBrowserServiceCompat() {
    private lateinit var session: MediaSessionCompat

    private val stations = listOf(
        Triple("xpn", "WXPN", "88.5 FM · Public Radio"),
        Triple("xpn2", "XPN2", "XPoNential Radio"),
        Triple("homegrown", "Homegrown", "Philadelphia's local music"),
    )

    /** Each station's tile (tools/car-art.mjs), for the list and before a song's artwork. */
    private fun tile(stationId: String): Bitmap? {
        val id = when (stationId) {
            "xpn2" -> R.drawable.car_xpn2
            "homegrown" -> R.drawable.car_homegrown
            else -> R.drawable.car_xpn
        }
        return BitmapFactory.decodeResource(resources, id)
    }

    // The song's artwork, fetched off the main thread and kept for the song.
    private val fetcher = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private var artUrl = ""
    private var art: Bitmap? = null

    override fun onCreate() {
        super.onCreate()
        session = MediaSessionCompat(this, "WxpnCar").apply {
            setCallback(object : MediaSessionCompat.Callback() {
                override fun onPlayFromMediaId(mediaId: String?, extras: Bundle?) = send("play", mediaId)
                override fun onPlay() = send("play")
                override fun onPause() = send("pause")
                override fun onStop() = send("pause")
            })
        }
        sessionToken = session.sessionToken
        CarBridge.onNowPlaying = { show(it) }
        show(CarBridge.nowPlaying)
    }

    override fun onDestroy() {
        CarBridge.onNowPlaying = null
        fetcher.shutdownNow()
        session.release()
        super.onDestroy()
    }

    /** A choice in the car, to the app; opens the app first if it isn't running. */
    private fun send(action: String, stationId: String? = null) {
        CarBridge.command(action, stationId)
        if (CarBridge.onCommand == null) {
            startActivity(
                Intent(this, MainActivity::class.java)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_ANIMATION),
            )
        }
    }

    private fun show(now: CarBridge.NowPlaying) {
        // The song's artwork once it's here; the station's tile until then.
        if (now.artwork != artUrl) {
            artUrl = now.artwork
            art = null
            if (now.artwork.isNotEmpty()) {
                fetcher.execute {
                    val fetched = fetch(now.artwork) ?: return@execute
                    main.post {
                        if (artUrl != now.artwork) return@post
                        art = fetched
                        show(CarBridge.nowPlaying)
                    }
                }
            }
        }
        session.setMetadata(
            MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_MEDIA_ID, now.stationId)
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, now.title)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, now.artist)
                .putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, art ?: tile(now.stationId))
                .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, -1) // live
                .build(),
        )
        session.setPlaybackState(
            PlaybackStateCompat.Builder()
                .setActions(
                    PlaybackStateCompat.ACTION_PLAY or PlaybackStateCompat.ACTION_PAUSE or
                        PlaybackStateCompat.ACTION_PLAY_PAUSE or PlaybackStateCompat.ACTION_STOP or
                        PlaybackStateCompat.ACTION_PLAY_FROM_MEDIA_ID,
                )
                .setState(
                    if (now.playing) PlaybackStateCompat.STATE_PLAYING else PlaybackStateCompat.STATE_PAUSED,
                    PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN,
                    1f,
                )
                .build(),
        )
    }

    // Any car (Android Auto) may browse; the list is the three stations.
    override fun onGetRoot(clientPackageName: String, clientUid: Int, rootHints: Bundle?): BrowserRoot {
        session.isActive = true
        return BrowserRoot("root", null)
    }

    override fun onLoadChildren(parentId: String, result: Result<MutableList<MediaItem>>) {
        if (parentId != "root") {
            result.sendResult(mutableListOf())
            return
        }
        result.sendResult(
            stations.map { (id, label, detail) ->
                MediaItem(
                    MediaDescriptionCompat.Builder()
                        .setMediaId(id)
                        .setTitle(label)
                        .setSubtitle(detail)
                        .setIconBitmap(tile(id))
                        .build(),
                    MediaItem.FLAG_PLAYABLE,
                )
            }.toMutableList(),
        )
    }

    /** An artwork address as a picture small enough for a car's screen. */
    private fun fetch(url: String): Bitmap? =
        try {
            val connection = URL(url).openConnection() as HttpURLConnection
            connection.connectTimeout = 10000
            connection.readTimeout = 10000
            connection.inputStream.use { stream ->
                BitmapFactory.decodeStream(stream)?.let { Bitmap.createScaledBitmap(it, 480, 480, true) }
            }
        } catch (e: Exception) {
            null
        }
}
