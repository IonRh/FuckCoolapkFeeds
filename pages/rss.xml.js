function escapeXml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function cleanText(value = '') {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toRssDate(dateline) {
  const numeric = Number(dateline);
  if (!Number.isNaN(numeric) && numeric > 0) {
    // Coolapk dateline is usually Unix seconds.
    return new Date(numeric * 1000).toUTCString();
  }

  const parsed = new Date(dateline);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toUTCString();
  }

  return new Date().toUTCString();
}

function buildItemXml(feed, siteUrl) {
  const id = feed?.id;
  if (!id) return '';

  const link = `${siteUrl}/feed/${id}`;
  const rawTitle = feed?.message_title || feed?.title || feed?.ttitle || `Coolapk Feed ${id}`;
  const rawDescription = feed?.message || '';

  const title = escapeXml(cleanText(rawTitle));
  const description = escapeXml(cleanText(rawDescription) || `查看动态 ${id}`);
  const author = escapeXml(feed?.username || 'Coolapk User');
  const pubDate = toRssDate(feed?.dateline);

  return [
    '<item>',
    `<title>${title}</title>`,
    `<link>${escapeXml(link)}</link>`,
    `<guid isPermaLink="true">${escapeXml(link)}</guid>`,
    `<description>${description}</description>`,
    `<author>${author}</author>`,
    `<pubDate>${escapeXml(pubDate)}</pubDate>`,
    '</item>',
  ].join('');
}

export async function getServerSideProps({ req, res }) {
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const siteUrl = `${protocol}://${host}`;

  let itemsXml = '';

  try {
    const token = process.env.INTERNAL_AUTH_TOKEN || '';
    const headers = token ? { 'X-Internal-Auth': token } : {};

    const apiRes = await fetch(`${siteUrl}/api/headlines?page=1`, { headers });
    if (!apiRes.ok) {
      throw new Error(`Failed to fetch headlines: ${apiRes.status}`);
    }

    const json = await apiRes.json();
    const feeds = (json?.data || []).filter((f) => f?.entityType === 'feed').slice(0, 20);
    itemsXml = feeds.map((feed) => buildItemXml(feed, siteUrl)).join('');
  } catch (error) {
    itemsXml = '';
  }

  const now = new Date().toUTCString();
  const rssXml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '<channel>',
    '<title>Coolapk1s 头条 RSS</title>',
    `<link>${escapeXml(siteUrl)}</link>`,
    '<description>Coolapk1s 头条动态 RSS 订阅</description>',
    '<language>zh-cn</language>',
    `<lastBuildDate>${escapeXml(now)}</lastBuildDate>`,
    itemsXml,
    '</channel>',
    '</rss>',
  ].join('');

  res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=1800, stale-while-revalidate=0');
  res.write(rssXml);
  res.end();

  return { props: {} };
}

export default function Rss() {
  return null;
}
