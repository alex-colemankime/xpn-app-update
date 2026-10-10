// The phone's own scene. CarPlay needs the app to use scenes; this keeps
// the phone app exactly as it was (Main.storyboard, the Capacitor bridge)
// and passes links back to Capacitor, so the Spotify sign-in return trip and
// shared show links keep working.

import Capacitor
import UIKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(
        _ scene: UIScene, willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        // Main.storyboard is set in Info.plist's scene configuration, so the
        // window and the bridge view controller are created as before.
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
