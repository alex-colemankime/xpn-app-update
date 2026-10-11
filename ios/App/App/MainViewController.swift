// The app's own plugins, registered with Capacitor. Main.storyboard's view
// controller is this class (module App), so this runs.

import Capacitor
import UIKit

class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(CarAudioPlugin())
    }
}
