/*
  The services the Embed and Video widgets will build an iframe for. The page file never holds a raw iframe: it holds
  the address the person pasted, and the widget turns it into the provider's own embed address. An address that does
  not match a provider here is not embedded, so no other site can be framed into a page.

  A provider may have `query`: the playback options (autoplay, muted, loop, controls) as the provider's own parameters.
*/
export const embedProviders = [
  {
    name: 'YouTube',
    pattern: /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i,
    embed: id => `https://www.youtube-nocookie.com/embed/${id}`,
    query: (options, id) => ({
      autoplay: options.autoplay && 1,
      mute: (options.muted || options.autoplay) && 1,
      loop: options.loop && 1,
      playlist: options.loop && id,
      controls: options.controls === false && 0
    }),
    ratio: '16 / 9'
  },
  {
    name: 'Vimeo',
    pattern: /^https?:\/\/(?:www\.)?vimeo\.com\/(?:video\/)?(\d+)/i,
    embed: id => `https://player.vimeo.com/video/${id}`,
    query: options => ({
      autoplay: options.autoplay && 1,
      muted: (options.muted || options.autoplay) && 1,
      loop: options.loop && 1,
      controls: options.controls === false && 0
    }),
    ratio: '16 / 9'
  },
  {
    name: 'Spotify',
    pattern: /^https?:\/\/open\.spotify\.com\/(track|album|playlist|episode|show|artist)\/(\w+)/i,
    embed: (kind, id) => `https://open.spotify.com/embed/${kind}/${id}`,
    ratio: '3 / 1'
  }
];

/* { provider, src, ratio } for an address one of the providers can embed, or null. */
export const resolveEmbed = (address, options = {}) => {
  const text = String(address ?? '').trim();
  for(const provider of embedProviders){
    const match = text.match(provider.pattern);
    if(!match) continue;
    const query = new URLSearchParams(Object.entries(provider.query?.(options, ...match.slice(1)) || {}).filter(([, value]) => value || value === 0));
    const src = provider.embed(...match.slice(1));
    return { provider: provider.name, src: String(query) ? `${src}?${query}` : src, ratio: provider.ratio };
  }
  return null;
};
