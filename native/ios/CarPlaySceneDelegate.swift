// The CarPlay screen: WXPN, XPN2 and Homegrown in a list. Choosing one plays
// it and opens CarPlay's Now Playing screen, which shows the song from the
// lock screen's information and whose buttons reach the app through the
// media session it already sets up.
//
// Needs Apple's CarPlay audio entitlement (com.apple.developer.carplay-audio,
// requested at developer.apple.com/contact/carplay) and the scene setup in
// README › CarPlay and Android Auto.

import CarPlay
import UIKit

class CarPlaySceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate {
    private var interfaceController: CPInterfaceController?
    private var items: [String: CPListItem] = [:]

    /// The stations, as in streams.js. Artwork: an image set named
    /// "car-<id>" in Assets.xcassets (the station tiles), else none.
    private let stations: [(id: String, label: String, detail: String)] = [
        ("xpn", "WXPN", "88.5 FM · Public Radio"),
        ("xpn2", "XPN2", "XPoNential Radio"),
        ("homegrown", "Homegrown", "Philadelphia's local music"),
    ]

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
                self?.interfaceController?.pushTemplate(
                    CPNowPlayingTemplate.shared, animated: true, completion: nil)
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

/// Loads the phone app's web view when CarPlay starts the app on its own,
/// so the station can play. Kept for as long as the app runs.
enum AppLauncher {
    private static var offscreen: UIViewController?

    static func ensureWebAppLoaded() {
        let phoneSceneActive = UIApplication.shared.connectedScenes.contains {
            $0.session.role == .windowApplication
        }
        guard !phoneSceneActive, offscreen == nil else { return }
        let controller = UIStoryboard(name: "Main", bundle: nil).instantiateInitialViewController()
        _ = controller?.view  // loads the Capacitor bridge and the app
        offscreen = controller
    }
}
