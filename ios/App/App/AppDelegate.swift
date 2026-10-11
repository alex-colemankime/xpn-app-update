import AVFoundation
import Capacitor
import UIKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        // Playback audio: the station keeps playing with the screen locked and
        // the app in the background (with UIBackgroundModes: audio), and plays
        // through the ring/silent switch, as radio apps do.
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
        return true
    }

    // The phone's own window and the CarPlay screen are scenes, configured
    // in Info.plist (SceneDelegate.swift, CarPlaySceneDelegate.swift).

    // Push notifications (@capacitor/push-notifications): the phone's token,
    // or why there isn't one, passed on to the plugin.
    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        NotificationCenter.default.post(
            name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        NotificationCenter.default.post(
            name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    // Links that open the app arrive through the scene (SceneDelegate.swift);
    // these cover any that reach the app itself.
    func application(
        _ app: UIApplication, open url: URL,
        options: [UIApplication.OpenURLOptionsKey: Any] = [:]
    ) -> Bool {
        ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(
        _ application: UIApplication, continue userActivity: NSUserActivity,
        restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
    ) -> Bool {
        ApplicationDelegateProxy.shared.application(
            application, continue: userActivity, restorationHandler: restorationHandler)
    }
}
