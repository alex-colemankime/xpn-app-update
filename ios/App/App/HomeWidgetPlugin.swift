// The home screen widget, the app's side: the plugin the web app talks to
// (widget.js, "HomeWidget"). It keeps what's playing in the app group the
// widget (WXPNWidget) reads, with the song's artwork, and asks WidgetKit to
// redraw it.
//
// Registered by MainViewController.

import Capacitor
import Foundation
import UIKit
import WidgetKit

// The names it shares with the widget are in Shared.swift (WidgetShared).

@objc(HomeWidgetPlugin)
public class HomeWidgetPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HomeWidgetPlugin"
    public let jsName = "HomeWidget"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
    ]

    @objc func update(_ call: CAPPluginCall) {
        let now: [String: Any] = [
            "station": call.getString("station") ?? "WXPN",
            "stationId": call.getString("stationId") ?? "",
            "title": call.getString("title") ?? "WXPN",
            "artist": call.getString("artist") ?? "",
            "show": call.getString("show") ?? "",
            "artwork": call.getString("artwork") ?? "",
            "playing": call.getBool("playing") ?? false,
        ]
        call.resolve()
        // Without the app group (a build that isn't signed for it), there's
        // nowhere to keep it, and no widget to show it.
        guard let defaults = WidgetShared.defaults else { return }
        let before = (defaults.dictionary(forKey: WidgetShared.key)?["artwork"] as? String) ?? ""
        defaults.set(now, forKey: WidgetShared.key)
        let artwork = now["artwork"] as? String ?? ""
        let artURL = WidgetShared.artURL
        let haveArt = artURL.map { FileManager.default.fileExists(atPath: $0.path) } ?? false
        if artwork == before && (artwork.isEmpty || haveArt) {
            WidgetCenter.shared.reloadAllTimelines()
            return
        }
        // New artwork: the words change now, the picture once it's here.
        if let artURL { try? FileManager.default.removeItem(at: artURL) }
        WidgetCenter.shared.reloadAllTimelines()
        guard let source = URL(string: artwork), let artURL else { return }
        URLSession.shared.dataTask(with: source) { data, _, _ in
            guard let data, let image = UIImage(data: data) else { return }
            // Still the song playing? A later one may have taken its place.
            let current = WidgetShared.defaults?.dictionary(forKey: WidgetShared.key)?["artwork"] as? String
            guard current == artwork else { return }
            // A widget's picture must stay small.
            let side: CGFloat = 600
            let format = UIGraphicsImageRendererFormat()
            format.scale = 1
            let scaled = UIGraphicsImageRenderer(size: CGSize(width: side, height: side), format: format)
                .image { _ in image.draw(in: CGRect(x: 0, y: 0, width: side, height: side)) }
            guard let jpeg = scaled.jpegData(compressionQuality: 0.85) else { return }
            try? jpeg.write(to: artURL, options: .atomic)
            WidgetCenter.shared.reloadAllTimelines()
        }.resume()
    }
}
