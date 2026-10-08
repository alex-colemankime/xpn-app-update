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
