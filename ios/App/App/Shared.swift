// What the app and its widget extension share, compiled into both targets:
// the stations (as in streams.js) and the names of what the widget reads.

import Foundation

/// The streams, as the app's tabs name them, with the line under each name
/// in the car's list. Artwork: the image sets "car-<id>" in Assets.xcassets.
enum Stations {
    struct Station {
        let id: String
        let label: String
        let detail: String
    }

    static let all = [
        Station(id: "xpn", label: "WXPN", detail: "88.5 FM · Public Radio"),
        Station(id: "xpn2", label: "XPN2", detail: "XPoNential Radio"),
        Station(id: "homegrown", label: "Homegrown", detail: "Philadelphia's local music"),
    ]
    /// The line shown when nothing more is known.
    static let tagline = all[0].detail
}

/// The app group the widget reads, and the widget's links into the app.
enum WidgetShared {
    static let group = "group.org.xpn.wxpn"
    static let key = "nowPlaying"
    static let artFile = "widget-art.jpg"
    static let open = URL(string: "org.xpn.wxpn://widget/open")!
    static let toggle = URL(string: "org.xpn.wxpn://widget/toggle")!
    static func play(_ id: String) -> URL { URL(string: "org.xpn.wxpn://widget/play/\(id)")! }

    static var defaults: UserDefaults? { UserDefaults(suiteName: group) }
    static var artURL: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)?
            .appendingPathComponent(artFile)
    }
}
