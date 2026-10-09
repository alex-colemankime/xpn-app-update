import { useState, useSyncExternalStore } from "react";
import { Capacitor } from "@capacitor/core";
import { Modal } from "../ui.jsx";
import { updateRequest, versionBelow } from "../remote-config.js";
import { openPage } from "../links.js";
import { readJson, writeJson } from "../storage.js";

const VERSION = __APP_VERSION__;
const DISMISSED_KEY = "xpn.update.dismissed";

// The station asking for a newer version (remote config): below its
// minimum, the phone apps say so and link to the store. A request can be
// set aside once per minimum version, unless the station marks it required
// (this version can't work any more), when it stays until the update.
export function UpdatePrompt() {
  const request = useSyncExternalStore(updateRequest.subscribe, updateRequest.getSnapshot);
  const [dismissed, setDismissed] = useState(() => readJson(DISMISSED_KEY, ""));
  const platform = Capacitor.getPlatform();
  if (!request || platform === "web" || !versionBelow(VERSION, request.minVersion)) return null;
  if (!request.required && dismissed === request.minVersion) return null;
  const store = platform === "ios" ? request.ios : request.android;
  const later = () => {
    writeJson(DISMISSED_KEY, request.minVersion);
    setDismissed(request.minVersion);
  };
  return (
    <Modal title="Update WXPN" onClose={request.required ? undefined : later}>
      <div className="detail-body update-prompt">
        <p>
          {request.message || "A new version of the WXPN app is ready, with fixes you'll want."}
        </p>
        <div className="welcome-actions">
          {!request.required && (
            <button className="text-button" onClick={later}>
              Not now
            </button>
          )}
          {store && (
            <button className="primary-button" onClick={() => openPage(store)}>
              Update
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
