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
        if let url = connectionOptions.urlContexts.first?.url {
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
        for context in URLContexts {
            _ = ApplicationDelegateProxy.shared.application(
                UIApplication.shared, open: context.url, options: [:])
        }
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        _ = ApplicationDelegateProxy.shared.application(
            UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
    }
}
