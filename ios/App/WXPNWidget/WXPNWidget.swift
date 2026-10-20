// The home screen widget, iOS side: a block with the stream you're
// listening to, the song's artwork, title and artist, the show on the air,
// and a play key. What it shows comes from the app (HomeWidgetPlugin.swift,
// widget.js) through the app group. A tap on it opens the app; the play key
// opens it and plays or pauses (SceneDelegate hands that to the web app as
// the car's "toggle").
//
// Small: the artwork with the stream. Medium (the block): the artwork beside
// the stream, the song, the show and play. Large: the artwork across the top.

import SwiftUI
import WidgetKit

/// The app's names for what it shares (HomeWidgetPlugin.swift, WidgetShared).
private enum Shared {
    static let group = "group.org.xpn.wxpn"
    static let key = "nowPlaying"
    static let artFile = "widget-art.jpg"
    static let open = URL(string: "org.xpn.wxpn://widget/open")!
    static let toggle = URL(string: "org.xpn.wxpn://widget/toggle")!
}

struct NowPlaying {
    var station = "WXPN"
    var detail = "88.5 FM · Public Radio"
    var title = "WXPN"
    var artist = "88.5 FM · Public Radio"
    var show = ""
    var playing = false
    var art: UIImage?

    static func load() -> NowPlaying {
        var now = NowPlaying()
        guard let saved = UserDefaults(suiteName: Shared.group)?.dictionary(forKey: Shared.key) else {
            return now
        }
        now.station = saved["station"] as? String ?? now.station
        now.detail = saved["detail"] as? String ?? ""
        now.title = saved["title"] as? String ?? now.title
        now.artist = saved["artist"] as? String ?? ""
        now.show = saved["show"] as? String ?? ""
        now.playing = saved["playing"] as? Bool ?? false
        if let url = FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: Shared.group)?
            .appendingPathComponent(Shared.artFile)
        {
            now.art = UIImage(contentsOfFile: url.path)
        }
        return now
    }

    /// For the widget gallery.
    static let sample = NowPlaying(
        station: "WXPN", detail: "88.5 FM · Public Radio", title: "Motion Sickness",
        artist: "Phoebe Bridgers", show: "World Cafe", playing: true)
}

struct Entry: TimelineEntry {
    let date: Date
    let now: NowPlaying
}

/// Redrawn when the app says so (WidgetCenter), never on a timer.
struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> Entry { Entry(date: Date(), now: .sample) }

    func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
        completion(Entry(date: Date(), now: context.isPreview ? .sample : .load()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
        completion(Timeline(entries: [Entry(date: Date(), now: .load())], policy: .never))
    }
}

/// The app's colors (styles/base.css), light and dark.
private extension Color {
    static func app(_ light: UInt32, _ dark: UInt32) -> Color {
        Color(UIColor { traits in
            let hex = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(
                red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255,
                blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
        })
    }
    static let surface = app(0xFFFFFF, 0x1D1D1D)
    static let ink = app(0x111111, 0xF0F0ED)
    static let muted = app(0x5C5C59, 0xA2A29F)
    static let donateFill = app(0xF4D8CE, 0x4B2A20)
    static let donateInk = app(0x983012, 0xFFA585)
    static let station = Color(red: 0xEF / 255, green: 0x71 / 255, blue: 0x49 / 255)
}

/// The song's artwork, or the station's own tile before one is known.
struct Artwork: View {
    let image: UIImage?
    var body: some View {
        if let image {
            Image(uiImage: image).resizable().aspectRatio(contentMode: .fill)
        } else {
            ZStack {
                Color.station
                Text("wxpn")
                    .font(.system(size: 30, weight: .heavy))
                    .tracking(-1.5)
                    .foregroundColor(.white)
            }
        }
    }
}

/// The stream: its name, then its line, quieter.
struct StreamLine: View {
    let now: NowPlaying
    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text(now.station).font(.system(size: 13, weight: .bold)).foregroundColor(.ink)
            if !now.detail.isEmpty {
                Text(now.detail).font(.system(size: 12)).foregroundColor(.muted)
            }
        }
        .lineLimit(1)
    }
}

/// Play or pause: Donate's tonal colors, the app's squared shape. It opens
/// the app, which plays or pauses.
struct PlayKey: View {
    let now: NowPlaying
    var body: some View {
        Link(destination: Shared.toggle) {
            Image(systemName: now.playing ? "pause.fill" : "play.fill")
                .font(.system(size: 18, weight: .bold))
                .foregroundColor(.donateInk)
                .frame(width: 44, height: 44)
                .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color.donateFill))
        }
        .accessibilityLabel(now.playing ? "Pause \(now.station)" : "Play \(now.station)")
    }
}

struct Song: View {
    let now: NowPlaying
    var titleSize: CGFloat = 17
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(now.title)
                .font(.system(size: titleSize, weight: .bold))
                .foregroundColor(.ink)
                .lineLimit(2)
            if !now.artist.isEmpty {
                Text(now.artist).font(.system(size: 14)).foregroundColor(.muted).lineLimit(1)
            }
        }
    }
}

struct WidgetView: View {
    @Environment(\.widgetFamily) var family
    let now: NowPlaying

    var body: some View {
        content
            .widgetURL(Shared.open)
            .appBackground()
    }

    @ViewBuilder var content: some View {
        switch family {
        case .systemSmall:
            VStack(alignment: .leading, spacing: 8) {
                Artwork(image: now.art)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                StreamLine(now: now)
            }
        case .systemLarge:
            VStack(alignment: .leading, spacing: 12) {
                Artwork(image: now.art)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                StreamLine(now: now)
                HStack(alignment: .bottom) {
                    VStack(alignment: .leading, spacing: 4) {
                        Song(now: now, titleSize: 20)
                        if !now.show.isEmpty {
                            Text(now.show).font(.system(size: 12)).foregroundColor(.muted).lineLimit(1)
                        }
                    }
                    Spacer(minLength: 12)
                    PlayKey(now: now)
                }
            }
        default:
            HStack(spacing: 14) {
                Artwork(image: now.art)
                    .aspectRatio(1, contentMode: .fit)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                VStack(alignment: .leading, spacing: 0) {
                    StreamLine(now: now)
                    Spacer(minLength: 4)
                    Song(now: now)
                    Spacer(minLength: 4)
                    HStack {
                        Text(now.show).font(.system(size: 12)).foregroundColor(.muted).lineLimit(1)
                        Spacer(minLength: 8)
                        PlayKey(now: now)
                    }
                }
            }
        }
    }
}

private extension View {
    /// The widget's card: the app's raised surface.
    @ViewBuilder func appBackground() -> some View {
        if #available(iOS 17.0, *) {
            containerBackground(for: .widget) { Color.surface }
        } else {
            padding().background(Color.surface)
        }
    }
}

@main
struct WXPNWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "WXPNNowPlaying", provider: Provider()) { entry in
            WidgetView(now: entry.now)
        }
        .configurationDisplayName("WXPN")
        .description("What's playing on WXPN, XPN2 or Homegrown, with play.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}
