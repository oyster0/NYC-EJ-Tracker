#!/usr/bin/env python3
"""
NYC EJ News Fetcher
Pulls articles from RSS feeds, scores them by EJ relevance,
and writes the top 10 to data/news.js as a JS global variable.

To add a new RSS source, append an entry to RSS_SOURCES below.
"""

import html
import json
import re
import sys
import hashlib
from datetime import datetime, timedelta, timezone
from pathlib import Path

try:
    import feedparser
except ImportError:
    print("feedparser not found — installing...", file=sys.stderr)
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "feedparser"])
    import feedparser

# ── RSS Sources ────────────────────────────────────────────────────────────────
# Add new sources here. Each entry is a dict with:
#   url    : RSS/Atom feed URL
#   source : Display name shown on the site
#   weight : Multiplier applied to relevance score (1.0 = normal, 1.5 = high-priority)
RSS_SOURCES = [
    {
        "url": "https://feeds.nytimes.com/nyt/rss/Climate",
        "source": "New York Times",
        "weight": 1.2
    },
    {
        "url": "https://gothamist.com/feed",
        "source": "Gothamist",
        "weight": 1.3
    },
    {
        "url": "https://thecity.nyc/feed",
        "source": "The City",
        "weight": 1.4
    },
    {
        "url": "https://citylimits.org/feed/",
        "source": "City Limits",
        "weight": 1.5
    },
    {
        "url": "https://insideclimatenews.org/feed/",
        "source": "Inside Climate News",
        "weight": 1.2
    },
    {
        "url": "https://www.nyc-eja.org/feed/",
        "source": "NYC EJA",
        "weight": 1.5
    },
    {
        "url": "https://www.weact.org/feed/",
        "source": "WE ACT",
        "weight": 1.5
    },
    {
        "url": "https://earthjustice.org/feed",
        "source": "Earthjustice",
        "weight": 1.3
    },
    {
        "url": "https://documentedny.com/feed/",
        "source": "Documented NY",
        "weight": 1.3
    },
]

# ── Keyword Scoring ────────────────────────────────────────────────────────────
# Each tuple is (keyword_pattern, score_points).
# Patterns are matched case-insensitively against headline + summary.
KEYWORD_SCORES = [
    # Core EJ terms — highest value
    (r"environmental justice",          10),
    (r"ej community",                    8),
    (r"cumulative impact",               8),
    (r"fence.?line community",           8),
    (r"overburdened community",          8),
    (r"disadvantaged community",         7),
    # Pollution / health
    (r"air quality",                     6),
    (r"air pollution",                   6),
    (r"toxic",                           5),
    (r"contamination",                   5),
    (r"superfund",                       6),
    (r"hazardous waste",                 5),
    (r"pollut",                          4),
    (r"asthma",                          5),
    (r"lead paint|lead pipe",            5),
    (r"diesel",                          4),
    (r"particulate matter|PM2\.5|PM10",  5),
    (r"emissions",                       4),
    (r"greenhouse gas",                  4),
    (r"carbon",                          3),
    # Water
    (r"water quality",                   5),
    (r"sewage|sewer overflow|CSO",       5),
    (r"flooding|flood risk",             5),
    (r"waterfront",                      3),
    (r"wetland",                         4),
    (r"stormwater",                      4),
    # Climate & resilience
    (r"climate",                         4),
    (r"resilience|resiliency",           4),
    (r"heat island|extreme heat",        5),
    (r"sea level",                       4),
    (r"green infrastructure",            4),
    (r"renewable energy|solar|wind farm",3),
    # Land use / housing
    (r"zoning",                          3),
    (r"land use",                        3),
    (r"displacement",                    4),
    (r"affordable housing",              3),
    (r"gentrification",                  3),
    (r"permit|permitting",               3),
    # NYC geography — presence lifts score
    (r"\bNYC\b|New York City",           3),
    (r"\bBronx\b",                       3),
    (r"\bBrooklyn\b",                    3),
    (r"\bManhattan\b",                   3),
    (r"\bQueens\b",                      3),
    (r"\bStaten Island\b",               3),
    (r"South Bronx|Hunts Point|Mott Haven|Port Morris", 4),
    (r"Red Hook|Gowanus|Sunset Park",    4),
    (r"East Harlem|West Harlem|Washington Heights", 4),
    (r"Maspeth|Jamaica Bay|Rockaway",    4),
    (r"Port Richmond|North Shore",       4),
    # Community engagement / policy
    (r"community board",                 4),
    (r"public hearing",                  4),
    (r"town hall",                       4),
    (r"comment period",                  4),
    (r"EPA|DEC|DEP\b",                   3),
    (r"lawsuit|litigation",              3),
    (r"legislation|bill|ordinance",      3),
    (r"environmental review|SEQR|CEQR", 4),
]

# ── Filters ───────────────────────────────────────────────────────────────────
# Articles MUST mention NYC or a borough/neighbourhood to be included.
# This prevents out-of-state stories (e.g. Mississippi) from slipping through.
NYC_REQUIRED_PATTERN = re.compile(
    r"\bNYC\b|New York City|New York, N\.?Y\.?|"
    r"\bBronx\b|South Bronx|Hunts Point|Mott Haven|Port Morris|Soundview|Tremont|Fordham|Riverdale|"
    r"\bBrooklyn\b|Red Hook|Gowanus|Sunset Park|Bushwick|Canarsie|East New York|Williamsburg|"
    r"Crown Heights|Bay Ridge|Flatbush|Bed.Stuy|"
    r"\bManhattan\b|East Harlem|West Harlem|Washington Heights|Inwood|Chinatown|"
    r"Lower East Side|Financial District|Midtown|Upper West Side|Upper East Side|"
    r"\bQueens\b|Jamaica Bay|Rockaway|Flushing|Maspeth|Astoria|Long Island City|"
    r"Ozone Park|Howard Beach|"
    r"Staten Island|Port Richmond|North Shore|Tottenville|St\. George",
    re.IGNORECASE,
)

# Articles MUST contain at least one core EJ term to be included.
# This blocks general NYC news (crime, sports, food, wildlife) that only
# picks up points from borough name mentions or vague words like "community".
CORE_EJ_PATTERN = re.compile(
    r"environmental justice|air quality|air pollution|"
    r"particulate matter|PM2\.5|PM10|"
    r"toxic|contamination|hazardous waste|Superfund|"
    r"pollut|emissions|diesel exhaust|"
    r"water quality|sewage|sewer overflow|CSO|stormwater|"
    r"flooding|flood risk|sea level|storm surge|"
    r"heat island|extreme heat|"
    r"wetland|habitat restoration|"
    r"asthma|lead paint|lead pipe|lead exposure|"
    r"greenhouse gas|carbon emissions|"
    r"green infrastructure|renewable energy|"
    r"zoning|land use|permit|SEQR|CEQR|environmental review|"
    r"climate resilience|climate adaptation|"
    r"overburdened|fence.?line|cumulative impact|disadvantaged community|"
    r"public hearing|comment period|community board hearing|"
    r"EPA|DEC\b|DEP\b|environmental law|environmental lawsuit",
    re.IGNORECASE,
)

# Minimum weighted score an article must reach to be included.
# Raising this filters out articles that only mention one EJ-adjacent word in passing.
MIN_SCORE = 10

# Maximum article age in days
MAX_AGE_DAYS = 28

# ── Borough Inference ──────────────────────────────────────────────────────────
BOROUGH_PATTERNS = [
    ("Bronx",         r"\bBronx\b|South Bronx|Hunts Point|Mott Haven|Port Morris|Soundview|Tremont|Fordham|Riverdale"),
    ("Brooklyn",      r"\bBrooklyn\b|Red Hook|Gowanus|Sunset Park|Bushwick|Canarsie|East New York|Williamsburg|Crown Heights|Bay Ridge|Flatbush"),
    ("Manhattan",     r"\bManhattan\b|East Harlem|West Harlem|Washington Heights|Inwood|Chinatown|Lower East Side|Financial District|Midtown|Upper West Side|Upper East Side"),
    ("Queens",        r"\bQueens\b|Jamaica Bay|Rockaway|Flushing|Maspeth|Astoria|Long Island City|Ozone Park|Jamaica\b|Howard Beach"),
    ("Staten Island", r"Staten Island|Port Richmond|North Shore|Tottenville|St\. George"),
]

TOPIC_PATTERNS = [
    ("Air Quality",    r"air quality|air pollution|particulate|PM2\.5|PM10|diesel|emissions|ozone"),
    ("Water",          r"water quality|flooding|flood|sewage|CSO|waterfront|wetland|stormwater|Superfund|dredg"),
    ("Climate",        r"climate|heat island|extreme heat|sea level|resilience|renewable|carbon|greenhouse"),
    ("Land Use",       r"zoning|land use|permit|permitting|development|housing|gentrification|displacement"),
    ("Health",         r"asthma|lead|toxic|contamination|hazardous|health|cancer"),
    ("Policy",         r"lawsuit|legislation|bill|EPA|DEC|DEP\b|ordinance|community board|public hearing"),
    ("Community",      r"environmental justice|community|town hall|volunteer|restoration"),
]

# ── Helpers ────────────────────────────────────────────────────────────────────

def clean_html(text: str) -> str:
    """Strip HTML tags, decode entities, and normalise whitespace."""
    text = re.sub(r"<[^>]+>", " ", text or "")
    text = html.unescape(text)           # decode &#38; &amp; &nbsp; etc.
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def score_text(text: str) -> int:
    """Return relevance score for a blob of text."""
    total = 0
    lower = text.lower()
    for pattern, pts in KEYWORD_SCORES:
        if re.search(pattern, lower, re.IGNORECASE):
            total += pts
    return total


def infer_borough(text: str) -> str:
    for borough, pattern in BOROUGH_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return borough
    return "All"


def infer_topic(text: str) -> str:
    for topic, pattern in TOPIC_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return topic
    return "Environmental Justice"


def parse_date(entry) -> tuple[str, datetime]:
    """Return (ISO date string YYYY-MM-DD, datetime object), falling back to today."""
    for attr in ("published_parsed", "updated_parsed"):
        t = getattr(entry, attr, None)
        if t:
            try:
                dt = datetime(*t[:3], tzinfo=timezone.utc)
                return dt.strftime("%Y-%m-%d"), dt
            except Exception:
                pass
    now = datetime.now(timezone.utc)
    return now.strftime("%Y-%m-%d"), now


def is_too_old(dt: datetime, max_days: int = MAX_AGE_DAYS) -> bool:
    """Return True if the article is older than max_days."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=max_days)
    return dt < cutoff


def entry_id(entry, source_name: str) -> str:
    """Stable short ID derived from URL or title hash."""
    seed = getattr(entry, "link", "") or getattr(entry, "title", source_name)
    return hashlib.md5(seed.encode()).hexdigest()[:8]


def summarise(entry) -> str:
    """
    Extract a clean 1–2 sentence summary from an RSS entry.
    Strips HTML, removes common boilerplate, and returns the first
    1–2 complete sentences capped at 280 characters.
    """
    # Try the most descriptive fields first
    raw = (
        getattr(entry, "summary", "")
        or getattr(entry, "description", "")
        or getattr(entry, "content", [{}])[0].get("value", "")
        or ""
    )

    text = clean_html(raw)

    # Strip common RSS boilerplate patterns
    boilerplate = [
        r"^by\s+[\w\s\.]+[,·]\s*",                          # "By Jane Smith, "
        r"^[\w\s\.]+\s*[|·—]\s*",                           # "Jane Smith | " or "The City — "
        r"\bContinue reading[^\n]*",                         # "Continue reading…"
        r"\bRead (more|the full story|article)[^\n]*",       # "Read more →"
        r"\bClick here[^\n]*",                               # "Click here to…"
        r"\b(Subscribe|Sign up) (to|for)[^\n]*",             # subscription prompts
        r"\(Photo[^\)]*\)",                                  # "(Photo: Jane Smith)"
        r"\[[\w\s]+\]",                                      # "[VIDEO]", "[PHOTOS]"
        r"\s*The post .+ appeared first on .+\.",            # WordPress syndication footer
        r"\s*This (article|story|post) (originally )?appeared[^\n]*",
        r"^[\w\s,]+ on (a |an )?(rainy|sunny|cloudy|hot|cold|warm|snowy)[^\n]*\.",  # image captions ("People on Brighton Beach on a rainy day...")
        r"^[\w\s]+ in [\w\s,]+ on (January|February|March|April|May|June|July|August|September|October|November|December)[^\n]*\.", # date-stamped photo captions
        r"\bThis story is part of\b[^\n]*",                  # newsletter promo ("This story is part of Summer & THE CITY...")
        r"\bour weekly newsletter\b[^\n]*",                  # newsletter promo
        r"[ more › ]|[ more > ]|\[ more \]",                 # Gothamist "[ more › ]" suffix
    ]
    for pattern in boilerplate:
        text = re.sub(pattern, " ", text, flags=re.IGNORECASE).strip()

    # Collapse any new whitespace gaps left by stripping
    text = re.sub(r"\s+", " ", text).strip()

    # Extract the first 1–2 complete sentences (split on . ! ?)
    sentences = re.split(r"(?<=[.!?])\s+", text)
    summary = ""
    for sentence in sentences:
        if not sentence.strip():
            continue
        candidate = (summary + " " + sentence).strip() if summary else sentence
        if len(candidate) > 280:
            break
        summary = candidate
        # Stop after 2 sentences
        if len(re.split(r"(?<=[.!?])\s+", summary)) >= 2:
            break

    # Fallback: if sentence splitting failed, hard-cap at 280 chars
    if not summary:
        summary = text
    if len(summary) > 280:
        summary = summary[:277].rsplit(" ", 1)[0] + "…"

    return summary


# ── Main ───────────────────────────────────────────────────────────────────────

REPO_ROOT    = Path(__file__).parent.parent
LOCAL_FEEDS  = REPO_ROOT / "feeds"   # XML files generated by scrapers/run_all.py


def _process_feed(feed, source_name: str, weight: float,
                  articles: list, seen_ids: set) -> None:
    """Parse entries from a feedparser feed object and apply all filters."""
    for entry in feed.entries:
        uid = entry_id(entry, source_name)
        if uid in seen_ids:
            continue
        seen_ids.add(uid)

        headline = clean_html(getattr(entry, "title", ""))
        summary  = summarise(entry)
        link     = getattr(entry, "link", "#") or "#"
        date_str, pub_dt = parse_date(entry)

        combined = headline + " " + summary

        if is_too_old(pub_dt):
            print(f"    SKIP (too old: {date_str}): {headline[:60]}", file=sys.stderr)
            continue
        if not NYC_REQUIRED_PATTERN.search(combined):
            print(f"    SKIP (not NYC): {headline[:60]}", file=sys.stderr)
            continue
        if not CORE_EJ_PATTERN.search(combined):
            print(f"    SKIP (no core EJ term): {headline[:60]}", file=sys.stderr)
            continue
        base_score = score_text(combined)
        if base_score < MIN_SCORE:
            print(f"    SKIP (low score {base_score}): {headline[:60]}", file=sys.stderr)
            continue

        articles.append({
            "_score":   base_score * weight,
            "_uid":     uid,
            "headline": headline,
            "summary":  summary,
            "source":   source_name,
            "date":     date_str,
            "url":      link,
            "borough":  infer_borough(combined),
            "topic":    infer_topic(combined),
        })


def fetch_all() -> list[dict]:
    articles = []
    seen_ids: set[str] = set()

    # ── Part A: Remote RSS feeds ───────────────────────────────────
    for source_cfg in RSS_SOURCES:
        url         = source_cfg["url"]
        source_name = source_cfg["source"]
        weight      = source_cfg.get("weight", 1.0)

        print(f"  Fetching {source_name} …", file=sys.stderr)
        try:
            feed = feedparser.parse(url)
        except Exception as exc:
            print(f"    ERROR fetching {url}: {exc}", file=sys.stderr)
            continue

        _process_feed(feed, source_name, weight, articles, seen_ids)

    # ── Part B: Local feeds generated by scrapers/run_all.py ──────
    # Each .xml file in feeds/ is a standard RSS/Atom document.
    # The filename (without extension) is used as the source name,
    # e.g. feeds/nyc_dep.xml → "nyc_dep".
    if LOCAL_FEEDS.is_dir():
        xml_files = sorted(LOCAL_FEEDS.glob("*.xml"))
        if xml_files:
            print(f"\nReading {len(xml_files)} local feed(s) from {LOCAL_FEEDS}/…",
                  file=sys.stderr)
        for xml_path in xml_files:
            source_name = xml_path.stem.replace("_", " ").title()
            print(f"  Parsing {xml_path.name} ({source_name}) …", file=sys.stderr)
            try:
                feed = feedparser.parse(str(xml_path))
            except Exception as exc:
                print(f"    ERROR parsing {xml_path.name}: {exc}", file=sys.stderr)
                continue
            # Local government/agency feeds get a slightly higher weight
            # than generic national outlets since they're curated for NYC EJ.
            _process_feed(feed, source_name, weight=1.4, articles=articles,
                          seen_ids=seen_ids)
    else:
        print("No feeds/ directory found — skipping local feeds.", file=sys.stderr)

    return articles


def build_news_js(articles: list[dict], top_n: int = 10) -> str:
    """Render articles as a JS file exporting const EJ_NEWS."""
    top = sorted(articles, key=lambda a: a["_score"], reverse=True)[:top_n]

    # Strip internal fields; assign sequential IDs
    clean = []
    for i, art in enumerate(top, start=1):
        clean.append({
            "id":       i,
            "headline": art["headline"],
            "summary":  art["summary"],
            "source":   art["source"],
            "date":     art["date"],
            "url":      art["url"],
            "borough":  art["borough"],
            "topic":    art["topic"],
        })

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    lines = [
        f"// Auto-generated by scripts/fetch_news.py — last updated {now}",
        "// Do not edit by hand; changes will be overwritten on the next scheduled run.",
        "",
        "const EJ_NEWS = " + json.dumps(clean, indent=2, ensure_ascii=False) + ";",
        "",
    ]
    return "\n".join(lines)


def main():
    repo_root = Path(__file__).parent.parent
    out_path  = repo_root / "data" / "news.js"

    print("Fetching RSS feeds…", file=sys.stderr)
    articles = fetch_all()
    print(f"Found {len(articles)} relevant articles across all feeds.", file=sys.stderr)

    if not articles:
        print("WARNING: No articles matched EJ keywords. Keeping existing news.js.", file=sys.stderr)
        sys.exit(0)

    js_content = build_news_js(articles, top_n=10)
    out_path.write_text(js_content, encoding="utf-8")
    print(f"Wrote {min(len(articles), 10)} articles to {out_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
