// Android Auto: the car's view of the app. It lists WXPN, XPN2 and
// Homegrown; choosing one, or the car's play and pause buttons, goes to the
// app (CarBridge), which plays the station. What's playing comes back from
// the app and shows on the car's screen.
//
// The phone's notification and lock-screen controls stay with the media
// session plugin; this session is only active while a car is connected.
//
// If the car starts the app with the phone app closed, the app is opened in
// the background so its audio can play. Android may block that on some
// phones; try it with the Desktop Head Unit before release.

package org.xpn.wxpn

import android.content.Intent
import android.os.Bundle
import android.support.v4.media.MediaBrowserCompat.MediaItem
import android.support.v4.media.MediaDescriptionCompat
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.media.MediaBrowserServiceCompat

class WxpnCarService : MediaBrowserServiceCompat() {
    private lateinit var session: MediaSessionCompat

    private val stations = listOf(
        Triple("xpn", "WXPN", "88.5 FM · Public Radio"),
        Triple("xpn2", "XPN2", "XPoNential Radio"),
        Triple("homegrown", "Homegrown", "Philadelphia's local music"),
    )

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
        session.setMetadata(
            MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_MEDIA_ID, now.stationId)
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, now.title)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, now.artist)
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
                        .build(),
                    MediaItem.FLAG_PLAYABLE,
                )
            }.toMutableList(),
        )
    }
}
