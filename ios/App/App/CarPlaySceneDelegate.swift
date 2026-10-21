// The CarPlay screen: WXPN, XPN2 and Homegrown in a list. Choosing one plays
// it and opens CarPlay's Now Playing screen, which shows the song from the
// lock screen's information and whose buttons reach the app through the
// media session it already sets up.
//
// Needs Apple's CarPlay audio entitlement (com.apple.developer.carplay-audio,
// requested at developer.apple.com/contact/carplay, then added to
// App.entitlements); the scene is set up in Info.plist. See README ›
// CarPlay and Android Auto.

import CarPlay
import UIKit

class CarPlaySceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate {
    private var interfaceController: CPInterfaceController?
    private var items: [String: CPListItem] = [:]

    /// The stations (Shared.swift), with their tiles (tools/car-art.mjs).
    private let stations = Stations.all

    func templateApplicationScene(
        _ scene: CPTemplateApplicationScene,
        didConnect interfaceController: CPInterfaceController
    ) {
        self.interfaceController = interfaceController
        // Started from the car with the phone app closed: load the app's web
        // view (where the audio plays) without showing it.
        AppLauncher.ensureWebAppLoaded()

        let listItems = stations.map { station -> CPListItem in
            let item = CPListItem(
                text: station.label, detailText: station.detail,
                image: UIImage(named: "car-\(station.id)"))
            item.handler = { [weak self] _, completion in
                NotificationCenter.default.post(
                    name: .wxpnCarCommand, object: nil,
                    userInfo: ["action": "play", "stationId": station.id])
                // Now Playing once: pushing it again while it's showing
                // would be refused by CarPlay.
                if let controller = self?.interfaceController,
                    controller.topTemplate !== CPNowPlayingTemplate.shared
                {
                    controller.pushTemplate(CPNowPlayingTemplate.shared, animated: true, completion: nil)
                }
                completion()
            }
            items[station.id] = item
            return item
        }
        let list = CPListTemplate(
            title: "WXPN", sections: [CPListSection(items: listItems)])
        list.tabImage = UIImage(systemName: "dot.radiowaves.left.and.right")
        interfaceController.setRootTemplate(list, animated: false, completion: nil)

        NotificationCenter.default.addObserver(
            self, selector: #selector(nowPlayingChanged(_:)),
            name: .wxpnCarNowPlaying, object: nil)
        // Connected while a station already plays: marked at once, not at
        // the app's next report.
        if let last = CarAudioPlugin.lastNowPlaying {
            nowPlayingChanged(Notification(name: .wxpnCarNowPlaying, object: nil, userInfo: last))
        }
    }

    func templateApplicationScene(
        _ scene: CPTemplateApplicationScene,
        didDisconnectInterfaceController interfaceController: CPInterfaceController
    ) {
        NotificationCenter.default.removeObserver(self, name: .wxpnCarNowPlaying, object: nil)
        self.interfaceController = nil
    }

    /// The playing station shows the playing indicator in the list.
    @objc private func nowPlayingChanged(_ note: Notification) {
        let id = note.userInfo?["stationId"] as? String
        let playing = note.userInfo?["playing"] as? Bool ?? false
        for (stationId, item) in items {
            item.isPlaying = playing && stationId == id
        }
    }
}

/// The app's one web view (Main.storyboard's Capacitor bridge), shared by the
/// phone's window and CarPlay. CarPlay can start the app with the phone app
/// closed: the web view is loaded offscreen then, so the station can play,
/// and the phone's window adopts that same one when it opens. Two would mean
/// two players and two sets of native callbacks. Kept for as long as the app
/// runs, so audio carries on if the phone's window is let go in the background.
enum AppLauncher {
    private static var shared: UIViewController?

    /// The web app's view controller, made the first time it's asked for.
    static func webApp() -> UIViewController {
        if let shared { return shared }
        let made = UIStoryboard(name: "Main", bundle: nil).instantiateInitialViewController()
            ?? MainViewController()
        shared = made
        return made
    }

    static func ensureWebAppLoaded() {
        _ = webApp().view  // loads the Capacitor bridge and the app, once
    }
}
