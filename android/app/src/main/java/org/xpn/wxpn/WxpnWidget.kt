// The home screen widget, Android side: a block with the stream you're
// listening to, the song's artwork, title and artist, the show on the air,
// and a play key. What it shows comes from the app (HomeWidgetPlugin,
// widget.js). A tap on it opens the app; the play key opens it and plays or
// pauses (MainActivity hands that to the web app as the car's "toggle").
//
// Its size and look: res/xml/wxpn_widget_info.xml, res/layout/wxpn_widget.xml.

package org.xpn.wxpn

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.RemoteViews

class WxpnWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        draw(context, manager, ids)
    }

    companion object {
        const val ACTION_TOGGLE = "org.xpn.wxpn.WIDGET_TOGGLE"
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

            views.setTextViewText(R.id.widget_station, now.station)
            views.setTextViewText(R.id.widget_detail, now.detail)
            views.setViewVisibility(R.id.widget_detail, if (now.detail.isEmpty()) View.GONE else View.VISIBLE)
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
        private fun open(context: Context, action: String, code: Int): PendingIntent {
            val intent = Intent(context, MainActivity::class.java)
                .setAction(action)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            return PendingIntent.getActivity(
                context,
                code,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        }
    }
}
