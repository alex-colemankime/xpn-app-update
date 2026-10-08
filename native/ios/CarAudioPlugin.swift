// CarPlay and Android Auto, iOS side: the plugin the web app talks to
// (car.js, "CarAudio"). The car screen (CarPlaySceneDelegate.swift) posts
// the listener's choices here; the app plays them.
//
// Add to the App target in Xcode (see README › CarPlay and Android Auto).
// Untested until the native project exists: build and try it in Xcode's
// CarPlay simulator (I/O › External Displays › CarPlay) before release.

import Capacitor
import Foundation

extension Notification.Name {
    /// From the car screen: userInfo ["action": "play" | "pause", "stationId": String?]
    static let wxpnCarCommand = Notification.Name("WXPNCarCommand")
    /// To the car screen: what is playing (userInfo ["stationId": String, "playing": Bool])
    static let wxpnCarNowPlaying = Notification.Name("WXPNCarNowPlaying")
}

@objc(CarAudioPlugin)
public class CarAudioPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CarAudioPlugin"
    public let jsName = "CarAudio"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setNowPlaying", returnType: CAPPluginReturnPromise),
    ]

    /// A choice made in the car before the web app was listening (CarPlay
    /// can start the app); delivered once it is.
    private var pending: [String: Any]?

    override public func load() {
        NotificationCenter.default.addObserver(
            forName: .wxpnCarCommand, object: nil, queue: .main
        ) { [weak self] note in
            guard let self, let info = note.userInfo as? [String: Any] else { return }
            if self.hasListeners("command") {
                self.notifyListeners("command", data: info)
            } else {
                self.pending = info
            }
        }
    }

    override public func addListener(_ call: CAPPluginCall) {
        super.addListener(call)
        if call.getString("eventName") == "command", let info = pending {
            pending = nil
            notifyListeners("command", data: info)
        }
    }

    /// The song and station come to CarPlay from the lock screen's
    /// information (MPNowPlayingInfoCenter); this only marks which station
    /// in the car's list is playing.
    @objc func setNowPlaying(_ call: CAPPluginCall) {
        NotificationCenter.default.post(
            name: .wxpnCarNowPlaying, object: nil,
            userInfo: [
                "stationId": call.getString("stationId") ?? "xpn",
                "playing": call.getBool("playing") ?? false,
            ])
        call.resolve()
    }
}
