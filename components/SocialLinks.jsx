import { Icon } from "../ui.jsx";
import { SOCIAL } from "../links.js";

// The station's accounts and World Cafe's: each name, then its platforms as
// icons. In Settings › Stay connected and the welcome's last step.
export function SocialLinks() {
  return (
    <div className="social-links">
      {SOCIAL.map(({ owner, accounts }) => (
        <div className="social-row" key={owner}>
          <span className="social-owner">{owner}</span>
          <span className="social-icons">
            {accounts.map((a) => (
              <a
                key={a.name}
                className="social-icon"
                href={a.url}
                target="_blank"
                rel="noreferrer"
                aria-label={`${owner} on ${a.name}`}
                title={`${a.name} · ${a.handle}`}
              >
                <Icon name={a.name.toLowerCase()} size={22} />
              </a>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}

// Subscribe to the station's YouTube channels: under saved videos, where
// someone who keeps the sessions is most likely to want more of them.
// YouTube's own address for subscribing asks them to confirm.
const YOUTUBE = SOCIAL.map(({ owner, accounts }) => ({
  owner,
  ...accounts.find((a) => a.name === "YouTube"),
})).filter((c) => c.url);

export function YouTubeSubscribe() {
  return (
    <div className="social-links youtube-subscribe">
      {YOUTUBE.map((c) => (
        <div className="social-row" key={c.owner}>
          <span className="youtube-channel">
            <Icon name="youtube" size={22} />
            <span>
              <span className="social-owner">{c.owner}</span>
              <small>on YouTube</small>
            </span>
          </span>
          <a
            className="secondary-button"
            href={`${c.url}${c.url.includes("?") ? "&" : "?"}sub_confirmation=1`}
            target="_blank"
            rel="noreferrer"
            aria-label={`Subscribe to ${c.owner} on YouTube`}
          >
            Subscribe
          </a>
        </div>
      ))}
    </div>
  );
}
