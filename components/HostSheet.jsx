import { Art, Icon, Modal, shareText } from "../ui.jsx";
import { showToast } from "../toast.js";
import { SHOWS } from "../catalog.js";
import { deviceIsEastern } from "../time.js";
import { hostsOfShow } from "../hosts.js";

// A host's sheet: their portrait and the line under their name on xpn.org,
// the shows they host and when (each opens its own sheet; Back returns
// here), then their bio, and their page on xpn.org.
export function HostSheet({ host, onClose, onOpenShow }) {
  const shows = host.shows.map((id) => SHOWS[id]).filter(Boolean);
  return (
    <Modal title={host.name} onClose={onClose} className="host-sheet">
      <div className="detail-body">
        <div className="show-detail-hero host-hero">
          {host.img && <img src={host.img} alt="" />}
          <div>
            {host.when && <p className="host-when">{host.when}</p>}
            <button
              className="icon-button show-share"
              aria-label={`Share ${host.name}`}
              onClick={async () =>
                showToast(await shareText(host.name, `${host.name} on WXPN`, host.page))
              }
            >
              <Icon name="shareAlt" size={19} />
            </button>
          </div>
        </div>
        {shows.length > 0 && (
          <>
            <div className="section-heading">
              <h3>On the air</h3>
              {shows.some((s) => s.schedule?.length) && !deviceIsEastern() && (
                <span className="subtle">Eastern time</span>
              )}
            </div>
            <ul className="host-shows">
              {shows.map((show) => (
                <li key={show.id}>
                  <button className="host-show" onClick={() => onOpenShow(show.id)}>
                    <Art src={show.img} alt="" loading="lazy" />
                    <span>
                      <strong>{show.name}</strong>
                      {show.times.map((line) => (
                        <small key={line}>{line}</small>
                      ))}
                    </span>
                    <Icon name="chev" size={20} />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {host.bio.length > 0 && (
          <div className="host-bio">
            {host.bio.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        )}
        <a className="text-button host-page" href={host.page} target="_blank" rel="noreferrer">
          More on xpn.org
        </a>
      </div>
    </Modal>
  );
}

// A show's host line, each host it names a way into their sheet: "Raina
// Douris & Stephen Kallao", with each name a link. Names without a sheet
// stay words.
export function HostLine({ show, onOpenHost }) {
  const line = show.host || "";
  const hosts = onOpenHost ? hostsOfShow(show) : [];
  const parts = [];
  let rest = line;
  for (const host of hosts) {
    const i = rest.toLowerCase().indexOf(host.name.toLowerCase());
    if (i < 0) continue;
    if (i > 0) parts.push(rest.slice(0, i));
    parts.push(
      <button key={host.slug} className="host-link" onClick={() => onOpenHost(host.slug)}>
        {rest.slice(i, i + host.name.length)}
      </button>,
    );
    rest = rest.slice(i + host.name.length);
  }
  if (rest) parts.push(rest);
  return parts;
}

// A host in the Hosts view: their portrait, name and shows.
export function HostCard({ host, onOpen }) {
  const shows = host.shows.map((id) => SHOWS[id]?.name).filter(Boolean);
  return (
    <button className="show-card host-card" onClick={() => onOpen(host.slug)}>
      <span className="show-cover">
        {host.img ? <img src={host.img} alt="" loading="lazy" /> : null}
      </span>
      <strong className="show-card-name">{host.name}</strong>
      <small className="show-card-when">{shows.join(", ") || host.when}</small>
    </button>
  );
}
