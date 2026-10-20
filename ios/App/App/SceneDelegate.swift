// The phone's own scene. CarPlay needs the app to use scenes; this keeps
// the phone app as it was (Main.storyboard's Capacitor bridge, shared with
// CarPlay through AppLauncher, so there is only ever one) and passes links
// back to Capacitor, so the Spotify sign-in return trip and shared show
// links keep working.

import Capacitor
import UIKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(
        _ scene: UIScene, willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        // The window is made here rather than from a storyboard, so it can
        // show the web app CarPlay may already have started.
        if let windowScene = scene as? UIWindowScene {
            let window = UIWindow(windowScene: windowScene)
            window.rootViewController = AppLauncher.webApp()
            self.window = window
            window.makeKeyAndVisible()
        }
        if let url = connectionOptions.urlContexts.first?.url, !fromWidget(url) {
            _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, open: url, options: [:])
        }
        // A universal link (a shared xpn.org show page) that launched the app
        // arrives here, not in scene(_:continue:), which only covers links
        // opened while the app is already running. The proxy keeps it as the
        // launch URL, so the app's getLaunchUrl() finds it (deep-links.js).
        for activity in connectionOptions.userActivities
        where activity.activityType == NSUserActivityTypeBrowsingWeb {
            _ = ApplicationDelegateProxy.shared.application(
                UIApplication.shared, continue: activity, restorationHandler: { _ in })
        }
    }

    // The web app outlives the window (AppLauncher keeps it, playing).
    func sceneDidDisconnect(_ scene: UIScene) {
        window?.rootViewController = nil
        window = nil
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        for context in URLContexts where !fromWidget(context.url) {
            _ = ApplicationDelegateProxy.shared.application(
                UIApplication.shared, open: context.url, options: [:])
        }
    }

    /// The home screen widget's links (WXPNWidget.swift): opening the app is
    /// all a tap on it asks; its play key also plays or pauses, and a
    /// stream's name plays that stream, handed to the web app as the car's
    /// commands are (CarAudioPlugin, car.js "toggle" and "play").
    private func fromWidget(_ url: URL) -> Bool {
        guard url.scheme == "org.xpn.wxpn", url.host == "widget" else { return false }
        // The play key: play or pause. A stream's name: that stream, playing.
        var command: [String: Any]?
        if url.path == "/toggle" {
            command = ["action": "toggle"]
        } else if url.pathComponents.count == 3, url.pathComponents[1] == "play" {
            command = ["action": "play", "stationId": url.pathComponents[2]]
        }
        if let command {
            // Next turn of the main queue: at launch, after the web app's
            // plugins have loaded and are listening for it.
            DispatchQueue.main.async {
                NotificationCenter.default.post(name: .wxpnCarCommand, object: nil, userInfo: command)
            }
        }
        return true
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        _ = ApplicationDelegateProxy.shared.application(
            UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
    }
}
