// The streams, as the app's tabs name them (streams.js), for the car and the
// home screen widget: one list, so the two never disagree.
package org.xpn.wxpn

object Stations {
    data class Station(val id: String, val label: String, val detail: String, val tile: Int)

    val all = listOf(
        Station("xpn", "WXPN", "88.5 FM · Public Radio", R.drawable.car_xpn),
        Station("xpn2", "XPN2", "XPoNential Radio", R.drawable.car_xpn2),
        Station("homegrown", "Homegrown", "Philadelphia's local music", R.drawable.car_homegrown),
    )

    /** The line shown when nothing more is known. */
    val tagline = all[0].detail

    fun byId(id: String): Station = all.firstOrNull { it.id == id } ?: all[0]
}
