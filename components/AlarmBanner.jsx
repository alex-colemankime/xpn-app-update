import { Icon, heightVar } from "../ui.jsx";
import { STREAMS } from "../streams.js";
import { clockLabel } from "../time.js";

const trackHeight = heightVar("--alarm-h");

// The radio alarm ringing, across the top of every screen until snoozed or
// dismissed.
export function AlarmBanner({ alarm, onSnooze, onDismiss }) {
  return (
    <div className="alarm-banner" role="alert" ref={trackHeight}>
      <span className="alarm-banner-title">
        <span className="alarm-bell" aria-hidden="true">
          <Icon name="bell" size={20} />
        </span>
        <span>
          <strong>Radio alarm</strong>
          <small>
            {clockLabel(alarm.time)} · {STREAMS[alarm.streamId]?.label}
          </small>
        </span>
      </span>
      <span className="alarm-banner-actions">
        <button className="alarm-snooze" onClick={onSnooze}>
          Snooze {alarm.snoozeMinutes} min
        </button>
        <button className="alarm-dismiss" onClick={onDismiss}>
          Dismiss
        </button>
      </span>
    </div>
  );
}
