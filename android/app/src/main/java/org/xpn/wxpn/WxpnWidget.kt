// The home screen widget, Android side: a block with the streams (the one
// you're listening to marked), the song's artwork, title and artist, the
// show on the air, and a play key. What it shows comes from the app
// (HomeWidgetPlugin, widget.js). A tap on it opens the app; the play key
// opens it and plays or pauses, and a stream's name opens it playing that
// stream (MainActivity hands both to the web app as the car's commands).
//
// Its size and look: res/xml/wxpn_widget_info.xml, res/layout/wxpn_widget.xml.

package org.xpn.wxpn

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Typeface
import android.text.SpannableString
import android.text.style.StyleSpan
import android.text.style.UnderlineSpan
import android.view.View
import android.widget.RemoteViews

class WxpnWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        draw(context, manager, ids)
    }

    companion object {
        const val ACTION_TOGGLE = "org.xpn.wxpn.WIDGET_TOGGLE"
        const val ACTION_PLAY = "org.xpn.wxpn.WIDGET_PLAY"
        const val EXTRA_STATION = "stationId"

        /** The streams in the widget's top row (Stations.kt), each with its view. */
        private val STATIONS = Stations.all.zip(
            listOf(R.id.widget_st_xpn, R.id.widget_st_xpn2, R.id.widget_st_homegrown),
        ) { station, view -> Triple(station.id, station.label, view) }
        private const val ACTION_OPEN = "org.xpn.wxpn.WIDGET_OPEN"

        /** Redraws every WXPN widget on the home screen. */
        fun refresh(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, WxpnWidget::class.java))
            if (ids.isNotEmpty()) draw(context, manager, ids)
        }

        private fun draw(context: Context, manager: AppWidgetManager, ids: IntArray) {
            val now = WidgetState.read(context)
            val views = RemoteViews(context.packageName, R.layout.wxpn_widget)

            // The streams, the one playing in ink, bold and underlined.
            val ink = context.getColor(R.color.widget_text)
            val muted = context.getColor(R.color.widget_muted)
            STATIONS.forEachIndexed { i, (id, label, view) ->
                val on = id == now.stationId
                val text = SpannableString(label)
                if (on) {
                    text.setSpan(StyleSpan(Typeface.BOLD), 0, label.length, 0)
                    text.setSpan(UnderlineSpan(), 0, label.length, 0)
                }
                views.setTextViewText(view, text)
                views.setTextColor(view, if (on) ink else muted)
                views.setContentDescription(
                    view,
                    context.getString(if (on) R.string.widget_station_on else R.string.widget_station_play, label),
                )
                views.setOnClickPendingIntent(view, open(context, ACTION_PLAY, 10 + i, id))
            }
            views.setTextViewText(R.id.widget_title, now.title)
            views.setTextViewText(R.id.widget_artist, now.artist)
            views.setViewVisibility(R.id.widget_artist, if (now.artist.isEmpty()) View.GONE else View.VISIBLE)
            views.setTextViewText(R.id.widget_show, now.show)
            views.setViewVisibility(R.id.widget_show, if (now.show.isEmpty()) View.INVISIBLE else View.VISIBLE)

            val art = WidgetState.art(context)
            if (art != null) {
                views.setImageViewBitmap(R.id.widget_art, art)
            } else {
                views.setImageViewResource(R.id.widget_art, R.drawable.widget_station_art)
            }

            views.setImageViewResource(
                R.id.widget_play,
                if (now.playing) R.drawable.ic_widget_pause else R.drawable.ic_widget_play,
            )
            views.setContentDescription(
                R.id.widget_play,
                context.getString(if (now.playing) R.string.widget_pause else R.string.widget_play, now.station),
            )

            views.setOnClickPendingIntent(R.id.widget_root, open(context, ACTION_OPEN, 0))
            views.setOnClickPendingIntent(R.id.widget_play, open(context, ACTION_TOGGLE, 1))
            manager.updateAppWidget(ids, views)
        }

        /** Opens the app, carrying what the widget asked for. */
        private fun open(context: Context, action: String, code: Int, stationId: String? = null): PendingIntent {
            val intent = Intent(context, MainActivity::class.java)
                .setAction(action)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            if (stationId != null) intent.putExtra(EXTRA_STATION, stationId)
            return PendingIntent.getActivity(
                context,
                code,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        }
    }
}
