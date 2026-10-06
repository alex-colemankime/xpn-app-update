import { Icon } from "../ui.jsx";
import { ENEWS_URL, TOP_STORIES_URL } from "../links.js";

// WXPN's weekly e-news. Signing up happens on xpn.org's own form (it is
// protected against spam there), opened from the app.

// Settings: what the newsletter is, and the way in.
export function NewsletterPanel() {
  return (
    <section className="settings-panel newsletter-panel">
      <h2>
        <Icon name="mail" />
        Newsletter
      </h2>
      <p className="data-note">
        WXPN’s weekly email: top stories and music news, concert and event alerts, and special
        announcements.
      </p>
      <a
        className="secondary-button newsletter-button"
        href={ENEWS_URL}
        target="_blank"
        rel="noreferrer"
      >
        <Icon name="mail" size={18} />
        Sign up for the e-news
        <Icon name="arrowUp" size={16} />
      </a>
      <a
        className="text-button newsletter-offer"
        href={TOP_STORIES_URL}
        target="_blank"
        rel="noreferrer"
      >
        Or sign up with Top Stories and get a free 885 Greatest Cover Songs playlist
        <Icon name="arrowUp" size={16} />
      </a>
    </section>
  );
}

// At the end of the concert listings: concert news by email, from the e-news.
export function NewsletterPrompt() {
  return (
    <a
      className="playlist-prompt newsletter-prompt"
      href={ENEWS_URL}
      target="_blank"
      rel="noreferrer"
    >
      <Icon name="mail" size={18} />
      <span>
        <strong>Get concert news by email</strong>
        <small>Sign up for WXPN’s free weekly e-news</small>
      </span>
      <Icon name="arrowUp" size={16} />
    </a>
  );
}
