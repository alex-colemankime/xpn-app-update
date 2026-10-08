// The app's own plugins, registered with Capacitor. In Main.storyboard, set
// the Bridge View Controller's Custom Class to MainViewController (module:
// App) so this runs.

import Capacitor
import UIKit

class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(CarAudioPlugin())
    }
}
